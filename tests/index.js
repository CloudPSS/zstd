import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
// Add this to make sure the bindings are loaded
import '../dist/bindings.cjs';
import * as node from '../dist/index.js';
import * as wasm from '../dist/web.js';

const testBuffer1 = randomBytes(1000);
const testBuffer2 = Buffer.alloc(1000);

/**
 * Test if two buffers are equal
 *
 * @param {Uint8Array} a Buffer to compare
 * @param {Uint8Array} b Buffer to compare
 */
function assertBufferEqual(a, b) {
    assert.strictEqual(a.length, b.length, `Lengths are not equal: ${a.length} !== ${b.length}`);
    for (let i = 0; i < a.length; i++) {
        assert.strictEqual(a[i], b[i], `Buffers are not equal at index ${i}: ${a[i]} !== ${b[i]}`);
    }
}

assertBufferEqual(node.compress(testBuffer1), wasm.compress(testBuffer1));
assertBufferEqual(node.compress(testBuffer2), wasm.compress(testBuffer2));

assertBufferEqual(node.decompress(node.compress(testBuffer1)), testBuffer1);
assertBufferEqual(node.decompress(node.compress(testBuffer2)), testBuffer2);

assertBufferEqual(wasm.decompress(wasm.compress(testBuffer1)), testBuffer1);
assertBufferEqual(wasm.decompress(wasm.compress(testBuffer2)), testBuffer2);

assertBufferEqual(node.decompress(wasm.compress(testBuffer1)), testBuffer1);
assertBufferEqual(node.decompress(wasm.compress(testBuffer2)), testBuffer2);

assertBufferEqual(wasm.decompress(node.compress(testBuffer1)), testBuffer1);
assertBufferEqual(wasm.decompress(node.compress(testBuffer2)), testBuffer2);
