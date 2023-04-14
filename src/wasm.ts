import createModule from '../prebuilds/zstd.js';
import { DEFAULT_LEVEL, MAX_SIZE } from './config.js';

const Module = await createModule();

/** Convert to buffer */
function asBuffer(data: unknown): Uint8Array {
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (!ArrayBuffer.isView(data)) throw new Error('data must be an array buffer view');
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/** Convert to uint */
function uint(value: number): number {
    if (value < 0) return value + 2 ** 32;
    return value;
}

/** ZStandard compress */
export function compress(data: BinaryData, level = DEFAULT_LEVEL): Uint8Array {
    if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
    const buf = asBuffer(data);
    const bound = uint(Module._ZSTD_compressBound(buf.byteLength));
    if (bound > MAX_SIZE) throw new Error(`Input data is too large`);
    const compressed = Module._malloc(bound);
    const src = Module._malloc(buf.byteLength);
    Module.HEAPU8.set(buf, src);
    try {
        /*
        @See https://zstd.docsforge.com/dev/api/ZSTD_compress/
            size_t ZSTD_compress( void* dst, size_t dstCapacity, const void* src, size_t srcSize, int compressionLevel);
            Compresses `src` content as a single zstd compressed frame into already allocated `dst`.
            Hint : compression runs faster if `dstCapacity` >=  `ZSTD_compressBound(srcSize)`.
            @return : compressed size written into `dst` (<= `dstCapacity),
                        or an error code if it fails (which can be tested using ZSTD_isError()).
        */
        const sizeOrError = Module._ZSTD_compress(compressed, bound, src, buf.byteLength, level);
        if (Module._ZSTD_isError(sizeOrError)) {
            throw new Error(`Failed to compress with code ${sizeOrError}`);
        }
        // Copy buffer
        return new Uint8Array(Module.HEAPU8.buffer, compressed, uint(sizeOrError)).slice();
    } finally {
        Module._free(compressed);
        Module._free(src);
    }
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

/** ZStandard decompress */
export function decompress(data: BinaryData): Uint8Array {
    const buf = asBuffer(data);
    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    const src = Module._malloc(buf.byteLength);
    Module.HEAP8.set(buf, src);
    const contentSize = uint(Module._ZSTD_getFrameContentSize(src, buf.byteLength));
    if (contentSize === ZSTD_CONTENTSIZE_ERROR) {
        throw new Error('Invalid compressed data');
    }
    if (contentSize === ZSTD_CONTENTSIZE_UNKNOWN) {
        throw new Error('Unknown content size');
    }
    if (contentSize > MAX_SIZE) {
        throw new Error(`Content size is too large: ${contentSize}`);
    }
    const heap = Module._malloc(contentSize);
    try {
        /*
        @See https://zstd.docsforge.com/dev/api/ZSTD_decompress/
            compressedSize : must be the exact size of some number of compressed and/or skippable frames.
            dstCapacity is an upper bound of originalSize to regenerate.
            If user cannot imply a maximum upper bound, it's better to use streaming mode to decompress data.
            @return: the number of bytes decompressed into dst (<= dstCapacity), or an errorCode if it fails (which can be tested using ZSTD_isError()).
        */
        const sizeOrError = Module._ZSTD_decompress(heap, contentSize, src, buf.byteLength);
        if (Module._ZSTD_isError(sizeOrError)) {
            throw new Error(`Failed to decompress with code ${sizeOrError}`);
        }
        // Copy buffer
        return new Uint8Array(Module.HEAPU8.buffer, heap, uint(sizeOrError)).slice();
    } finally {
        Module._free(heap);
        Module._free(src);
    }
}

export const TYPE = 'wasm';
