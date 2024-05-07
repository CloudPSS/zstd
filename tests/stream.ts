import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { TransformStream } from 'node:stream/web';
import * as wasm from '@cloudpss/zstd/wasm';

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
