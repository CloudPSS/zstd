import os from 'node:os';
import { Worker as NodeWorker, type TransferListItem, parentPort } from 'node:worker_threads';

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
            if (this.onmessage) {
                this.onmessage(ev);
            }
        });
        this._worker.on('error', (error) => {
            const ev = new ErrorEvent('error', { error });
            this.dispatchEvent(ev);
            if (this.onerror) {
                this.onerror(ev);
            }
        });
    }
    onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
    onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null;
    private readonly _worker: NodeWorker;
    /** @inheritdoc */
    postMessage(data: unknown, transfer?: Transferable[] | StructuredSerializeOptions): void {
        let t: Transferable[] = [];
        if (!transfer) {
            //
        } else if (Array.isArray(transfer)) {
            t = transfer;
        } else if ('transfer' in transfer) {
            t = transfer.transfer;
        }
        this._worker.postMessage(data, t as readonly TransferListItem[]);
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
    parentPort!.postMessage(value, transfer as TransferListItem[] | undefined);
}

export const MAX_WORKERS =
    Math.max(typeof os.availableParallelism == 'function' ? os.availableParallelism() : os.cpus().length, 2) - 1;

export { TransformStream } from 'node:stream/web';
