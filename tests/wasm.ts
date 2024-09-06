import * as wasm from '@cloudpss/zstd/wasm';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

describe('should have no memory leak', () => {
    beforeAll(() => {
        const dummy = randomBytes(10_000_000);
        const compressed = wasm.compressSync(dummy);
        wasm.decompressSync(compressed);
    });

    const uncompressed = randomBytes(10_000_000);
    let compressed: Uint8Array;
    it('compress', () => {
        const before = wasm._WasmModule._usedmem();
        compressed = wasm.compressSync(uncompressed);
        const after = wasm._WasmModule._usedmem();
        expect(after - before).toBe(0);
    });
    it('decompress', () => {
        const before = wasm._WasmModule._usedmem();
        const decompressed = wasm.decompressSync(compressed);
        const after = wasm._WasmModule._usedmem();
        expect(after - before).toBe(0);
        expect(uncompressed.equals(decompressed)).toBe(true);
    });
});

describe('should work without node buffer', () => {
    beforeAll(() => {
        // @ts-expect-error remove global Buffer
        global.Buffer = undefined;
    });
    afterAll(() => {
        global.Buffer = Buffer;
    });
    const uncompressed = randomBytes(10_000_000);
    let compressed: Uint8Array;
    it('compress', () => {
        compressed = wasm.compressSync(uncompressed.buffer);
        expect(compressed).toBeInstanceOf(Uint8Array);
        expect(compressed).not.toBeInstanceOf(Buffer);
    });
    it('decompress', () => {
        const decompressed = wasm.decompressSync(compressed.buffer);
        expect(decompressed).toBeInstanceOf(Uint8Array);
        expect(decompressed).not.toBeInstanceOf(Buffer);
        expect(uncompressed.equals(decompressed)).toBe(true);
    });
});
