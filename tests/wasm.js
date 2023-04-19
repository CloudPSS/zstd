import * as wasm from '@cloudpss/zstd/wasm';
import { randomBytes } from 'node:crypto';

describe('should have no memory leak', () => {
    beforeAll(() => {
        const dummy = Buffer.from('dummy');
        const compressed = wasm.compress(dummy);
        wasm.decompress(compressed);
    });

    let uncompressed = randomBytes(10_000_000);
    /** @type {Uint8Array} */
    let compressed;
    it('compress', () => {
        const before = wasm._WasmModule._usedmem();
        compressed = wasm.compress(uncompressed);
        const after = wasm._WasmModule._usedmem();
        expect(after - before).toBe(0);
    });
    it('decompress', () => {
        const before = wasm._WasmModule._usedmem();
        const decompressed = wasm.decompress(compressed);
        const after = wasm._WasmModule._usedmem();
        expect(after - before).toBe(0);
        expect(uncompressed.equals(decompressed)).toBe(true);
    });
});
