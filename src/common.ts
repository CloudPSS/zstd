import { coercionInput, checkLevel } from './utils.js';

/** warp module */
export function createModule(options: {
    compressSync: (data: Uint8Array, level: number) => Uint8Array;
    compress: (data: Uint8Array | Blob, level: number) => Promise<Uint8Array>;
    decompressSync: (data: Uint8Array) => Uint8Array;
    decompress: (data: Uint8Array | Blob) => Promise<Uint8Array>;
    Compressor: new (level: number) => Transformer<BufferSource, Uint8Array>;
    Decompressor: new () => Transformer<BufferSource, Uint8Array>;
    TransformStream: typeof globalThis.TransformStream;
}): {
    /** ZStandard compress */
    compressSync: (data: BufferSource, level?: number) => Uint8Array;
    /** ZStandard compress */
    compress: (data: BufferSource | Blob, level?: number) => Promise<Uint8Array>;
    /** ZStandard decompress */
    decompressSync: (data: BufferSource) => Uint8Array;
    /** ZStandard decompress */
    decompress: (data: BufferSource | Blob) => Promise<Uint8Array>;
    /** create ZStandard stream compressor */
    compressor: (level?: number) => TransformStream<BufferSource, Uint8Array>;
    /** create ZStandard stream decompressor */
    decompressor: () => TransformStream<BufferSource, Uint8Array>;
} {
    const { compressSync, compress, decompressSync, decompress, Compressor, Decompressor, TransformStream } = options;
    return {
        compressSync: (data, level) => {
            level = checkLevel(level);
            const input = coercionInput(data, false);
            const output = compressSync(input, level);
            return output;
        },
        compress: async (data, level) => {
            level = checkLevel(level);
            const input = coercionInput(data, true);
            const output = await compress(input, level);
            return output;
        },
        decompressSync: (data) => {
            const input = coercionInput(data, false);
            const output = decompressSync(input);
            return output;
        },
        decompress: async (data) => {
            const input = coercionInput(data, true);
            const output = await decompress(input);
            return output;
        },
        compressor: (level) => {
            level = checkLevel(level);
            const transformer = new TransformStream<BufferSource, Uint8Array>(new Compressor(level));
            return transformer;
        },
        decompressor: () => {
            const transformer = new TransformStream<BufferSource, Uint8Array>(new Decompressor());
            return transformer;
        },
    };
}
