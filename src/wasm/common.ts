import wasmModule, { type Ptr, type ZSTD_CStream, type ZSTD_DStream } from '../../prebuilds/zstd.js';
import { checkInput } from '../common.js';
import { MAX_SIZE } from '../config.js';

export const Module = await wasmModule({
    onCompressorData(ctx, dst, dstSize) {
        const compressor = COMPRESSORS.get(ctx);
        if (!compressor) throw new Error('Invalid compressor context');
        compressor.enqueue(fromHeap(dst, dstSize));
    },
    onDecompressorData(ctx, dst, dstSize) {
        const decompressor = DECOMPRESSORS.get(ctx);
        if (!decompressor) throw new Error('Invalid decompressor context');
        decompressor.enqueue(fromHeap(dst, dstSize));
    },
});

const COMPRESSORS = new Map<ZSTD_CStream, TransformStreamDefaultController<Uint8Array>>();
const DECOMPRESSORS = new Map<ZSTD_DStream, TransformStreamDefaultController<Uint8Array>>();

/** Stream compressor */
export class WebCompressor implements Transformer<BinaryData, Uint8Array> {
    constructor(readonly level: number) {}

    private ctx: ZSTD_CStream | null = null;
    /** @inheritdoc */
    start(controller: TransformStreamDefaultController<Uint8Array>): void {
        this.ctx = checkError(Module._CompressorCreate(this.level));
        COMPRESSORS.set(this.ctx, controller);
    }

    /** @inheritdoc */
    transform(chunk: BinaryData): void {
        const helper = new Helper();
        try {
            checkInput(chunk);
            const src = coercion(chunk);
            const srcSize = src.byteLength;
            const srcPtr = helper.toHeap(src);
            checkError(Module._CompressorData(this.ctx!, srcPtr, srcSize));
        } finally {
            helper.finalize();
        }
    }

    /** @inheritdoc */
    flush(): void {
        checkError(Module._CompressorEnd(this.ctx!));
        this.ctx = null;
    }
}

/** Stream decompressor */
export class WebDecompressor implements Transformer<BinaryData, Uint8Array> {
    private ctx: ZSTD_DStream | null = null;
    /** @inheritdoc */
    start(controller: TransformStreamDefaultController<Uint8Array>): void {
        this.ctx = checkError(Module._DecompressorCreate());
        DECOMPRESSORS.set(this.ctx, controller);
    }

    /** @inheritdoc */
    transform(chunk: BinaryData): void {
        const helper = new Helper();
        try {
            checkInput(chunk);
            const src = coercion(chunk);
            const srcSize = src.byteLength;
            const srcPtr = helper.toHeap(src);
            checkError(Module._DecompressorData(this.ctx!, srcPtr, srcSize));
        } finally {
            helper.finalize();
        }
    }

    /** @inheritdoc */
    flush(): void {
        checkError(Module._DecompressorEnd(this.ctx!));
        this.ctx = null;
    }
}

/** Convert to uint */
function uint(value: number): number {
    if (value < 0) return Number(value) + 2 ** 32;
    return Number(value);
}

/** Copy data from heap */
function fromHeap(ptr: Ptr, size: number): Uint8Array {
    // Copy buffer
    return new Uint8Array(Module.HEAPU8.buffer, ptr, size).slice();
}

/** Helper class */
class Helper {
    /** Warp malloc to throw error */
    malloc(size: number): Ptr {
        const ptr = Module._malloc(size);
        if (ptr === 0) throw new Error('Failed to allocate memory');
        this.allocated.push(ptr);
        return ptr;
    }

    /** Copy data to heap */
    toHeap(data: Uint8Array): Ptr {
        const ptr = this.malloc(data.byteLength);
        Module.HEAPU8.set(data, ptr);
        return ptr;
    }

    private allocated: Ptr[] = [];
    /** finalize */
    finalize(): void {
        for (const ptr of this.allocated) {
            Module._free(ptr);
        }
        this.allocated = [];
    }
}

/** check zstd error */
function checkError<T extends number>(code: T): T {
    if (Module._ZSTD_isError(code)) {
        throw new Error(Module.UTF8ToString(Module._ZSTD_getErrorName(code)));
    }
    return code;
}

/** to Uint8Array */
export function coercion(data: BinaryData): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(data, 0, data.byteLength);
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
//const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

let _ZSTD_VERSION: string;
export const ZSTD_VERSION = (): string => {
    if (_ZSTD_VERSION) return _ZSTD_VERSION;
    // MAJOR * 10000 + MINOR * 100 + PATCH to MAJOR.MINOR.PATCH
    const ZSTD_VERSION_NUMBER = Module._ZSTD_versionNumber();
    const ZSTD_MAJOR = Math.floor(ZSTD_VERSION_NUMBER / 10000);
    const ZSTD_MINOR = Math.floor((ZSTD_VERSION_NUMBER % 10000) / 100);
    const ZSTD_PATCH = ZSTD_VERSION_NUMBER % 100;
    return (_ZSTD_VERSION = `${ZSTD_MAJOR}.${ZSTD_MINOR}.${ZSTD_PATCH}`);
};

/** compress */
export function compress(buf: Uint8Array, level: number): Uint8Array {
    const h = new Helper();
    try {
        const dstSize = uint(Module._ZSTD_compressBound(buf.byteLength));
        const src = h.toHeap(buf);
        const dst = h.malloc(dstSize);
        /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
        const sizeOrError = Module._compress(dst, dstSize, src, buf.byteLength, level);
        checkError(sizeOrError);
        return fromHeap(dst, uint(sizeOrError));
    } finally {
        h.finalize();
    }
}

/** decompress */
export function decompress(buf: Uint8Array): Uint8Array {
    const h = new Helper();
    try {
        const src = h.toHeap(buf);
        const dstSize = uint(Module._ZSTD_decompressBound(src, buf.byteLength));
        if (dstSize === ZSTD_CONTENTSIZE_ERROR) {
            throw new Error('Invalid compressed data');
        }
        if (dstSize > MAX_SIZE) {
            throw new Error(`Content size is too large: ${dstSize}`);
        }
        const dst = h.malloc(dstSize);
        /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
        const sizeOrError = Module._decompress(dst, dstSize, src, buf.byteLength);
        checkError(sizeOrError);
        return fromHeap(dst, uint(sizeOrError));
    } finally {
        h.finalize();
    }
}
