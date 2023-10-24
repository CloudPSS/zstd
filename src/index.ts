let lib: Omit<typeof import('./napi.js'), 'TYPE' | `_${string}`> &
    Pick<typeof import('./napi.js') | typeof import('./wasm.js'), 'TYPE'>;

try {
    lib = await import('./napi.js');
} catch {
    const { compress, decompress, ...rest } = await import('./wasm.js');
    lib = {
        compress: (data: BinaryData, level?: number): Buffer => {
            const result = compress(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompress: (data: BinaryData): Buffer => {
            const result = decompress(data);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        ...rest,
    };
}

/** ZStandard compress */
export const { compress } = lib;

/** ZStandard decompress */
export const { decompress } = lib;

/** The type of the current module. */
export const TYPE: (typeof import('./napi.js'))['TYPE'] | (typeof import('./wasm.js'))['TYPE'] = lib.TYPE;

/** The version of the zstd library. */
export const { ZSTD_VERSION } = lib;

export default null;
