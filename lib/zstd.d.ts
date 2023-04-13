/* eslint-disable jsdoc/require-jsdoc */

import { Opaque } from 'type-fest';
type Ptr = Opaque<number, 'void*'>;
type Module = {
    readonly HEAP8: Int8Array;
    readonly HEAPU8: Uint8Array;

    _ZSTD_isError(code: number): number;
    _ZSTD_compressBound(size: number): number;
    _ZSTD_compress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number, level: number): number;
    _ZSTD_getFrameContentSize(src: number, size: number): number;
    _ZSTD_decompress(outPtr: Ptr, outSize: number, inPtr: Ptr, inSize: number): number;
    _malloc(size: number): Ptr;
    _free(ptr: Ptr): void;
};
export default function createModule(): Promise<Module>;
export const VERSION: string;
