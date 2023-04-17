import createModule, { type Ptr } from '../prebuilds/zstd.js';
import { DEFAULT_LEVEL, MAX_SIZE } from './config.js';

const Module = await createModule();

/** Convert to buffer */
function asBuffer(data: unknown): Uint8Array {
    let buf;
    if (data instanceof ArrayBuffer) buf = Buffer.from(data);
    else if (!ArrayBuffer.isView(data)) throw new Error('Input data must be an array buffer view');
    else if (data instanceof Uint8Array) buf = data;
    else buf = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    return buf;
}

/** Convert to uint */
function uint(value: number): number {
    if (value < 0) return value + 2 ** 32;
    return value;
}

/** Finalize */
type Finalizer = () => void;
/** Helper class */
class Helper {
    /** Warp malloc to throw error */
    malloc(size: number): Ptr {
        const ptr = Module._malloc(size);
        if (ptr === 0) throw new Error('Failed to allocate memory');
        this.finalizers.push(() => Module._free(ptr));
        return ptr;
    }

    /** Copy data to heap */
    toHeap(data: Uint8Array): Ptr {
        const ptr = this.malloc(data.byteLength);
        Module.HEAPU8.set(data, ptr);
        return ptr;
    }

    /** Copy data from heap */
    fromHeap(ptr: Ptr, size: number): Uint8Array {
        // Copy buffer
        return new Uint8Array(Module.HEAPU8.buffer, ptr, size).slice();
    }

    private finalizers: Finalizer[] = [];
    /** finalize */
    finalize(): void {
        for (const fn of this.finalizers) {
            fn();
        }
        this.finalizers = [];
    }
}

/** ZStandard compress */
export function compress(data: BinaryData, level = DEFAULT_LEVEL): Uint8Array {
    if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
    const buf = asBuffer(data);
    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    const h = new Helper();
    try {
        const dstSize = uint(Module._ZSTD_compressBound(buf.byteLength));
        const src = h.toHeap(buf);
        const dst = h.malloc(dstSize);
        /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
        const sizeOrError = Module._ZSTD_compress(dst, dstSize, src, buf.byteLength, level);
        if (Module._ZSTD_isError(sizeOrError)) {
            throw new Error(`Failed to compress with code ${sizeOrError}`);
        }
        return h.fromHeap(dst, uint(sizeOrError));
    } finally {
        h.finalize();
    }
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

/** ZStandard decompress */
export function decompress(data: BinaryData): Uint8Array {
    const buf = asBuffer(data);
    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    const h = new Helper();
    try {
        const src = h.toHeap(buf);
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
        const dst = h.malloc(contentSize);
        /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
        const sizeOrError = Module._ZSTD_decompress(dst, contentSize, src, buf.byteLength);
        if (Module._ZSTD_isError(sizeOrError)) {
            throw new Error(`Failed to decompress with code ${sizeOrError}`);
        }
        return h.fromHeap(dst, uint(sizeOrError));
    } finally {
        h.finalize();
    }
}

export const TYPE = 'wasm';
