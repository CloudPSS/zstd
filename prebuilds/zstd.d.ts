/* eslint-disable jsdoc/require-jsdoc */
export type Ptr = number & { ptr: 'void*' };
export type Module = {
    readonly HEAP8: Int8Array;
    readonly HEAPU8: Uint8Array;
    readonly HEAP16: Int16Array;
    readonly HEAPU16: Uint16Array;
    readonly HEAP32: Int32Array;
    readonly HEAPU32: Uint32Array;
    readonly HEAPF32: Float32Array;
    readonly HEAPF64: Float64Array;

    _ZSTD_versionNumber(): number;
    _ZSTD_isError(code: number): number;
    _ZSTD_getErrorName(code: number): Ptr;
    _ZSTD_compressBound(size: number): number;
    _ZSTD_compress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number, level: number): number;
    _ZSTD_decompressBound(src: number, size: number): number;
    _ZSTD_decompress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number): number;
    _malloc(size: number): Ptr;
    _free(ptr: Ptr): void;
    _usedmem(): number;

    UTF8ToString(ptr: Ptr, maxBytesToRead?: number): string;
};

export default function createModule(): Promise<Module>;
