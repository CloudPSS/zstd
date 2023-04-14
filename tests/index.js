import assert from 'node:assert';
import { randomBytes } from 'node:crypto';

import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

assert.ok(Number.isSafeInteger(config.DEFAULT_LEVEL));
assert.ok(Number.isSafeInteger(config.MAX_SIZE));
assert.match(config.ZSTD_VERSION, /^v\d+\.\d+\.\d+$/);

assert.strictEqual(napi.TYPE, 'napi');
assert.strictEqual(wasm.TYPE, 'wasm');
assert.strictEqual(root.TYPE, 'napi');

const testBuffer1 = randomBytes(1000);
const testBuffer2 = Buffer.alloc(1000);
const testBuffer3 = new Float64Array(1000 / 8);

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

assertBufferEqual(napi.compress(testBuffer1), wasm.compress(testBuffer1));
assertBufferEqual(napi.compress(testBuffer2), wasm.compress(testBuffer2));

assertBufferEqual(napi.decompress(napi.compress(testBuffer1)), testBuffer1);
assertBufferEqual(napi.decompress(napi.compress(testBuffer2)), testBuffer2);

assertBufferEqual(wasm.decompress(wasm.compress(testBuffer1)), testBuffer1);
assertBufferEqual(wasm.decompress(wasm.compress(testBuffer2)), testBuffer2);

assertBufferEqual(napi.decompress(wasm.compress(testBuffer1)), testBuffer1);
assertBufferEqual(napi.decompress(wasm.compress(testBuffer2)), testBuffer2);

assertBufferEqual(wasm.decompress(napi.compress(testBuffer1)), testBuffer1);
assertBufferEqual(wasm.decompress(napi.compress(testBuffer2)), testBuffer2);

assertBufferEqual(napi.decompress(napi.compress(testBuffer3)), testBuffer2);
assertBufferEqual(wasm.decompress(wasm.compress(testBuffer3)), testBuffer2);
