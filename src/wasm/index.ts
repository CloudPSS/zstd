import { coercionInput } from '../utils.js';
import { createModule, type BufferSource } from '../common.js';
import * as common from './common.js';
import { Worker as WorkerPolyfill, MAX_WORKERS, TransformStream } from '#worker-polyfill';
import type { WorkerReady, WorkerRequest, WorkerResponse } from './worker.js';

await common.ModuleReady;

const IDLE_WORKERS: Worker[] = [];
const BUSY_WORKERS = new Set<Worker>();
const PENDING_BORROW: Array<(value: Worker) => void> = [];
let SEQ = 0;

/** create and initialize worker */
async function initWorker(): Promise<Worker> {
    return new Promise((resolve, reject) => {
        const worker =
            typeof Worker == 'function'
                ? new Worker(new URL('./worker.js', import.meta.url), {
                      type: 'module',
                      name: `@cloudpss/zstd/worker`,
                  })
                : new WorkerPolyfill(new URL('./worker.js', import.meta.url), {
                      type: 'module',
                      name: `@cloudpss/zstd/worker`,
                  });
        BUSY_WORKERS.add(worker);

        const onMessage = (ev: MessageEvent): void => {
            if ((ev.data as WorkerReady) !== 'ready') return;
            cleanup();
            worker.addEventListener('error', (ev) => {
                // eslint-disable-next-line no-console
                console.error('@cloudpss/zstd worker error', ev);

                worker.terminate();
                BUSY_WORKERS.delete(worker);
                IDLE_WORKERS.splice(IDLE_WORKERS.indexOf(worker), 1);
                handlePendingBorrow();
            });
            resolve(worker);
        };
        const onError = (ev: ErrorEvent): void => {
            cleanup();
            reject(new Error(ev.message, { cause: ev.error }));
            BUSY_WORKERS.delete(worker);
        };
        const cleanup = (): void => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
    });
}

/** handle pending borrow */
function handlePendingBorrow(): void {
    void Promise.resolve().then(async () => {
        while (PENDING_BORROW.length > 0 && IDLE_WORKERS.length > 0) {
            const worker = IDLE_WORKERS.pop()!;
            BUSY_WORKERS.add(worker);
            PENDING_BORROW.shift()!(worker);
        }
        while (PENDING_BORROW.length > 0 && BUSY_WORKERS.size < MAX_WORKERS) {
            const worker = await initWorker();
            PENDING_BORROW.shift()!(worker);
        }
    });
}

/** return worker to pool */
function returnWorker(worker: Worker): void {
    if (!BUSY_WORKERS.delete(worker)) return;
    IDLE_WORKERS.push(worker);
    handlePendingBorrow();
}

/** destroy worker */
function destroyWorker(worker: Worker): void {
    worker.terminate();
    BUSY_WORKERS.delete(worker);
    IDLE_WORKERS.splice(IDLE_WORKERS.indexOf(worker), 1);
}

/** get or wait for an idle worker */
async function borrowWorker(): Promise<Worker> {
    if (IDLE_WORKERS.length > 0) {
        const worker = IDLE_WORKERS.pop()!;
        BUSY_WORKERS.add(worker);
        return worker;
    }
    if (BUSY_WORKERS.size < MAX_WORKERS) {
        const worker = await initWorker();
        return worker;
    }
    return await new Promise((resolve) => {
        PENDING_BORROW.push(resolve);
    });
}

const MAX_COPY_OVERHEAD = 1024 * 16; // 16KB

