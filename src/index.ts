import type * as Napi from './napi.js';
import type * as Wasm from './wasm.js';

const lib: Omit<typeof Napi, 'TYPE'> & Pick<typeof Wasm | typeof Napi, 'TYPE'> = await (async () => {
    try {
        return await import('./napi.js');
    } catch {
        const { compress, decompress, TYPE } = await import('./wasm.js');
        return {
            compress: (data, level) => {
                const result = compress(data, level);
                return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
            },
            decompress: (data) => {
                const result = decompress(data);
                return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
            },
            TYPE,
        };
    }
})();

/** ZStandard compress */
export const compress = lib.compress;

/** ZStandard decompress */
export const decompress = lib.decompress;

export const TYPE: typeof import('./napi.js').TYPE | typeof import('./wasm.js').TYPE = lib.TYPE;
