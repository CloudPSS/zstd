import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
        assert.ok(data instanceof Buffer);
        assert.deepEqual(napi.decompressSync(data), randomBuffer);
    });

    it('should decompress', async () => {
        const readable = Readable.from([napi.compress(randomBuffer)]);
        const data = await buffer(readable.pipe(new napi.Decompressor()));
        assert.ok(data instanceof Buffer);
        assert.deepEqual(asUint8Array(data), randomBuffer);
    });
});
