import createModule, { type Module, type Ptr } from '../prebuilds/zstd.js';
import { DEFAULT_LEVEL, MAX_SIZE } from './config.js';

/** Convert to buffer */
function asBuffer(data: unknown): Uint8Array {
    let buf;
    if (data instanceof ArrayBuffer) buf = new Uint8Array(data, 0, data.byteLength);
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

export let _WasmModule: Module;

/** Initialize wasm module */
function initializeModule(): Module {
    if (!_WasmModule) {
        _WasmModule = createModule();
    }
    return _WasmModule;
}

/** Helper class */
class Helper {
    readonly Module = initializeModule();
    /** Warp malloc to throw error */
    malloc(size: number): Ptr {
        const ptr = this.Module._malloc(size);
        if (ptr === 0) throw new Error('Failed to allocate memory');
        this.allocated.push(ptr);
        return ptr;
    }

    /** Copy data to heap */
    toHeap(data: Uint8Array): Ptr {
        const ptr = this.malloc(data.byteLength);
        this.Module.HEAPU8.set(data, ptr);
        return ptr;
    }

    /** Copy data from heap */
    fromHeap(ptr: Ptr, size: number): Uint8Array {
        // Copy buffer
        return new Uint8Array(this.Module.HEAPU8.buffer, ptr, size).slice();
    }

    private allocated: Ptr[] = [];
    /** finalize */
    finalize(): void {
        for (const ptr of this.allocated) {
            this.Module._free(ptr);
        }
        this.allocated = [];
    }
    /** check zstd error */
    checkError(code: number): void {
        if (this.Module._ZSTD_isError(code)) {
            throw new Error(this.Module.UTF8ToString(this.Module._ZSTD_getErrorName(code)));
        }
    }
}

/** ZStandard compress */
export function compress(data: BinaryData, level = DEFAULT_LEVEL): Uint8Array {
    if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
    const buf = asBuffer(data);
    const h = new Helper();
    try {
        const dstSize = uint(h.Module._ZSTD_compressBound(buf.byteLength));
        const src = h.toHeap(buf);
        const dst = h.malloc(dstSize);
        /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
        const sizeOrError = h.Module._ZSTD_compress(dst, dstSize, src, buf.byteLength, level);
        h.checkError(sizeOrError);
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
    const h = new Helper();
    try {
        const src = h.toHeap(buf);
        const contentSize = uint(h.Module._ZSTD_getFrameContentSize(src, buf.byteLength));
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
        const sizeOrError = h.Module._ZSTD_decompress(dst, contentSize, src, buf.byteLength);
        h.checkError(sizeOrError);
        return h.fromHeap(dst, uint(sizeOrError));
    } finally {
        h.finalize();
    }
}

export const ZSTD_VERSION = (): string => {
    // MAJOR * 10000 + MINOR * 100 + PATCH to MAJOR.MINOR.PATCH
    const ZSTD_VERSION_NUMBER = new Helper().Module._ZSTD_versionNumber();
    const ZSTD_MAJOR = Math.floor(ZSTD_VERSION_NUMBER / 10000);
    const ZSTD_MINOR = Math.floor((ZSTD_VERSION_NUMBER % 10000) / 100);
    const ZSTD_PATCH = ZSTD_VERSION_NUMBER % 100;
    return `${ZSTD_MAJOR}.${ZSTD_MINOR}.${ZSTD_PATCH}`;
};

export const TYPE = 'wasm';
