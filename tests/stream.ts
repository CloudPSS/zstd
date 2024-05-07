import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { TransformStream } from 'node:stream/web';
import * as wasm from '@cloudpss/zstd/wasm';
import * as napi from '@cloudpss/zstd/napi';

const randomBuffer = randomBytes(1000);
/**
 * 转换 buffer
 */
function asBuffer(data: ArrayBufferView): Buffer {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

describe('wasm stream compress api', () => {
    it('should compress', async () => {
        const readable = Readable.toWeb(Readable.from([randomBuffer]));
        const data = await buffer(
            Readable.fromWeb(readable.pipeThrough(wasm.compressor(3) as TransformStream<BinaryData, Uint8Array>)),
        );
        expect(data).toBeInstanceOf(Uint8Array);
        expect(asBuffer(wasm.decompress(data))).toEqual(randomBuffer);
    });

    it('should decompress', async () => {
        const readable = Readable.toWeb(Readable.from([wasm.compress(randomBuffer)]));
        const data = await buffer(
            Readable.fromWeb(readable.pipeThrough(wasm.decompressor() as TransformStream<BinaryData, Uint8Array>)),
        );
        expect(data).toBeInstanceOf(Uint8Array);
        expect(asBuffer(data)).toEqual(randomBuffer);
    });
});

describe('napi stream compress api', () => {
    it('should compress', async () => {
        const readable = Readable.toWeb(Readable.from([randomBuffer]));
        const data = await buffer(
            Readable.fromWeb(readable.pipeThrough(napi.compressor(3) as TransformStream<BinaryData, Uint8Array>)),
        );
        expect(data).toBeInstanceOf(Buffer);
        expect(napi.decompress(data)).toEqual(randomBuffer);
    });

    it('should decompress', async () => {
        const readable = Readable.toWeb(Readable.from([napi.compress(randomBuffer)]));
        const data = await buffer(
            Readable.fromWeb(readable.pipeThrough(napi.decompressor() as TransformStream<BinaryData, Uint8Array>)),
        );
        expect(data).toBeInstanceOf(Buffer);
        expect(data).toEqual(randomBuffer);
    });
});

describe('napi node stream compress api', () => {
    it('should compress', async () => {
        const readable = Readable.from([randomBuffer]);
        const data = await buffer(readable.pipe(new napi.Compressor(3)));
        expect(data).toBeInstanceOf(Buffer);
        expect(napi.decompress(data)).toEqual(randomBuffer);
    });

    it('should decompress', async () => {
        const readable = Readable.from([napi.compress(randomBuffer)]);
        const data = await buffer(readable.pipe(new napi.Decompressor()));
        expect(data).toBeInstanceOf(Buffer);
        expect(data).toEqual(randomBuffer);
    });
});
