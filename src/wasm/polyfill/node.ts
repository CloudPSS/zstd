import os from 'node:os';
import { Worker as NodeWorker, type Transferable, parentPort } from 'node:worker_threads';

/** Worker polyfill */
export class Worker extends EventTarget implements AbstractWorker {
    constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super();
        this._worker = new NodeWorker(scriptURL, options);
        this._worker.on('message', (data: unknown) => {
            const ev = new MessageEvent('message', { data });
            this.dispatchEvent(ev);
            if (this.onmessage) {
                this.onmessage(ev);
            }
        });
        this._worker.on('messageerror', (data: unknown) => {
            const ev = new MessageEvent('messageerror', { data });
            this.dispatchEvent(ev);
            if (this.onmessageerror) {
                this.onmessageerror(ev);
            }
        });
        this._worker.on('error', (error) => {
            const ev = new Event('error', {}) as ErrorEvent;
            Object.defineProperty(ev, 'error', { value: error, configurable: true });
            this.dispatchEvent(ev);
            if (this.onerror) {
                this.onerror(ev);
            }
        });
    }
    onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
    onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null;
    protected readonly _worker: NodeWorker;
    /** @inheritdoc */
    postMessage(data: unknown, transfer?: Transferable[] | { transfer?: Transferable[] }): void {
        let t: Transferable[] = [];
        if (!transfer) {
            //
        } else if (Array.isArray(transfer)) {
            t = transfer;
        } else if (transfer.transfer) {
            t = transfer.transfer;
        }
        this._worker.postMessage(data, t as readonly Transferable[]);
    }
    /** @inheritdoc */
    terminate(): void {
        void this._worker.terminate();
    }
}

/** add message callback */
export function onMessage(callback: (value: unknown) => unknown): void {
    parentPort!.on('message', callback);
}

/** post message */
export function postMessage(value: unknown, transfer?: Transferable[]): void {
    parentPort!.postMessage(value, transfer);
}

export const MAX_WORKERS = Math.max(os.availableParallelism?.() ?? os.cpus().length, 2) - 1;

export { TransformStream } from 'node:stream/web';
