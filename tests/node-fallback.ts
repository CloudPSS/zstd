import { jest } from '@jest/globals';

jest.mock('node-gyp-build', () => {
    return jest.fn((): never => {
        throw new Error(`Can't load bindings`);
    });
});

it('should fallback to wasm', async () => {
    const root = await import('@cloudpss/zstd');
    expect(jest.requireMock('node-gyp-build')).toBeCalledWith(expect.any(String));
    expect(root.TYPE).toBe('wasm');
});

it('should returns buffer', async () => {
    const root = await import('@cloudpss/zstd');
    expect(root.TYPE).toBe('wasm');
    expect(root.compress(Buffer.alloc(10))).toBeInstanceOf(Buffer);
    expect(root.decompress(root.compress(Buffer.alloc(10)))).toBeInstanceOf(Buffer);
});
