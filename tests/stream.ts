import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { ReadableStream as RS } from 'node:stream/web';
import { buffer } from 'node:stream/consumers';
import * as wasm from '@cloudpss/zstd/wasm';
import * as napi from '@cloudpss/zstd/napi';

const randomBuffer = randomBytes(5843);
const compressedEmpty = Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x20, 0x00, 0x01, 0x00, 0x00]);

/**
 * 转换 buffer
 */
function asBuffer(data: ArrayBufferView): Buffer {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
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

/** 生成数据 */
function hugeReadable(): ReadableStream<Uint8Array> {
    let count = 0;
    return new RS<Uint8Array>({
        pull(controller) {
            if (count++ < 1024 * 1024) {
                controller.enqueue(randomBuffer);
            } else {
                controller.close();
            }
        },
    }) as ReadableStream<Uint8Array>;
}

const MODULE = [
    ['napi', napi, Buffer],
    ['wasm', wasm, Uint8Array],
] as const;

describe.each(MODULE)('%s stream compress api', (name, module, bin) => {
    it('should compress', async () => {
        const readable = asReadable(randomBuffer);
        const data = await buffer(readable.pipeThrough(module.compressor(3)) as RS<Uint8Array>);
        expect(data).toBeInstanceOf(bin);
        expect(asBuffer(module.decompressSync(data))).toEqual(randomBuffer);
    });

    it('should decompress', async () => {
        const compressed = module.compressSync(randomBuffer);
        const readable = asReadable(compressed);
        const data = await buffer(readable.pipeThrough(module.decompressor()) as RS<Uint8Array>);
        expect(data).toBeInstanceOf(bin);
        expect(asBuffer(data)).toEqual(randomBuffer);
    });

    it('should allow empty raw data', async () => {
        const readable = asReadable(new Uint8Array());
        const result = readable.pipeThrough(module.compressor());
        const data = await buffer(result as RS<Uint8Array>);
        expect(asBuffer(data)).toEqual(compressedEmpty);
    });

    it('should allow empty compression data', async () => {
        const readable = asReadable(new Uint8Array());
        const result = readable.pipeThrough(module.decompressor());
        const data = await buffer(result as RS<Uint8Array>);
        expect(asBuffer(data)).toEqual(Buffer.alloc(0));
    });

    it('should reject bad compression data', async () => {
        const readable = asReadable(new Uint8Array(10));
        const result = readable.pipeThrough(module.decompressor());
        await expect(buffer(result as RS<Uint8Array>)).rejects.toThrow('Unknown frame descriptor');
    });

    it('should roundtrip with huge data', async () => {
        const readable = hugeReadable();
        const result = readable.pipeThrough(module.compressor(3)).pipeThrough(module.decompressor());
        const reader = result.getReader();
        let read;
        let total = 0;
        do {
            read = await reader.read();
            if (total === 0) {
                expect(read.value).toBeInstanceOf(bin);
                const gotSlice = read.value!.subarray(0, randomBuffer.length);
                const expectSlice = randomBuffer.subarray(0, gotSlice.length);
                expect(asBuffer(gotSlice)).toEqual(expectSlice);
            }
            total += read.value?.length ?? 0;
        } while (!read.done);
    });
});

describe('napi node stream compress api', () => {
    it('should compress', async () => {
        const readable = Readable.from([randomBuffer]);
        const data = await buffer(readable.pipe(new napi.Compressor(3)));
        expect(data).toBeInstanceOf(Buffer);
        expect(napi.decompressSync(data)).toEqual(randomBuffer);
    });

    it('should decompress', async () => {
        const readable = Readable.from([napi.compress(randomBuffer)]);
        const data = await buffer(readable.pipe(new napi.Decompressor()));
        expect(data).toBeInstanceOf(Buffer);
        expect(data).toEqual(randomBuffer);
    });
});
