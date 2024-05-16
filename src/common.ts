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
    compressSync: (data: TBinary, level: number) => TBinary;
    compress: (data: TBinary, level: number) => Promise<TBinary>;
    decompressSync: (data: TBinary) => TBinary;
    decompress: (data: TBinary) => Promise<TBinary>;
    Compressor: new (level: number) => Transformer<BinaryData, TBinary>;
    Decompressor: new () => Transformer<BinaryData, TBinary>;
    TransformStream: typeof globalThis.TransformStream;
}): {
    /** ZStandard compress */
    compressSync: (data: BinaryData, level?: number) => Uint8Array;
    /** ZStandard compress */
    compress: (data: BinaryData, level?: number) => Promise<Uint8Array>;
    /** ZStandard decompress */
    decompressSync: (data: BinaryData) => Uint8Array;
    /** ZStandard decompress */
    decompress: (data: BinaryData) => Promise<Uint8Array>;
    /** create ZStandard stream compressor */
    compressor: (level?: number) => TransformStream<BinaryData, Uint8Array>;
    /** create ZStandard stream decompressor */
    decompressor: () => TransformStream<BinaryData, Uint8Array>;
} {
    const { coercion, compressSync, compress, decompressSync, decompress, Compressor, Decompressor, TransformStream } =
        options;
    return {
        compressSync: (data, level) => {
            level = checkLevel(level);
            checkInput(data);
            const input = coercion(data);
            const output = compressSync(input, level);
            return output;
        },
        compress: async (data, level) => {
            level = checkLevel(level);
            checkInput(data);
            const input = coercion(data);
            const output = await compress(input, level);
            return output;
        },
        decompressSync: (data) => {
            checkInput(data);
            const input = coercion(data);
            const output = decompressSync(input);
            return output;
        },
        decompress: async (data) => {
            checkInput(data);
            const input = coercion(data);
            const output = await decompress(input);
            return output;
        },
        compressor: (level) => {
            level = checkLevel(level);
            const transformer = new TransformStream<BinaryData, TBinary>(new Compressor(level));
            return transformer;
        },
        decompressor: () => {
            const transformer = new TransformStream<BinaryData, TBinary>(new Decompressor());
            return transformer;
        },
    };
}
