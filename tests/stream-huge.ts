import { randomBytes } from 'node:crypto';
import { ReadableStream as RS } from 'node:stream/web';
import { asUint8Array } from './.utils.js';
import * as wasm from '@cloudpss/zstd/wasm';
import * as napi from '@cloudpss/zstd/napi';

const randomBuffer = asUint8Array(randomBytes(5843));

/** 生成数据 */
function hugeReadable(): ReadableStream<Uint8Array> {
    let count = 0;
    return new RS<Uint8Array>({
        pull(controller) {
            if (count++ < 1024 * 1024) {
                controller.enqueue(randomBuffer);
            } else {
                controller.close();
            }
        },
    }) as ReadableStream<Uint8Array>;
}

afterAll(() => {
    wasm.terminate();
});

const MODULE = [
    ['napi', napi],
    ['wasm', wasm],
] as const;

(process.env['CI'] ? describe : xdescribe).each(MODULE)('%s stream compress api', (name, module) => {
    it('should roundtrip with huge data', async () => {
        const readable = hugeReadable();
        const result = readable.pipeThrough(module.compressor(3)).pipeThrough(module.decompressor());
        const reader = result.getReader();
        let read;
        let total = 0;
        do {
            read = await reader.read();
            if (total === 0) {
                expect(read.value).toBeInstanceOf(Uint8Array);
                expect(read.value).not.toBeInstanceOf(Buffer);
                const gotSlice = read.value!.subarray(0, randomBuffer.length);
                const expectSlice = randomBuffer.subarray(0, gotSlice.length);
                expect(gotSlice).toEqual(expectSlice);
            }
            total += read.value?.length ?? 0;
        } while (!read.done);
    }, 300_000);
});
