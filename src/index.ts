import type { Simplify, Constructor } from 'type-fest';
import type { WebCompressor as WC, WebDecompressor as WD } from './napi.js';

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
        ...wasm,
        Compressor: undefined as unknown as (typeof import('./napi.js'))['Compressor'],
        Decompressor: undefined as unknown as (typeof import('./napi.js'))['Decompressor'],
        WebCompressor: wasm.WebCompressor satisfies Constructor<Simplify<WC>, [level: number]> as unknown as new (
            level: number,
        ) => WC,
        WebDecompressor: wasm.WebDecompressor satisfies Constructor<Simplify<WD>, []> as unknown as new () => WD,
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

/** Web stream ZStandard compressor */
export const { compressor } = lib;

/** Web stream ZStandard decompressor */
export const { decompressor } = lib;

/** Web stream ZStandard compress transformer */
export const { WebCompressor } = lib;

/** Web stream ZStandard decompress transformer */
export const { WebDecompressor } = lib;

/** NodeJs Transform stream compressor */
export const { Compressor } = lib;

/** NodeJs Transform stream decompressor */
export const { Decompressor } = lib;

/** The type of the current module. */
export const TYPE: (typeof import('./napi.js'))['TYPE'] | (typeof import('./wasm/index.js'))['TYPE'] = lib.TYPE;

/** The version of the zstd library. */
export const { ZSTD_VERSION } = lib;

export default null;
