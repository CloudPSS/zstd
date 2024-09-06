import { test, before, after, mock, beforeEach, afterEach, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCompressed, emptyRaw } from './.utils.js';

let messageCallback: (data: unknown) => void;
const mockPolyfill = {
    onMessage: mock.fn<typeof import('#worker-polyfill').onMessage>(
        (callback: (data: unknown) => void) => (messageCallback = callback),
    ),
    postMessage: mock.fn<typeof import('#worker-polyfill').postMessage>(),
};
const { onMessage, postMessage } = mockPolyfill;
mock.module('#worker-polyfill', {
    namedExports: mockPolyfill,
});

afterEach(() => {
    onMessage.mock.resetCalls();
    postMessage.mock.resetCalls();
});

test('wasm worker init', async () => {
    await import('../dist/wasm/worker.js');
    assert.equal(postMessage.mock.callCount(), 1);
    assert.equal(postMessage.mock.calls[0]!.arguments[0], 'ready');
    assert.equal(onMessage.mock.callCount(), 1);
    assert(onMessage.mock.calls[0]!.arguments[0] instanceof Function);
    assert.equal(messageCallback, onMessage.mock.calls[0]!.arguments[0]);
});

test('compress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([1, 'compress', [new Uint8Array([1, 2, 3]), 6]]);
    assert.equal(postMessage.mock.callCount(), 1);
    assert(Array.isArray(postMessage.mock.calls[0]!.arguments[0]));
    assert.equal(postMessage.mock.calls[0]!.arguments[0][0], 1);
    assert(postMessage.mock.calls[0]!.arguments[0][1] instanceof Uint8Array);
    assert(postMessage.mock.calls[0]!.arguments[1]![0] instanceof ArrayBuffer);
});

test('decompress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([2, 'decompress', [emptyCompressed]]);
    assert.equal(postMessage.mock.callCount(), 1);
    assert(Array.isArray(postMessage.mock.calls[0]!.arguments[0]));
    assert.equal(postMessage.mock.calls[0]!.arguments[0][0], 2);
    assert.deepEqual(postMessage.mock.calls[0]!.arguments[0][1], emptyRaw);
    assert(postMessage.mock.calls[0]!.arguments[1]![0] instanceof ArrayBuffer);
});

test('decompress error', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([2, 'decompress', [new Uint8Array([1, 2, 3])]]);
    assert.equal(postMessage.mock.callCount(), 1);
    assert(Array.isArray(postMessage.mock.calls[0]!.arguments[0]));
    assert.equal(postMessage.mock.calls[0]!.arguments[0][0], 2);
    assert.equal(postMessage.mock.calls[0]!.arguments[0][1], null);
    assert(postMessage.mock.calls[0]!.arguments[0][2] instanceof Error);
});

test('stream compress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([3, 'Compressor', [null, 6]]);
    messageCallback([4, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([5, 'flush', [null]]);
    assert.equal(postMessage.mock.callCount(), 4);
    assert.deepEqual(postMessage.mock.calls[0]!.arguments[0], [3, null]);
    assert.deepEqual(postMessage.mock.calls[1]!.arguments[0], [4, null]);
    assert(Array.isArray(postMessage.mock.calls[2]!.arguments[0]));
    assert.equal(postMessage.mock.calls[2]!.arguments[0][0], null);
    assert(postMessage.mock.calls[2]!.arguments[0][1] instanceof Uint8Array);
    assert(postMessage.mock.calls[2]!.arguments[1]![0] instanceof ArrayBuffer);
    assert.deepEqual(postMessage.mock.calls[3]!.arguments[0], [5, null]);
});

test('stream decompress', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([3, 'Decompressor', [null]]);
    messageCallback([4, 'transform', [emptyCompressed]]);
    messageCallback([5, 'flush', [null]]);
    assert.equal(postMessage.mock.callCount(), 3);
    assert.deepEqual(postMessage.mock.calls[0]!.arguments[0], [3, null]);
    assert.deepEqual(postMessage.mock.calls[1]!.arguments[0], [4, null]);
    assert.deepEqual(postMessage.mock.calls[2]!.arguments[0], [5, null]);
});

test('stream decompress error', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([6, 'Decompressor', [null]]);
    messageCallback([7, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([8, 'flush', [null]]);
    assert.equal(postMessage.mock.callCount(), 3);
    assert.deepEqual(postMessage.mock.calls[0]!.arguments[0], [6, null]);
    assert(Array.isArray(postMessage.mock.calls[1]!.arguments[0]));
    assert.equal(postMessage.mock.calls[1]!.arguments[0][0], 7);
    assert.equal(postMessage.mock.calls[1]!.arguments[0][1], null);
    assert(postMessage.mock.calls[1]!.arguments[0][2] instanceof Error);
    assert(Array.isArray(postMessage.mock.calls[2]!.arguments[0]));
    assert.equal(postMessage.mock.calls[2]!.arguments[0][0], 8);
    assert.equal(postMessage.mock.calls[2]!.arguments[0][1], null);
    assert(postMessage.mock.calls[2]!.arguments[0][2] instanceof Error);
});

test('invalid context', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([10, 'transform', [new Uint8Array([1, 2, 3])]]);
    messageCallback([11, 'flush', [null]]);
    assert.equal(postMessage.mock.callCount(), 2);
    assert(Array.isArray(postMessage.mock.calls[0]!.arguments[0]));
    assert.equal(postMessage.mock.calls[0]!.arguments[0][0], 10);
    assert.equal(postMessage.mock.calls[0]!.arguments[0][1], null);
    assert(postMessage.mock.calls[0]!.arguments[0][2] instanceof Error);
    assert(Array.isArray(postMessage.mock.calls[1]!.arguments[0]));
    assert.equal(postMessage.mock.calls[1]!.arguments[0][0], 11);
    assert.equal(postMessage.mock.calls[1]!.arguments[0][1], null);
    assert(postMessage.mock.calls[1]!.arguments[0][2] instanceof Error);
});

test('invalid context instance', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([20, 'Decompressor', [null]]);
    messageCallback([21, 'Decompressor', [null]]);
    messageCallback([22, 'Compressor', [null]]);
    assert.equal(postMessage.mock.callCount(), 3);
    assert.deepEqual(postMessage.mock.calls[0]!.arguments[0], [20, null]);
    assert(Array.isArray(postMessage.mock.calls[1]!.arguments[0]));
    assert.equal(postMessage.mock.calls[1]!.arguments[0][0], 21);
    assert.equal(postMessage.mock.calls[1]!.arguments[0][1], null);
    assert(postMessage.mock.calls[1]!.arguments[0][2] instanceof Error);
    assert(Array.isArray(postMessage.mock.calls[2]!.arguments[0]));
    assert.equal(postMessage.mock.calls[2]!.arguments[0][0], 22);
    assert.equal(postMessage.mock.calls[2]!.arguments[0][1], null);
    assert(postMessage.mock.calls[2]!.arguments[0][2] instanceof Error);
});

test('invalid method', async () => {
    await import('../dist/wasm/worker.js');
    messageCallback([30, 'invalid', []]);
    assert.equal(postMessage.mock.callCount(), 1);
    assert(Array.isArray(postMessage.mock.calls[0]!.arguments[0]));
    assert.equal(postMessage.mock.calls[0]!.arguments[0][0], 30);
    assert.equal(postMessage.mock.calls[0]!.arguments[0][1], null);
    assert(postMessage.mock.calls[0]!.arguments[0][2] instanceof Error);
});
