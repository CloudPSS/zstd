import { jest } from '@jest/globals';

jest.mock('node-gyp-build', () => {
    return jest.fn(() => {
        throw new Error(`Can't load bindings`);
    });
});

const delay = (/** @type {number | undefined} */ timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

it('should fallback to wasm', async () => {
    const root = await import('@cloudpss/zstd');
    // Test will fail in node 14 without this
    await delay(1000);
    expect(jest.requireMock('node-gyp-build')).toBeCalledWith(expect.any(String));
    expect(root.TYPE).toBe('wasm');
});

it('should returns buffer', async () => {
    const root = await import('@cloudpss/zstd');
    // Test will fail in node 14 without this
    await delay(1000);
    expect(root.TYPE).toBe('wasm');
    expect(root.compress(Buffer.alloc(10))).toBeInstanceOf(Buffer);
    expect(root.decompress(root.compress(Buffer.alloc(10)))).toBeInstanceOf(Buffer);
});
