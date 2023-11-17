import { DEFAULT_LEVEL } from './config.js';
import { MAX_SIZE, MIN_LEVEL, MAX_LEVEL } from './config.js';

/** check input before coercion */
export function checkInput(input: unknown): asserts input is BinaryData {
    if (input == null || typeof input != 'object') throw new TypeError(`Input data must be BinaryData`);

    if (ArrayBuffer.isView(input)) {
        if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
        return;
    }

    if (
        (typeof ArrayBuffer == 'function' && input instanceof ArrayBuffer) ||
        (typeof SharedArrayBuffer == 'function' && input instanceof SharedArrayBuffer)
    ) {
        if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
        return;
    }

    throw new TypeError(`Input data must be BinaryData`);
}

/** check and clamp compress level */
export function checkLevel(level: number | undefined): number {
    if (level == null) return DEFAULT_LEVEL;
    if (typeof level != 'number') throw new Error(`level must be an integer`);
    if (Number.isNaN(level)) return DEFAULT_LEVEL;
    if (level < MIN_LEVEL) return MIN_LEVEL;
    if (level > MAX_LEVEL) return MAX_LEVEL;
    return Math.trunc(level);
}

/** warp module */
export function createModule<TBinary extends Uint8Array>(options: {
    coercion: (input: BinaryData) => TBinary;
    compress: (data: TBinary, level: number) => TBinary;
    decompress: (data: TBinary) => TBinary;
}): {
    /** ZStandard compress */
    compress: (data: BinaryData, level?: number) => Uint8Array;
    /** ZStandard decompress */
    decompress: (data: BinaryData) => Uint8Array;
} {
    const { coercion, compress, decompress } = options;
    return {
        compress: (data: BinaryData, level = DEFAULT_LEVEL) => {
            level = checkLevel(level);
            checkInput(data);
            const input = coercion(data);
            const output = compress(input, level);
            return output;
        },
        decompress: (data: BinaryData) => {
            checkInput(data);
            const input = coercion(data);
            const output = decompress(input);
            return output;
        },
    };
}