/** Call to a specific worker */
async function callWorker(worker: Worker, method: WorkerRequest[1], args: WorkerRequest[2]): Promise<Uint8Array> {
    const seq = SEQ++;
    const request = [seq, method, args] as WorkerRequest;
    const transferable: Transferable[] = [];
    if (ArrayBuffer.isView(args[0]) && args[0].byteLength + MAX_COPY_OVERHEAD < args[0].buffer.byteLength) {
        args[0] = Uint8Array.from(args[0]);
        transferable.push(args[0].buffer);
    }
    return new Promise((resolve, reject) => {
        worker.postMessage(request, transferable);

        const onMessage = (ev: MessageEvent): void => {
            const [resSeq, data, error] = ev.data as WorkerResponse;
            if (resSeq !== seq) return;
            cleanup();
            if (error) {
                reject(error);
            } else {
                resolve(data!);
            }
        };
        const onError = (ev: ErrorEvent): void => {
            cleanup();
            reject(new Error(ev.message, { cause: ev.error }));
        };
        const cleanup = (): void => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
    });
}

/** Call to worker pool */
async function call(method: WorkerRequest[1], args: WorkerRequest[2]): Promise<Uint8Array> {
    const worker = await borrowWorker();
    try {
        return await callWorker(worker, method, args);
    } finally {
        returnWorker(worker);
    }
}

/** cleanup all workers */
export function terminate(): void {
    for (const worker of IDLE_WORKERS) {
        worker.terminate();
    }
    for (const worker of BUSY_WORKERS) {
        worker.terminate();
    }
    IDLE_WORKERS.length = 0;
    BUSY_WORKERS.clear();
}

/** get current worker status */
export function workers(): { idle: number; busy: number } {
    return { idle: IDLE_WORKERS.length, busy: BUSY_WORKERS.size };
}

/** Proxy to worker */
abstract class TransformProxy implements Transformer<BufferSource, Uint8Array> {
    constructor(
        protected readonly method: WorkerRequest[1],
        protected readonly args: WorkerRequest[2],
    ) {}
    protected ctx: Worker | null = null;
    protected controller!: TransformStreamDefaultController<Uint8Array>;

    /** receive from worker */
    private readonly onMessage = (ev: MessageEvent<WorkerResponse>): void => {
        const [seq, data, error] = ev.data;
        if (seq != null) return;
        if (error) {
            this.controller.error(error);
            this.end(error);
        } else {
            this.controller.enqueue(data!);
        }
    };

    /** end transform */
    protected end(error: unknown): void {
        const { ctx } = this;
        if (ctx) {
            ctx.removeEventListener('message', this.onMessage);
        }
        if (error != null) {
            this.controller.error(error);
            if (ctx) destroyWorker(ctx);
        } else {
            if (ctx) returnWorker(ctx);
        }
        this.ctx = null;
    }
    /** @inheritdoc */
    async start(controller: TransformStreamDefaultController<Uint8Array>): Promise<void> {
        this.controller = controller;
        try {
            this.ctx = await borrowWorker();
            this.ctx.addEventListener('message', this.onMessage);
            await callWorker(this.ctx, this.method, this.args);
        } catch (ex) {
            this.end(ex);
        }
    }

    /** @inheritdoc */
    async transform(chunk: BufferSource): Promise<void> {
        try {
            const src = coercionInput(chunk, false);
            await callWorker(this.ctx!, 'transform', [src]);
        } catch (ex) {
            this.end(ex);
        }
    }

    /** @inheritdoc */
    async flush(): Promise<void> {
        try {
            await callWorker(this.ctx!, 'flush', [null]);
            this.end(null);
        } catch (ex) {
            this.end(ex);
        }
    }
}

/** Stream compressor */
class WebCompressor extends TransformProxy {
    constructor(readonly level: number) {
        super('Compressor', [null, level]);
    }
}
/** Stream compressor */
class WebDecompressor extends TransformProxy {
    constructor() {
        super('Decompressor', [null]);
    }
}

export const { compressSync, compress, decompressSync, decompress, compressor, decompressor } = createModule({
    compressSync: common.compress,
    decompressSync: common.decompress,
    compress: async (data, level) => await call('compress', [data, level]),
    decompress: async (data) => await call('decompress', [data]),
    Compressor: WebCompressor,
    Decompressor: WebDecompressor,
    TransformStream,
});

export const { ZSTD_VERSION } = common;

export const TYPE = 'wasm';

/** For debug usage */
export const _WasmModule = common.Module;

export default null;
