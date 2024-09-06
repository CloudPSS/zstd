import { it, after, mock } from 'node:test';
import assert from 'node:assert/strict';

const nodeGypBuild = mock.fn((path: string): never => {
    throw new Error(`MOCK(Can't load bindings)`);
});
mock.module('node-gyp-build', {
    defaultExport: nodeGypBuild,
});

after(async () => {
    const wasm = await import('@cloudpss/zstd/wasm');
    wasm.terminate();
});

it('should fallback to wasm', async () => {
    const root = await import('@cloudpss/zstd');
    assert(nodeGypBuild.mock.callCount() === 1);
    assert(typeof nodeGypBuild.mock.calls[0]!.arguments[0] == 'string');
    assert.equal(root.TYPE, 'wasm');
});

it('should returns uint8array', async () => {
    const root = await import('@cloudpss/zstd');
    assert.equal(root.TYPE, 'wasm');

    assert(!(root.compressSync(Buffer.alloc(10)) instanceof Buffer));
    assert(!(root.decompressSync(root.compressSync(Buffer.alloc(10))) instanceof Buffer));

    assert(!((await root.compress(Buffer.alloc(10))) instanceof Buffer));
    assert(!((await root.decompress(await root.compress(Buffer.alloc(10)))) instanceof Buffer));
});
