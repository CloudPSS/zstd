let lib: Omit<typeof import('./napi.js'), 'TYPE' | `_${string}`> &
    Pick<typeof import('./napi.js') | typeof import('./wasm.js'), 'TYPE'>;

try {
    lib = await import('./napi.js');
} catch (ex) {
    // only emit warning if running in node, checking for process is not enough since some polyfills define it
    if (
        typeof process == 'object' &&
        typeof process.emitWarning == 'function' &&
        typeof process.versions?.node == 'string'
    ) {
        process.emitWarning(
            `Failed to load napi bindings, falling back to wasm bindings: ${(ex as Error).message}`,
            undefined,
            'ZSTD',
        );
    }
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
        Compressor: undefined as unknown as (typeof import('./napi.js'))['Compressor'],
        Decompressor: undefined as unknown as (typeof import('./napi.js'))['Decompressor'],
        ...rest,
    };
}

/** ZStandard compress */
export const { compress } = lib;

/** ZStandard decompress */
export const { decompress } = lib;

/** NodeJs Transform stream Compressor */
export const { Compressor } = lib;

/** NodeJs Transform stream Decompressor */
export const { Decompressor } = lib;

/** The type of the current module. */
export const TYPE: (typeof import('./napi.js'))['TYPE'] | (typeof import('./wasm.js'))['TYPE'] = lib.TYPE;

/** The version of the zstd library. */
export const { ZSTD_VERSION } = lib;

export default null;
