import createModule from '../lib/zstd.js';

const Module = await createModule();

/** 压缩 */
export function compress(buf: Uint8Array, level = 4): Uint8Array {
    const bound = Module._ZSTD_compressBound(buf.byteLength);
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
        return new Uint8Array(Module.HEAPU8.buffer, compressed, sizeOrError).slice();
    } finally {
        Module._free(compressed);
        Module._free(src);
    }
}

const ZSTD_CONTENTSIZE_ERROR = -2;
const ZSTD_CONTENTSIZE_UNKNOWN = -1;

/** 解压 */
export function decompress(buf: Uint8Array, maxSize?: number): Uint8Array {
    const src = Module._malloc(buf.byteLength);
    Module.HEAP8.set(buf, src);
    const contentSize = Module._ZSTD_getFrameContentSize(src, buf.byteLength);
    if (contentSize === ZSTD_CONTENTSIZE_ERROR) {
        throw new Error('Invalid compressed data');
    }
    if (contentSize === ZSTD_CONTENTSIZE_UNKNOWN) {
        throw new Error('Unknown content size');
    }
    if (maxSize && contentSize > maxSize) {
        throw new Error(`Content size is too large`);
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
        // Uint8Array.prototype.slice() return copied buffer.
        return new Uint8Array(Module.HEAPU8.buffer, heap, sizeOrError).slice();
    } finally {
        Module._free(heap);
        Module._free(src);
    }
}
