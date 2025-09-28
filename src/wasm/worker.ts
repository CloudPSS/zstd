import type { Ptr, ZSTD_CStream, ZSTD_DStream } from '../../prebuilds/zstd.js';
import { onMessage, postMessage } from '#worker-polyfill';
import { checkError, compress, decompress, fromHeap, Helper, Module, ModuleReady, setWasmCallbacks } from './common.js';
import { checkLevel } from '../utils.js';

/** Worker request */
export type WorkerRequest =
    | [seq: number, 'compress', [Uint8Array | Blob, level: number]]
    | [seq: number, 'decompress', [Uint8Array | Blob]]
    | [seq: number, 'Decompressor', []]
    | [seq: number, 'Compressor', [level: number]]
    | [null, 'push', [Uint8Array]]
    | [seq: number, 'end', []];

/** Worker response */
export type WorkerResponse =
    | [seq: number, Uint8Array<ArrayBuffer>]
    | [seq: number, null, Error]
    | [seq: number]
    | [null, chunk: Uint8Array<ArrayBuffer>]
    | [null, null, Error];

/** Worker ready */
export type WorkerReady = 'ready';

let mode: 'Decompressor' | 'Compressor' | undefined;
let ptr: number | undefined;
/** Called when chunks generated from wasm */
function onChunkData(state: 'Decompressor' | 'Compressor', ctx: number, dst: Ptr, dstSize: number): void {
    if (ptr !== ctx || state !== mode) {
        postMessage([null, null, new Error(`Invalid context for ${state}`)] satisfies WorkerResponse);
    }
    const chunk = fromHeap(dst, dstSize);
    postMessage([null, chunk] satisfies WorkerResponse, [chunk.buffer]);
}

/** stream mode clean up */
function cleanUp(): void {
    ptr = undefined;
    mode = undefined;
}

setWasmCallbacks({
    onCompressorData: (ctx, dst, dstSize) => onChunkData('Compressor', ctx, dst, dstSize),
    onDecompressorData: (ctx, dst, dstSize) => onChunkData('Decompressor', ctx, dst, dstSize),
});

onMessage(async (data) => {
    const [seq, method, args] = data as WorkerRequest;
    try {
        switch (method) {
            case 'compress': {
                const [data, level] = args;
                const src = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
                const dst = compress(src, level);
                postMessage([seq, dst] satisfies WorkerResponse, [dst.buffer]);
                break;
            }
            case 'decompress': {
                const [data] = args;
                const src = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
                const dst = decompress(src);
                postMessage([seq, dst] satisfies WorkerResponse, [dst.buffer]);
                break;
            }
            case 'Compressor': {
                if (ptr != null || mode != null) {
                    throw new Error('Invalid context');
                }
                let [level] = args;
                level = checkLevel(level);
                ptr = checkError(Module._CompressorCreate(level));
                mode = 'Compressor';
                postMessage([seq] satisfies WorkerResponse);
                break;
            }
            case 'Decompressor': {
                if (ptr != null || mode != null) {
                    throw new Error('Invalid context');
                }
                ptr = checkError(Module._DecompressorCreate());
                mode = 'Decompressor';
                postMessage([seq] satisfies WorkerResponse);
                break;
            }
            case 'push': {
                if (ptr == null || mode == null) {
                    throw new Error('Invalid context');
                }
                const [src] = args;
                const helper = new Helper();
                try {
                    const srcSize = src.byteLength;
                    const srcPtr = helper.toHeap(src);
                    if (mode === 'Compressor') {
                        checkError(Module._CompressorData(ptr as ZSTD_CStream, srcPtr, srcSize));
                    } else {
                        checkError(Module._DecompressorData(ptr as ZSTD_DStream, srcPtr, srcSize));
                    }
                } catch (ex) {
                    cleanUp();
                    postMessage([null, null, ex as Error] satisfies WorkerResponse);
                } finally {
                    helper.finalize();
                }
                break;
            }
            case 'end': {
                if (ptr == null || mode == null) {
                    throw new Error('Invalid context');
                }
                try {
                    if (mode === 'Compressor') {
                        checkError(Module._CompressorEnd(ptr as ZSTD_CStream));
                    } else {
                        checkError(Module._DecompressorEnd(ptr as ZSTD_DStream));
                    }
                    postMessage([seq] satisfies WorkerResponse);
                } finally {
                    cleanUp();
                }
                break;
            }
            default:
                throw new Error('Invalid method');
        }
    } catch (err) {
        postMessage([seq, null, err]);
    }
});

void ModuleReady.then(() => postMessage('ready' satisfies WorkerReady));
