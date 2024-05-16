let lib: Omit<typeof import('./napi.js'), 'TYPE' | `_${string}`> &
    Pick<typeof import('./napi.js') | typeof import('./wasm/index.js'), 'TYPE'>;

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
    const { compress, decompress, compressSync, decompressSync, ...rest } = await import('./wasm/index.js');
    lib = {
        compressSync: (data: BinaryData, level?: number): Buffer => {
            const result = compressSync(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompressSync: (data: BinaryData): Buffer => {
            const result = decompressSync(data);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        compress: async (data: BinaryData, level?: number): Promise<Buffer> => {
            const result = await compress(data, level);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        decompress: async (data: BinaryData): Promise<Buffer> => {
            const result = await decompress(data);
            return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
        },
        Compressor: undefined as unknown as (typeof import('./napi.js'))['Compressor'],
        Decompressor: undefined as unknown as (typeof import('./napi.js'))['Decompressor'],
        ...rest,
    };
}

/** ZStandard compress */
export const { compressSync } = lib;

/** ZStandard decompress */
export const { decompressSync } = lib;

/** ZStandard compress */
export const { compress } = lib;

/** ZStandard decompress */
export const { decompress } = lib;

/** NodeJs Transform stream Compressor */
export const { Compressor } = lib;

/** NodeJs Transform stream Decompressor */
export const { Decompressor } = lib;

/** The type of the current module. */
export const TYPE: (typeof import('./napi.js'))['TYPE'] | (typeof import('./wasm/index.js'))['TYPE'] = lib.TYPE;

/** The version of the zstd library. */
export const { ZSTD_VERSION } = lib;

export default null;
