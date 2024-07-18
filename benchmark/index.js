/* eslint-disable no-console */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { TransformStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import prettyBytes from 'pretty-bytes';

import * as wasm from '@cloudpss/zstd/wasm';
import * as napi from '@cloudpss/zstd/napi';

const t = (/** @type {number} */ time) =>
    Number.isFinite(time) ? (time.toFixed(2) + 'ms').padStart(10) : '  --------';
const pb = (/** @type {number} */ size) => prettyBytes(size, { binary: true }).padStart(8);

const root = path.resolve(fileURLToPath(import.meta.url), '../files/');
/**
 * List test files.
 */
async function* files() {
    for await (const file of await fs.opendir(root)) {
        if (!file.isFile() || file.name.startsWith('.')) continue;
        const p = path.join(root, file.name);
        yield {
            name: file.name,
            path: p,
            content: await fs.readFile(p),
        };
    }
}

/**
 * Run callback and return result and time.
 * @template T
 * @param {() => T} callback callback to run
 * @returns {[T, number]} result and time
 */
function time(callback) {
    const start = performance.now();
    const result = callback();
    const end = performance.now();
    return [result, end - start];
}
/**
 * Run callback and return result and time.
 * @template T
 * @param {() => Promise<T>} callback callback to run
 * @returns {Promise<[T, number]>} result and time
 */
async function atime(callback) {
    const start = performance.now();
    const result = await callback();
    const end = performance.now();
    return [result, end - start];
}

/** Warmup */
async function warmup() {
    for (const len of [0, 1, 10, 100, 1000, 10000, 100_000, 1_000_000]) {
        const data = new Uint8Array(len);
        const cdata = await napi.compress(data);
        await napi.decompress(cdata);
        napi.compressSync(data);
        napi.decompressSync(cdata);
        await wasm.compress(data);
        await wasm.decompress(cdata);
        wasm.compressSync(data);
        wasm.decompressSync(cdata);
    }
}

/** Run tests */
async function main() {
    let noFile = true;
    for await (const file of files()) {
        if (noFile) {
            noFile = false;
            await warmup();
            console.log(
                '\u001B[2;32mLevel',
                'Compressed'.padEnd(18),
                'NAPI Comp/Decomp'.padEnd(21),
                'NAPI Worker'.padEnd(21),
                'NAPI Stream'.padEnd(21),
                'WASM Comp/Decomp'.padEnd(21),
                'WASM Worker'.padEnd(21),
                'WASM Stream'.padEnd(21),
                '\u001B[0m',
            );
        }
        console.log(`\u001B[1;33mFile: ${file.name} \tRaw: ${pb(file.content.length)}\u001B[0m`);
        for (const level of [-10, -5, -1, 1, 2, 3, 4, 5, 6, 9, 15, 19, 22]) {
            const [compressed, napiCompressTime] = time(() => napi.compressSync(file.content, level));
            const [decompressed, napiDecompressTime] = time(() => napi.decompressSync(compressed));
            const [, napiWorkerCompressTime] = await atime(() => napi.compress(file.content, level));
            const [, napiWorkerDecompressTime] = await atime(() => napi.decompress(compressed));
            const [, napiSCompressTime] = await atime(async () => {
                const stream = new napi.Compressor(level);
                return await pipeline(Readable.from(file.content), stream, async (chunks) => {
                    const chunks2 = [];
                    for await (const chunk of chunks) {
                        chunks2.push(chunk);
                    }
                    return Buffer.concat(chunks2);
                });
            });
            const [, napiSDecompressTime] = await atime(async () => {
                const stream = new napi.Decompressor();
                return await pipeline(Readable.from(compressed), stream, async (chunks) => {
                    const chunks2 = [];
                    for await (const chunk of chunks) {
                        chunks2.push(chunk);
                    }
                    return Buffer.concat(chunks2);
                });
            });
            const [, wasmCompressTime] = time(() => wasm.compressSync(file.content, level));
            const [, wasmDecompressTime] = time(() => wasm.decompressSync(compressed));
            const [, wasmWorkerCompressTime] = await atime(() => wasm.compress(file.content, level));
            const [, wasmWorkerDecompressTime] = await atime(() => wasm.decompress(compressed));
            const [, wasmSCompressTime] = await atime(async () => {
                const stream = new TransformStream(new wasm.WebCompressor(level));
                return await pipeline(Readable.from(file.content), Transform.fromWeb(stream), async (chunks) => {
                    const chunks2 = [];
                    for await (const chunk of chunks) {
                        chunks2.push(chunk);
                    }
                    return Buffer.concat(chunks2);
                });
            });
            const [, wasmSDecompressTime] = await atime(async () => {
                const stream = new TransformStream(new wasm.WebDecompressor());
                return await pipeline(Readable.from(compressed), Transform.fromWeb(stream), async (chunks) => {
                    const chunks2 = [];
                    for await (const chunk of chunks) {
                        chunks2.push(chunk);
                    }
                    return Buffer.concat(chunks2);
                });
            });
            console.assert(
                Buffer.compare(decompressed, file.content) === 0,
                'Decompressed data does not match original',
            );
            console.log(
                level.toString().padStart(4),
                `${(file.content.length / compressed.length).toFixed(1)}(${pb(compressed.length)})`.padStart(18),
                t(napiCompressTime),
                t(napiDecompressTime),
                t(napiWorkerCompressTime),
                t(napiWorkerDecompressTime),
                t(napiSCompressTime),
                t(napiSDecompressTime),
                t(wasmCompressTime),
                t(wasmDecompressTime),
                t(wasmWorkerCompressTime),
                t(wasmWorkerDecompressTime),
                t(wasmSCompressTime),
                t(wasmSDecompressTime),
            );
        }
    }
    wasm.terminate();
    if (noFile) {
        console.error(`No test files, please put some files in ${path.relative(process.cwd(), root)}`);
        process.exit(1);
    }
}

void main().catch(console.error);
