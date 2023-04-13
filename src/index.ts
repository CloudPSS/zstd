let lib: typeof import('./bindings.cjs');
try {
    lib = (await import('./bindings.cjs')).default;
} catch {
    const wasm = await import('./web.js');
    lib = {
        compress: (data, level) => {
            const result = wasm.compress(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompress: (data, maxSize) => {
            const result = wasm.decompress(data, maxSize);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
    };
}

/** 最大接受的 buffer 尺寸 */
const MAX_SIZE = 2 * 1024 * 1024 * 1024;

/** 压缩 */
export function compress(data: Buffer, level = 4): Buffer {
    if (data.length > MAX_SIZE) {
        throw new Error(`Input data is too large`);
    }
    return lib.compress(data, level);
}

/** 解压缩 */
export function decompress(data: Buffer): Buffer {
    return lib.decompress(data, MAX_SIZE);
}
