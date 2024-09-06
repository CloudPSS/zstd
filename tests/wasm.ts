import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import * as wasm from '@cloudpss/zstd/wasm';
import { randomBytes } from 'node:crypto';

describe('should have no memory leak', () => {
    before(() => {
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
        assert.equal(after - before, 0);
    });
    it('decompress', () => {
        const before = wasm._WasmModule._usedmem();
        const decompressed = wasm.decompressSync(compressed);
        const after = wasm._WasmModule._usedmem();
        assert.equal(after - before, 0);
        assert.ok(uncompressed.equals(decompressed));
    });
});

describe('should work without node buffer', () => {
    before(() => {
        // @ts-expect-error remove global Buffer
        global.Buffer = undefined;
    });
    after(() => {
        global.Buffer = Buffer;
    });
    const uncompressed = randomBytes(10_000_000);
    let compressed: Uint8Array;
    it('compress', () => {
        compressed = wasm.compressSync(uncompressed.buffer);
        assert.ok(compressed instanceof Uint8Array);
        assert.ok(!(compressed instanceof Buffer));
    });
    it('decompress', () => {
        const decompressed = wasm.decompressSync(compressed.buffer);
        assert.ok(decompressed instanceof Uint8Array);
        assert.ok(!(decompressed instanceof Buffer));
        assert.ok(uncompressed.equals(decompressed));
    });
});
