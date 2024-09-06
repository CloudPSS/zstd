import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBuffer, zeroBuffer, emptyRaw } from './.utils.js';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';

after(() => {
    wasm.terminate();
});

for (const [key, api] of [
    ['napi', napi],
    ['wasm', wasm],
] as const) {
    describe(`${key} async api`, () => {
        it('should accept blob', async () => {
            for (const buf of [randomBuffer, zeroBuffer, emptyRaw]) {
                const rawBlob = new Blob([buf]);
                const compressed = await api.compress(rawBlob);
                assert(compressed instanceof Uint8Array);
                const compressedBlob = new Blob([compressed]);
                const decompressed = await api.decompress(compressedBlob);
                assert(decompressed instanceof Uint8Array);
                assert.deepStrictEqual(decompressed, buf);
            }
        });

        it('should reject huge blob', async () => {
            const huge = new Blob([new Uint8Array(1024 * 1024 * 1024 + 1)]);
            await assert.rejects(async () => await api.compress(huge), { message: 'Input data is too large' });
            await assert.rejects(async () => await api.decompress(huge), { message: 'Input data is too large' });
        });
    });
}
