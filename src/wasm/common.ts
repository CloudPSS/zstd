import wasmModule, { type Ptr, type Module as WasmModule } from '../../prebuilds/zstd.js';
import { createZSTD_VERSION } from '../common.js';
import { MAX_SIZE } from '../config.js';

export const ModuleReady = (async () => {
    Module = await wasmModule({
        onCompressorData(ctx, dst, dstSize) {
            _onCompressorData?.(ctx, dst, dstSize);
        },
        onDecompressorData(ctx, dst, dstSize) {
            _onDecompressorData?.(ctx, dst, dstSize);
        },
    });
})();
export let Module: WasmModule;

let _onCompressorData: Parameters<typeof wasmModule>[0]['onCompressorData'];
let _onDecompressorData: Parameters<typeof wasmModule>[0]['onDecompressorData'];

/** Set callbacks for wasm module */
export function setWasmCallbacks(callbacks: Parameters<typeof wasmModule>[0]): void {
    _onCompressorData = callbacks.onCompressorData;
    _onDecompressorData = callbacks.onDecompressorData;
}

/** Convert to uint */
export function uint(value: number): number {
    if (value < 0) return Number(value) + 2 ** 32;
    return Number(value);
}

/** Copy data from heap */
export function fromHeap(ptr: Ptr, size: number): Uint8Array {
    // Copy buffer
    return new Uint8Array(Module.HEAPU8.buffer, ptr, size).slice();
}

/** Helper class */
export class Helper {
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
export function checkError<T extends number>(code: T): T {
    if (Module._ZSTD_isError(code)) {
        throw new Error(Module.UTF8ToString(Module._ZSTD_getErrorName(code)));
    }
    return code;
}

const ZSTD_CONTENTSIZE_ERROR = 2 ** 32 - 2;
//const ZSTD_CONTENTSIZE_UNKNOWN = 2 ** 32 - 1;

export const ZSTD_VERSION = createZSTD_VERSION(() => Module._ZSTD_versionNumber());

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
