let lib: Omit<typeof import('./napi.js'), 'TYPE'> &
    Pick<typeof import('./napi.js') | typeof import('./wasm.js'), 'TYPE'>;

try {
    lib = await import('./napi.js');
} catch {
    const { compress, decompress, TYPE, ZSTD_VERSION } = await import('./wasm.js');
    lib = {
        compress: (data, level) => {
            const result = compress(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompress: (data) => {
            const result = decompress(data);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        TYPE,
        ZSTD_VERSION,
    };
}

/** ZStandard compress */
export const compress = lib.compress;

/** ZStandard decompress */
export const decompress = lib.decompress;

export const TYPE: typeof lib.TYPE = lib.TYPE;
export const ZSTD_VERSION = lib.ZSTD_VERSION;
