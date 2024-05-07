import wasmModule, { type Ptr, type ZSTD_CStream, type ZSTD_DStream } from '../prebuilds/zstd.js';
import { createModule } from './common.js';
import { MAX_SIZE } from './config.js';

const Module = await wasmModule({
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
class Compressor implements Transformer<BinaryData, Uint8Array> {
    constructor(readonly level: number) {}

    private ctx: ZSTD_CStream | null = null;
    /** @inheritdoc */
    start(controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            this.ctx = checkError(Module._CompressorCreate(this.level));
            COMPRESSORS.set(this.ctx, controller);
        } catch (ex) {
            controller.error(ex);
        }
    }

    /** @inheritdoc */
    transform(chunk: BinaryData, controller: TransformStreamDefaultController<Uint8Array>): void {
        const helper = new Helper();
        try {
            const src = toUint8Array(chunk);
            const srcSize = src.byteLength;
            const srcPtr = helper.toHeap(src);
            checkError(Module._CompressorData(this.ctx!, srcPtr, srcSize));
        } catch (ex) {
            controller.error(ex);
        } finally {
            helper.finalize();
        }
    }

    /** @inheritdoc */
    flush(controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            checkError(Module._CompressorEnd(this.ctx!));
            this.ctx = null;
        } catch (ex) {
            controller.error(ex);
        }
    }
}

/** Stream decompressor */
class Decompressor implements Transformer<BinaryData, Uint8Array> {
    private ctx: ZSTD_DStream | null = null;
    /** @inheritdoc */
    start(controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            this.ctx = checkError(Module._DecompressorCreate());
            DECOMPRESSORS.set(this.ctx, controller);
        } catch (ex) {
            controller.error(ex);
        }
    }

    /** @inheritdoc */
    transform(chunk: BinaryData, controller: TransformStreamDefaultController<Uint8Array>): void {
        const helper = new Helper();
        try {
            const src = toUint8Array(chunk);
            const srcSize = src.byteLength;
            const srcPtr = helper.toHeap(src);
            checkError(Module._DecompressorData(this.ctx!, srcPtr, srcSize));
        } catch (ex) {
            controller.error(ex);
        } finally {
            helper.finalize();
        }
    }

    /** @inheritdoc */
    flush(controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            checkError(Module._DecompressorEnd(this.ctx!));
            this.ctx = null;
        } catch (ex) {
            controller.error(ex);
        }
    }
}

/** Convert to uint */
function uint(value: number): number {
    if (value < 0) return value + 2 ** 32;
    return value;
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
function toUint8Array(data: BinaryData): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(data, 0, data.byteLength);
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
//const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

export const { compress, decompress } = createModule({
    coercion: toUint8Array,
    compress: (buf, level) => {
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
    },
    decompress: (buf) => {
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
    },
});

/** create stream compressor */
export function compressor(level: number): TransformStream<BinaryData, Uint8Array> {
    return new TransformStream(new Compressor(level));
}

/** create stream decompressor */
export function decompressor(): TransformStream<BinaryData, Uint8Array> {
    return new TransformStream(new Decompressor());
}

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

export const TYPE = 'wasm';

export const _WasmModule = Module;

export default null;
