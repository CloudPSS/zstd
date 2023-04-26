import * as wasm from '@cloudpss/zstd/wasm';
import { randomBytes } from 'node:crypto';

describe('should throw on error', () => {
    beforeAll(() => {
        const dummy = Buffer.from('dummy');
        const compressed = wasm.compress(dummy);
        wasm.decompress(compressed);
    });

    let uncompressed = randomBytes(1_071_000_000);
    it('compress', () => {
        expect(() => wasm.compress(uncompressed)).toThrow(/Allocation error/);
    });
});
