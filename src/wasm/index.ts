import { createModule } from '../common.js';
import * as common from './common.js';
import { createWorker, MAX_WORKERS } from '#worker-polyfill';
import type { WorkerReady, WorkerRequest, WorkerResponse } from './worker.js';

const IDLE_WORKERS: Worker[] = [];
const BUSY_WORKERS = new Set<Worker>();
const PENDING_BORROW: Array<(value: Worker) => void> = [];
let SEQ = 0;

/** create and initialize worker */
function initWorker(): Promise<Worker> {
    return new Promise((resolve, reject) => {
        const worker = createWorker();
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
            BUSY_WORKERS.add(worker);
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

/** get or wait for an idle worker */
async function borrowWorker(): Promise<Worker> {
    if (IDLE_WORKERS.length > 0) {
        const worker = IDLE_WORKERS.pop()!;
        BUSY_WORKERS.add(worker);
        return worker;
    }
    if (BUSY_WORKERS.size < MAX_WORKERS) {
        const worker = await initWorker();
        BUSY_WORKERS.add(worker);
        return worker;
    }
    return await new Promise((resolve) => {
        PENDING_BORROW.push(resolve);
    });
}

/** Call to worker */
async function call(method: WorkerRequest[1], args: WorkerRequest[2]): Promise<Uint8Array> {
    const seq = SEQ++;
    const request = [seq, method, args] as WorkerRequest;
    // make a transferable copy
    args[0] = Uint8Array.from(args[0]);

    const worker = await borrowWorker();

    return new Promise((resolve, reject) => {
        worker.postMessage(request, [args[0].buffer]);

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
            returnWorker(worker);
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
    });
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

export const { compressSync, compress, decompressSync, decompress, compressor, decompressor } = createModule({
    coercion: common.coercion,
    compressSync: common.compress,
    decompressSync: common.decompress,
    compress: (data, level) => call('compress', [data, level]),
    decompress: (data) => call('decompress', [data]),
    Compressor: common.WebCompressor,
    Decompressor: common.WebDecompressor,
    TransformStream:
        typeof TransformStream == 'function'
            ? TransformStream
            : ((await import('node:stream/web')).TransformStream as typeof TransformStream),
});

export const ZSTD_VERSION = common.ZSTD_VERSION;

export const TYPE = 'wasm';

/** For debug usage */
export const _WasmModule = common.Module;

export default null;
