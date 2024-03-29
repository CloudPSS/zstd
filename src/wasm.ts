import wasmModule, { type Ptr } from '../prebuilds/zstd.js';
import { createModule } from './common.js';
import { MAX_SIZE } from './config.js';

const Module = await wasmModule();

/** Convert to uint */
function uint(value: number): number {
    if (value < 0) return value + 2 ** 32;
    return value;
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

    /** Copy data from heap */
    fromHeap(ptr: Ptr, size: number): Uint8Array {
        // Copy buffer
        return new Uint8Array(Module.HEAPU8.buffer, ptr, size).slice();
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
function checkError(code: number): void {
    if (Module._ZSTD_isError(code)) {
        throw new Error(Module.UTF8ToString(Module._ZSTD_getErrorName(code)));
    }
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
//const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

export const { compress, decompress } = createModule({
    coercion: (data) => {
        if (data instanceof Uint8Array) return data;
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return new Uint8Array(data, 0, data.byteLength);
    },
    compress: (buf, level) => {
        const h = new Helper();
        try {
            const dstSize = uint(Module._ZSTD_compressBound(buf.byteLength));
            const src = h.toHeap(buf);
            const dst = h.malloc(dstSize);
            /* @See https://facebook.github.io/zstd/zstd_manual.html#Chapter3 */
            const sizeOrError = Module._compress(dst, dstSize, src, buf.byteLength, level);
            checkError(sizeOrError);
            return h.fromHeap(dst, uint(sizeOrError));
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
            return h.fromHeap(dst, uint(sizeOrError));
        } finally {
            h.finalize();
        }
    },
});

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
