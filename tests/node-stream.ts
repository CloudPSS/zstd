import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { asUint8Array } from './.utils.js';
import * as napi from '@cloudpss/zstd/napi';

const randomBuffer = asUint8Array(randomBytes(5843));

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
        expect(asUint8Array(data)).toEqual(randomBuffer);
    });
});
