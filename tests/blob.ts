import { randomBuffer, zeroBuffer, emptyRaw } from './.utils.js';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';

afterAll(() => {
    wasm.terminate();
});

describe.each([
    ['napi', napi],
    ['wasm', wasm],
])(`%s async api`, (key, api) => {
    it('should accept blob', async () => {
        for (const buf of [randomBuffer, zeroBuffer, emptyRaw]) {
            const rawBlob = new Blob([buf]);
            const compressed = await api.compress(rawBlob);
            expect(compressed).toBeInstanceOf(Uint8Array);
            const compressedBlob = new Blob([compressed]);
            const decompressed = await api.decompress(compressedBlob);
            expect(decompressed).toBeInstanceOf(Uint8Array);
            expect(decompressed).toEqual(buf);
        }
    });

    it('should reject huge blob', async () => {
        const huge = new Blob([new Uint8Array(1024 * 1024 * 1024 + 1)]);
        await expect(api.compress(huge)).rejects.toThrow('Input data is too large');
        await expect(api.decompress(huge)).rejects.toThrow('Input data is too large');
    });
});
