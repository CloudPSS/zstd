/// <reference lib="webworker" />

export const Worker = globalThis.Worker;

/** add message callback */
export function onMessage(callback: (value: unknown) => unknown): void {
    self.addEventListener('message', (ev) => {
        callback(ev.data);
    });
}

/** post message */
export function postMessage(value: unknown, transfer?: Transferable[]): void {
    self.postMessage(value, transfer!);
}

export const TransformStream = globalThis.TransformStream;

export const MAX_WORKERS = (globalThis.navigator?.hardwareConcurrency ?? 4) - 1;
