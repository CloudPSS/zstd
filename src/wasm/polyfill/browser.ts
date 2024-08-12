/// <reference lib="webworker" />

export const { Worker, TransformStream } = globalThis;

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

export const MAX_WORKERS = Math.max(globalThis.navigator?.hardwareConcurrency ?? 4, 2) - 1;
