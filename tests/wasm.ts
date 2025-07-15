import * as wasm from '@cloudpss/zstd/wasm';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { MAX_WORKERS } from '#worker-polyfill';

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

describe('should not consume input buffer', () => {
    it('full chunk', async () => {
        const input = new Uint8Array([1, 2, 3]);
        await wasm.compress(input);
        expect(input.buffer.byteLength).toBe(3);
    });
    it('partial chunk', async () => {
        const LEN = 100_000;
        const input = new Uint8Array(LEN);
        const slice = input.subarray(0, 2);
        const compressed = await wasm.compress(slice);
        expect(input.buffer.byteLength).toBe(LEN);
        const decompressed = await wasm.decompress(compressed);
        expect(decompressed).toBeInstanceOf(Uint8Array);
        expect(decompressed).toEqual(slice);
    });
});

describe('should work with correct parallism', () => {
    it('worker count', () => {
        expect(MAX_WORKERS).toBeGreaterThan(0);
    });

    it('run some compressions', async () => {
        await wasm.compress(randomBytes(10));
        expect(wasm.workers()).toEqual({ idle: 1, busy: 0 });
        const uncompressed = randomBytes(10_000_000);
        const compressed = Promise.all(Array.from({ length: MAX_WORKERS - 1 }, () => wasm.compress(uncompressed)));
        expect(wasm.workers()).toEqual({ idle: 0, busy: MAX_WORKERS - 1 });
        for (const c of await compressed) {
            expect(c).toBeInstanceOf(Uint8Array);
        }
        expect(wasm.workers()).toEqual({ idle: MAX_WORKERS - 1, busy: 0 });
    });

    it('run MAX_WORKERS compressions', async () => {
        const uncompressed = randomBytes(10_000_000);
        const compressed = Promise.all(Array.from({ length: MAX_WORKERS }, () => wasm.compress(uncompressed)));
        expect(wasm.workers()).toEqual({ idle: 0, busy: MAX_WORKERS });
        for (const c of await compressed) {
            expect(c).toBeInstanceOf(Uint8Array);
        }
        expect(wasm.workers()).toEqual({ idle: MAX_WORKERS, busy: 0 });
    });

    it('run over MAX_WORKERS compressions', async () => {
        const uncompressed = randomBytes(10_000_000);
        const compressed = Promise.all(Array.from({ length: MAX_WORKERS + 10 }, () => wasm.compress(uncompressed)));
        expect(wasm.workers()).toEqual({ idle: 0, busy: MAX_WORKERS });
        for (const c of await compressed) {
            expect(c).toBeInstanceOf(Uint8Array);
        }
        expect(wasm.workers()).toEqual({ idle: MAX_WORKERS, busy: 0 });
    });
});

describe('should work without node buffer', () => {
    beforeAll(() => {
        // @ts-expect-error remove global Buffer
        globalThis.Buffer = undefined;
    });
    afterAll(() => {
        globalThis.Buffer = Buffer;
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

afterAll(() => {
    wasm.terminate();
});
