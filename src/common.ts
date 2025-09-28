import { coercionInput, checkLevel } from './utils.js';

/** Buffer data */
export type BufferSource = ArrayBufferView | ArrayBuffer;

/** warp module */
export function createModule(options: {
    compressSync: (data: Uint8Array, level: number) => Uint8Array<ArrayBuffer>;
    compress: (data: Uint8Array | Blob, level: number) => Promise<Uint8Array<ArrayBuffer>>;
    decompressSync: (data: Uint8Array) => Uint8Array<ArrayBuffer>;
    decompress: (data: Uint8Array | Blob) => Promise<Uint8Array<ArrayBuffer>>;
    Compressor: new (level: number) => Transformer<BufferSource, Uint8Array<ArrayBuffer>>;
    Decompressor: new () => Transformer<BufferSource, Uint8Array<ArrayBuffer>>;
    TransformStream: typeof globalThis.TransformStream;
}): {
    /** ZStandard compress */
    compressSync: (data: BufferSource, level?: number) => Uint8Array<ArrayBuffer>;
    /** ZStandard compress */
    compress: (data: BufferSource | Blob, level?: number) => Promise<Uint8Array<ArrayBuffer>>;
    /** ZStandard decompress */
    decompressSync: (data: BufferSource) => Uint8Array<ArrayBuffer>;
    /** ZStandard decompress */
    decompress: (data: BufferSource | Blob) => Promise<Uint8Array<ArrayBuffer>>;
    /** create ZStandard stream compressor */
    compressor: (level?: number) => TransformStream<BufferSource, Uint8Array<ArrayBuffer>>;
    /** create ZStandard stream decompressor */
    decompressor: () => TransformStream<BufferSource, Uint8Array<ArrayBuffer>>;
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
            const transformer = new TransformStream<BufferSource, Uint8Array<ArrayBuffer>>(new Compressor(level));
            return transformer;
        },
        decompressor: () => {
            const transformer = new TransformStream<BufferSource, Uint8Array<ArrayBuffer>>(new Decompressor());
            return transformer;
        },
    };
}

export const createZSTD_VERSION = (versionNumber: () => number): (() => string) => {
    let _ZSTD_VERSION: string;
    return () => {
        if (_ZSTD_VERSION) return _ZSTD_VERSION;
        // MAJOR * 10000 + MINOR * 100 + PATCH to MAJOR.MINOR.PATCH
        const ZSTD_VERSION_NUMBER = versionNumber();
        const ZSTD_MAJOR = Math.floor(ZSTD_VERSION_NUMBER / 10000);
        const ZSTD_MINOR = Math.floor((ZSTD_VERSION_NUMBER % 10000) / 100);
        const ZSTD_PATCH = ZSTD_VERSION_NUMBER % 100;
        return (_ZSTD_VERSION = `${ZSTD_MAJOR}.${ZSTD_MINOR}.${ZSTD_PATCH}`);
    };
};
