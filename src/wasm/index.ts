import { coercionInput } from '../utils.js';
import { createModule, type BufferSource } from '../common.js';
import * as common from './common.js';
import type { WorkerRequest, WorkerResponse } from './worker.js';
import { WorkerPool, type TaggedWorker } from '@cloudpss/worker/pool';
import { Worker as WorkerPolyfill } from '@cloudpss/worker/ponyfill';

await common.ModuleReady;

const POOL = new WorkerPool(
    () => {
        // Write in a way that bundler can detect and create proper worker files
        return typeof Worker == 'function'
            ? new Worker(new URL('./worker.js', import.meta.url), {
                  type: 'module',
                  name: `@cloudpss/zstd/worker`,
              })
            : new WorkerPolyfill(new URL('./worker.js', import.meta.url), {
                  type: 'module',
                  name: `@cloudpss/zstd/worker`,
              });
    },
    {
        name: '@cloudpss/zstd/worker-pool',
        minIdleWorkers: 1,
        creationDelay: 5,
    },
);

const MAX_COPY_OVERHEAD = 1024 * 16; // 16KB

let SEQ = 0;
/** Call to a specific worker */
async function callWorker(
    worker: TaggedWorker,
    method: WorkerRequest[1],
    args: WorkerRequest[2],
    transferable?: Transferable[],
): Promise<Uint8Array<ArrayBuffer>> {
    const seq = SEQ++;
    const request = [seq, method, args] as WorkerRequest;
    if (
        transferable == null &&
        ArrayBuffer.isView(args[0]) &&
        args[0].byteLength + MAX_COPY_OVERHEAD < args[0].buffer.byteLength
    ) {
        // Avoid OOM of chrome when copying large buffers
        const buffer = args[0].buffer.slice(args[0].byteOffset, args[0].byteOffset + args[0].byteLength);
        args[0] = new Uint8Array(buffer);
        transferable = [buffer];
    }
    return new Promise((resolve, reject) => {
        if (transferable?.length) {
            worker.postMessage(request, { transfer: transferable });
        } else {
            worker.postMessage(request);
        }

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
async function call(method: WorkerRequest[1], args: WorkerRequest[2]): Promise<Uint8Array<ArrayBuffer>> {
    const worker = await POOL.borrowWorker();
    try {
        return await callWorker(worker, method, args);
    } finally {
        POOL.returnWorker(worker);
    }
}

/** cleanup all workers */
export function terminate(): void {
    POOL.destroy();
}

/** get current worker status */
export function workers(): { total: number; idle: number; busy: number; initializing: number } {
    return POOL.status();
}

/** Proxy to worker */
abstract class TransformProxy implements Transformer<BufferSource, Uint8Array<ArrayBuffer>> {
    constructor(
        protected readonly method: WorkerRequest[1],
        protected readonly args: WorkerRequest[2],
    ) {}
    protected ctx: TaggedWorker | null = null;
    protected controller!: TransformStreamDefaultController<Uint8Array<ArrayBuffer>>;

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
            if (ctx) POOL.destroyWorker(ctx);
        } else {
            if (ctx) POOL.returnWorker(ctx);
        }
        this.ctx = null;
    }
    /** @inheritdoc */
    async start(controller: TransformStreamDefaultController<Uint8Array<ArrayBuffer>>): Promise<void> {
        this.controller = controller;
        try {
            this.ctx = await POOL.borrowWorker();
            this.ctx.addEventListener('message', this.onMessage);
            await callWorker(this.ctx, this.method, this.args);
        } catch (ex) {
            this.end(ex);
        }
    }

    /** @inheritdoc */
    transform(chunk: BufferSource): void {
        try {
            const src = coercionInput(chunk, false);
            const transferable = src.byteLength === src.buffer.byteLength ? [src.buffer] : [];
            this.ctx!.postMessage([null, 'push', [src]] satisfies WorkerRequest, transferable);
        } catch (ex) {
            this.end(ex);
        }
    }

    /** @inheritdoc */
    async flush(): Promise<void> {
        try {
            await callWorker(this.ctx!, 'end', []);
            this.end(null);
        } catch (ex) {
            this.end(ex);
        }
    }
}

/** Stream compressor */
export class WebCompressor extends TransformProxy {
    constructor(readonly level: number) {
        super('Compressor', [level]);
    }
}
/** Stream compressor */
export class WebDecompressor extends TransformProxy {
    constructor() {
        super('Decompressor', []);
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
