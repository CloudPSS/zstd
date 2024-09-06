import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ReadableStream as RS } from 'node:stream/web';
import { buffer } from 'node:stream/consumers';
import { asUint8Array, emptyCompressed, emptyRaw } from './.utils.js';
import * as wasm from '@cloudpss/zstd/wasm';
import * as napi from '@cloudpss/zstd/napi';

const randomBuffer = asUint8Array(randomBytes(5843));

/**
 * 转换 buffer
 */
function asReadable(data: Uint8Array): ReadableStream<Uint8Array> {
    let ptr = 0;
    return new RS<Uint8Array>({
        pull(controller) {
            const chunk = data.slice(ptr, ptr + 1024);
            if (chunk.byteLength) {
                controller.enqueue(chunk);
            } else {
                controller.close();
            }
            ptr += 1024;
        },
    }) as ReadableStream<Uint8Array>;
}

after(() => {
    wasm.terminate();
});

const MODULE = [
    ['napi', napi],
    ['wasm', wasm],
] as const;

for (const [name, module] of MODULE) {
    describe(`${name} stream compress api`, () => {
        it('should compress', async () => {
            const readable = asReadable(randomBuffer);
            const data = await buffer(readable.pipeThrough(module.compressor(3)) as RS<Uint8Array>);
            assert.ok(data instanceof Buffer);
            assert.deepEqual(module.decompressSync(data), randomBuffer);
        });

        it('should decompress', async () => {
            const compressed = module.compressSync(randomBuffer);
            const readable = asReadable(compressed);
            const data = await buffer(readable.pipeThrough(module.decompressor()) as RS<Uint8Array>);
            assert.ok(data instanceof Buffer);
            assert.deepEqual(asUint8Array(data), randomBuffer);
        });

        it('should allow empty raw data', async () => {
            const readable = asReadable(emptyRaw);
            const result = readable.pipeThrough(module.compressor());
            const data = await buffer(result as RS<Uint8Array>);
            assert.deepEqual(asUint8Array(data), emptyCompressed);
        });

        it('should allow empty compression data', async () => {
            const readable = asReadable(emptyRaw);
            const result = readable.pipeThrough(module.decompressor());
            const data = await buffer(result as RS<Uint8Array>);
            assert.deepEqual(data, Buffer.alloc(0));
        });

        it('should reject bad compression data', async () => {
            const readable = asReadable(new Uint8Array(10));
            const result = readable.pipeThrough(module.decompressor());
            await assert.rejects(async () => await buffer(result as RS<Uint8Array>), {
                message: 'Unknown frame descriptor',
            });
        });
    });
}
