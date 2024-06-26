/* eslint-disable no-console */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
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

/** Run tests */
async function main() {
    let noFile = true;
    for await (const file of files()) {
        if (noFile) {
            noFile = false;
            console.log(
                '\u001B[2;32mLevel',
                'Compressed'.padEnd(18),
                'NAPI Comp/Decomp'.padEnd(21),
                'NAPI Stream'.padEnd(21),
                'WASM Comp/Decomp'.padEnd(21),
                '\u001B[0m',
            );
        }
        console.log(`\u001B[1;33mFile: ${file.name} \tRaw: ${pb(file.content.length)}\u001B[0m`);
        for (const level of [-10, -5, -1, 1, 2, 3, 4, 5, 6, 9, 15, 19, 22]) {
            const [compressed, napiCompressTime] = time(() => napi.compressSync(file.content, level));
            const [decompressed, napiDecompressTime] = time(() => napi.decompressSync(compressed));
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
            console.assert(
                Buffer.compare(decompressed, file.content) === 0,
                'Decompressed data does not match original',
            );
            console.log(
                level.toString().padStart(4),
                `${(file.content.length / compressed.length).toFixed(1)}(${pb(compressed.length)})`.padStart(18),
                t(napiCompressTime),
                t(napiDecompressTime),
                t(napiSCompressTime),
                t(napiSDecompressTime),
                t(wasmCompressTime),
                t(wasmDecompressTime),
            );
        }
    }
    if (noFile) {
        console.error(`No test files, please put some files in ${path.relative(process.cwd(), root)}`);
        process.exit(1);
    }
}

void main().catch(console.error);
