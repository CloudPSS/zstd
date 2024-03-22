/* eslint-disable jsdoc/require-jsdoc */
export type Ptr = number & { ptr: 'void*' };
export type Module = {
    readonly HEAPU8: Uint8Array;
    UTF8ToString(ptr: Ptr, maxBytesToRead?: number): string;

    _ZSTD_versionNumber(): number;
    _ZSTD_isError(code: number): number;
    _ZSTD_getErrorName(code: number): Ptr;
    _ZSTD_compressBound(size: number): number;
    _ZSTD_decompressBound(src: number, size: number): number;
    _compress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number, level: number): number;
    _decompress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number): number;
    _malloc(size: number): Ptr;
    _free(ptr: Ptr): void;
    _usedmem(): number;
};

export default function createModule(): Promise<Module>;
