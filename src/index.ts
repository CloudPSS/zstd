import { DEFAULT_LEVEL, MAX_SIZE } from './config.js';

let lib: typeof import('./index.js');

/** Convert to buffer */
function asBuffer(data: ArrayBufferView): Buffer {
    if (!ArrayBuffer.isView(data)) throw new Error('data must be an array buffer view');
    if (Buffer.isBuffer(data)) return data;
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

try {
    const napi = (await import('./bindings.cjs')).default;
    lib = {
        compress: (data, level = DEFAULT_LEVEL) => {
            if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
            const buf = asBuffer(data);
            if (data.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
            return napi.compress(buf, level);
        },
        decompress: (data) => {
            const buf = asBuffer(data);
            return napi.decompress(buf, MAX_SIZE);
        },
    };
} catch {
    const wasm = await import('./web.js');
    lib = {
        compress: (data, level = DEFAULT_LEVEL) => {
            const result = wasm.compress(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompress: (data) => {
            const result = wasm.decompress(data);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
    };
}

/** 压缩 */
export function compress(data: ArrayBufferView, level = DEFAULT_LEVEL): Buffer {
    return lib.compress(data, level);
}

/** 解压缩 */
export function decompress(data: ArrayBufferView): Buffer {
    return lib.decompress(data);
}
