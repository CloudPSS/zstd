import { jest } from '@jest/globals';

jest.mock('node-gyp-build', () => {
    return jest.fn((): never => {
        throw new Error(`MOCK(Can't load bindings)`);
    });
});

it('should fallback to wasm', async () => {
    const root = await import('@cloudpss/zstd');
    expect(jest.requireMock('node-gyp-build')).toHaveBeenCalledWith(expect.any(String));
    expect(root.TYPE).toBe('wasm');
});

it('should returns buffer', async () => {
    const root = await import('@cloudpss/zstd');
    expect(root.TYPE).toBe('wasm');

    expect(root.compressSync(Buffer.alloc(10))).toBeInstanceOf(Buffer);
    expect(root.decompressSync(root.compressSync(Buffer.alloc(10)))).toBeInstanceOf(Buffer);

    await expect(root.compress(Buffer.alloc(10))).resolves.toBeInstanceOf(Buffer);
    await expect(root.decompress(await root.compress(Buffer.alloc(10)))).resolves.toBeInstanceOf(Buffer);
});
