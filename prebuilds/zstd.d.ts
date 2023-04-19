/* eslint-disable jsdoc/require-jsdoc */
type Ptr = number & { ptr: 'void*' };
type Module = {
    readonly HEAP8: Int8Array;
    readonly HEAPU8: Uint8Array;

    _ZSTD_versionNumber(): number;
    _ZSTD_isError(code: number): number;
    _ZSTD_compressBound(size: number): number;
    _ZSTD_compress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number, level: number): number;
    _ZSTD_getFrameContentSize(src: number, size: number): number;
    _ZSTD_decompress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number): number;
    _malloc(size: number): Ptr;
    _free(ptr: Ptr): void;
    _usedmem(): number;
};
export default function createModule(): Promise<Module>;
