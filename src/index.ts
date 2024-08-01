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
    const wasm = await import('./wasm/index.js');
    lib = {
        Compressor: undefined as unknown as (typeof import('./napi.js'))['Compressor'],
        Decompressor: undefined as unknown as (typeof import('./napi.js'))['Decompressor'],
        ...wasm,
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
