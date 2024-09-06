import { jest } from '@jest/globals';
import { emptyCompressed, emptyRaw } from './.utils.js';

jest.unstable_mockModule('#worker-polyfill', () => ({
    onMessage: jest.fn((callback: (data: unknown) => void) => (messageCallback = callback)),
    postMessage: jest.fn(),
}));

let messageCallback: (data: unknown) => void;
const { onMessage, postMessage } = await import('#worker-polyfill');

test('wasm worker init', async () => {
    await import('../dist/wasm/worker.js');
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith('ready');
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(expect.any(Function));
    expect(messageCallback).toBeInstanceOf(Function);
});

test('compress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([1, 'compress', [new Uint8Array([1, 2, 3]), 6]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([1, expect.any(Uint8Array)], [expect.any(ArrayBuffer)]);
});

test('decompress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([2, 'decompress', [emptyCompressed]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([2, emptyRaw], [expect.any(ArrayBuffer)]);
});

test('decompress error', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([2, 'decompress', [new Uint8Array([1, 2, 3])]]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([2, null, expect.any(Error)]);
});

test('stream compress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([3, 'Compressor', [null, 6]]);
    messageCallback([4, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([5, 'flush', [null]]);
    expect(postMessage).toHaveBeenCalledTimes(4);
    expect(postMessage).toHaveBeenNthCalledWith(1, [3, null]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [4, null]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [null, expect.any(Uint8Array)], [expect.any(ArrayBuffer)]);
    expect(postMessage).toHaveBeenNthCalledWith(4, [5, null]);
});

test('stream decompress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([3, 'Decompressor', [null]]);
    messageCallback([4, 'transform', [emptyCompressed]]);
    messageCallback([5, 'flush', [null]]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [3, null]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [4, null]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [5, null]);
});

test('stream decompress error', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([6, 'Decompressor', [null]]);
    messageCallback([7, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([8, 'flush', [null]]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [6, null]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [7, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [8, null, expect.any(Error)]);
});

test('invalid context', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([10, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([11, 'flush', [null]]);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, [10, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [11, null, expect.any(Error)]);
});

test('invalid context instance', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([20, 'Decompressor', [null]]);
    messageCallback([21, 'Decompressor', [null]]);
    messageCallback([22, 'Compressor', [null]]);
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage).toHaveBeenNthCalledWith(1, [20, null]);
    expect(postMessage).toHaveBeenNthCalledWith(2, [21, null, expect.any(Error)]);
    expect(postMessage).toHaveBeenNthCalledWith(3, [22, null, expect.any(Error)]);
});

test('invalid method', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([30, 'invalid', []]);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith([30, null, expect.any(Error)]);
});
