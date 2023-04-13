import bindings from './binding.js';

// 3 GB
const MAX_SIZE = 3 * 1024 * 1024 * 1024;

/** 压缩 */
export function compress(data: Buffer, level = 3): Buffer {
    if (data.length > MAX_SIZE) {
        throw new Error(`Input data is too large`);
    }
    return bindings.compress(data, level);
}

/** 解压缩 */
export function decompress(data: Buffer): Buffer {
    return bindings.decompress(data, MAX_SIZE);
}
