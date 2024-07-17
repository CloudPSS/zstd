/* eslint-disable jsdoc/require-jsdoc */
export type Ptr = number & { ptr: 'void*' };
export type ZSTD_CStream = number & { ptr: 'ZSTD_CStream*' };
export type ZSTD_DStream = number & { ptr: 'ZSTD_DStream*' };

export type Module = {
    readonly HEAPU8: Uint8Array;
    UTF8ToString(ptr: Ptr, maxBytesToRead?: number): string;

    _ZSTD_versionNumber(): number;
    _ZSTD_isError(code: number): number;
    _ZSTD_getErrorName(code: number): Ptr;
    _ZSTD_compressBound(size: number): number;
    _ZSTD_decompressBound(src: Ptr, size: number): number;

    _compress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number, level: number): number;
    _decompress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number): number;

    _CompressorCreate(level: number): ZSTD_CStream;
    _CompressorData(ctx: ZSTD_CStream, src: Ptr, srcSize: number): number;
    _CompressorEnd(ctx: ZSTD_CStream): number;

    _DecompressorCreate(): ZSTD_DStream;
    _DecompressorData(ctx: ZSTD_DStream, src: Ptr, srcSize: number): number;
    _DecompressorEnd(ctx: ZSTD_DStream): number;

    _malloc(size: number): Ptr;
    _free(ptr: Ptr): void;
    _usedmem(): number;
};

export default function createModule(args: {
    onCompressorData: (ctx: ZSTD_CStream, dst: Ptr, dstSize: number) => void;
    onDecompressorData: (ctx: ZSTD_DStream, dst: Ptr, dstSize: number) => void;
}): Promise<Module>;
