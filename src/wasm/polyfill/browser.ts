/// <reference lib="webworker" />

/** create worker */
export function createWorker(): globalThis.Worker {
    return new Worker(new URL('../worker.js', import.meta.url), {
        type: 'module',
        name: '@cloudpss/zstd/worker',
    });
}

/** add message callback */
export function onMessage(callback: (value: unknown) => unknown): void {
    self.addEventListener('message', (ev) => {
        callback(ev.data);
    });
}

/** post message */
export function postMessage(value: unknown, transfer?: Transferable[]): void {
    self.postMessage(value, transfer ?? []);
}

export const MAX_WORKERS = (globalThis.navigator?.hardwareConcurrency ?? 4) - 1;
