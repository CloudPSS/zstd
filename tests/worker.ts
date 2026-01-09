import { jest } from '@jest/globals';
import { availableParallelism } from 'node:os';
import { emptyCompressed, emptyRaw } from './.utils.js';

beforeAll(async () => {
    jest.unstable_mockModule('@cloudpss/worker/ponyfill', () => ({
        onMessage: jest.fn((callback: (data: unknown) => void) => (messageCallback = callback)),
        postMessage: jest.fn(),
        HARDWARE_CONCURRENCY: availableParallelism(),
        IS_WORKER_THREAD: true,
        Worker: null,
    }));
    ({ onMessage, postMessage } = await import('@cloudpss/worker/ponyfill'));
});

afterAll(() => {
    jest.unstable_unmockModule('@cloudpss/worker/pool');
});

let messageCallback: (data: unknown) => void;
let onMessage: typeof import('@cloudpss/worker/ponyfill').onMessage,
    postMessage: typeof import('@cloudpss/worker/ponyfill').postMessage;

let workerLoaded = false;
async function loadWorker() {
    if (!workerLoaded) {
        await import('../dist/wasm/worker.js');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        workerLoaded = true;
    }
}

test('wasm worker init', async () => {
    await loadWorker();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.any(Object));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(expect.any(Function));
    expect(messageCallback).toBeInstanceOf(Function);
});

test('compress', async () => {
    await loadWorker();
    messageCallback([1, 'compress', [new Uint8Array([1, 2, 3]), 6]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([1, expect.any(Uint8Array)], [expect.any(ArrayBuffer)]);
});

test('decompress', async () => {
    await loadWorker();
    messageCallback([2, 'decompress', [emptyCompressed]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([2, emptyRaw], [expect.any(ArrayBuffer)]);
});

test('decompress error', async () => {
    await loadWorker();
    messageCallback([2, 'decompress', [new Uint8Array([1, 2, 3])]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([2, null, expect.any(Error)]);
});

test('stream compress', async () => {
    await loadWorker();
    messageCallback([3, 'Compressor', [6]]);
    messageCallback([4, 'push', [new Uint8Array([1, 2, 3])]]);
    messageCallback([5, 'end', []]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [3]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [null, expect.any(Uint8Array)], [expect.any(ArrayBuffer)]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [5]);
});

test('stream decompress', async () => {
    await loadWorker();
    messageCallback([3, 'Decompressor', []]);
    messageCallback([4, 'push', [emptyCompressed]]);
    messageCallback([5, 'end', []]);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, [3]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [5]);
});

test('stream decompress error', async () => {
    await loadWorker();
    messageCallback([6, 'Decompressor', []]);
    messageCallback([7, 'push', [new Uint8Array([1, 2, 3])]]);
    messageCallback([8, 'end', []]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [6]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [null, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [8, null, expect.any(Error)]);
});

test('invalid context', async () => {
    await loadWorker();
    messageCallback([10, 'push', [new Uint8Array([1, 2, 3])]]);
    messageCallback([11, 'end', []]);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, [10, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [11, null, expect.any(Error)]);
});

test('invalid context instance', async () => {
    await loadWorker();
    messageCallback([20, 'Decompressor', []]);
    messageCallback([21, 'Decompressor', []]);
    messageCallback([22, 'Compressor', [4]]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [20]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [21, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [22, null, expect.any(Error)]);
});

test('invalid method', async () => {
    await loadWorker();
    messageCallback([30, 'invalid', []]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([30, null, expect.any(Error)]);
});
