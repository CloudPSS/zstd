import { describe, it, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { randomBuffer, zeroBuffer, zeroDataView, zeroFloat64Array } from './.utils.js';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

const ALL = [
    ['napi compress', napi.compress],
    ['napi decompress', napi.decompress],
    ['wasm compress', wasm.compress],
    ['wasm decompress', wasm.decompress],
] as const;

const COMPRESS = [
    ['napi', napi.compress],
    ['wasm', wasm.compress],
] as const;

const DECOMPRESS = [
    ['napi', napi.decompress],
    ['wasm', wasm.decompress],
] as const;

const ROUNDTRIP = [
    ['napi', async (data: BinaryData, level?: number) => await napi.decompress(await napi.compress(data, level))],
    ['wasm', async (data: BinaryData, level?: number) => await wasm.decompress(await wasm.compress(data, level))],
] as const;

after(() => {
    wasm.terminate();
});

for (const [key, api] of [
    ['napi', napi],
    ['wasm', wasm],
] as const) {
    describe(`${key} async api`, () => {
        it('should return uint8array', async () => {
            assert.ok((await api.compress(randomBuffer)) instanceof Uint8Array);
            assert.ok((await api.compress(zeroBuffer)) instanceof Uint8Array);
            assert.ok((await api.decompress(await api.compress(randomBuffer))) instanceof Uint8Array);
            assert.ok((await api.decompress(await api.compress(zeroBuffer))) instanceof Uint8Array);
        });
        it('should not return buffer', async () => {
            assert.ok(!((await api.compress(randomBuffer)) instanceof Buffer));
            assert.ok(!((await api.compress(zeroBuffer)) instanceof Buffer));
            assert.ok(!((await api.decompress(await api.compress(randomBuffer))) instanceof Buffer));
            assert.ok(!((await api.decompress(await api.compress(zeroBuffer))) instanceof Buffer));
        });
    });
}

test('napi & wasm async compress should got same result', async () => {
    assert.deepStrictEqual(await napi.compress(randomBuffer), wasm.compressSync(randomBuffer));
    assert.deepStrictEqual(await napi.compress(zeroBuffer), wasm.compressSync(zeroBuffer));
    assert.deepStrictEqual(await napi.compress(zeroFloat64Array), wasm.compressSync(zeroFloat64Array));
});

test('napi async api should run in parallel', async () => {
    const parallel = Array.from({ length: 16384 }).map(() => napi.compress(new Uint8Array(1024)));
    assert.strictEqual((await Promise.all(parallel)).length, 16384);
});

test('wasm async api should run in parallel', async () => {
    wasm.terminate();
    const parallel = Array.from({ length: 16384 }).map(() => wasm.compress(new Uint8Array(1024)));
    assert.strictEqual((await Promise.all(parallel)).length, 16384);
    assert.deepStrictEqual(wasm.workers(), { idle: availableParallelism() - 1, busy: 0 });
    wasm.terminate();
    assert.deepStrictEqual(wasm.workers(), { idle: 0, busy: 0 });
});

describe('async compress should not transfer input', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            const data = new Uint8Array(1000);
            await compress(data);
            assert.strictEqual(data.buffer.byteLength, 1000);
        });
    }
});

describe('async decompress should not transfer input', () => {
    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            const data = root.compressSync(new Uint8Array(1000));
            const dataSize = data.buffer.byteLength;
            await decompress(data);
            assert.strictEqual(data.buffer.byteLength, dataSize);
        });
    }
});

for (const [key, roundtrip] of ROUNDTRIP) {
    describe(`${key} async roundtrip should got same result`, () => {
        it('random buffer', async () => {
            assert.deepStrictEqual(await roundtrip(randomBuffer), randomBuffer);
        });
        it('empty buffer', async () => {
            assert.deepStrictEqual(await roundtrip(zeroBuffer), zeroBuffer);
        });
        it('float64array', async () => {
            assert.deepStrictEqual(await roundtrip(zeroFloat64Array), zeroBuffer);
        });
        it('dataview', async () => {
            assert.deepStrictEqual(await roundtrip(zeroDataView), zeroBuffer);
        });
        it('arraybuffer', async () => {
            assert.deepStrictEqual(await roundtrip(zeroBuffer.buffer), zeroBuffer);
        });
    });
}

describe('should reject bad buffer data', () => {
    for (const [key, method] of ALL) {
        it(key, async () => {
            const e = { message: `Input data must be BinaryData or Blob.` };
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(1), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(''), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method({}), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method([]), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(null), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(undefined), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(true), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method(false), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method({ byteLength: -1 }), e);
            // @ts-expect-error ts(2345)
            await assert.rejects(() => method({ byteLength: 0 }), e);
        });
    }
});

describe('should reject bad level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            // @ts-expect-error ts(2345)
            await assert.rejects(() => compress(zeroBuffer, '1'));
            // @ts-expect-error ts(2345)
            await assert.rejects(() => compress(zeroBuffer, {}));
            // @ts-expect-error ts(2345)
            await assert.rejects(() => compress(zeroBuffer, []));
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            await assert.rejects(() => compress(zeroBuffer, new Number(1)));
            // @ts-expect-error ts(2345)
            await assert.rejects(() => compress(zeroBuffer, true));
            // @ts-expect-error ts(2345)
            await assert.rejects(() => compress(zeroBuffer, { valueOf: () => 1 }));
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            // @ts-expect-error ts(2345)
            await assert.doesNotReject(() => compress(zeroBuffer, null));
            await assert.doesNotReject(() => compress(zeroBuffer, undefined));
            await assert.doesNotReject(() => compress(zeroBuffer, 1.2));
            await assert.doesNotReject(() => compress(zeroBuffer, Number.NaN));
            await assert.doesNotReject(() => compress(zeroBuffer, Number.MAX_VALUE));
            await assert.doesNotReject(() => compress(zeroBuffer, -Number.MAX_VALUE));
            await assert.doesNotReject(() => compress(zeroBuffer, -Number.MIN_VALUE));
            await assert.doesNotReject(() => compress(zeroBuffer, -Infinity));
            await assert.doesNotReject(() => compress(zeroBuffer, Infinity));
            await assert.doesNotReject(() => compress(zeroBuffer, Number.MAX_SAFE_INTEGER));
            await assert.doesNotReject(() => compress(zeroBuffer, Number.MIN_SAFE_INTEGER));
        });
    }
});

describe('should accept huge input', () => {
    it('napi', async () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        await assert.doesNotReject(() => napi.compress(hugeBuffer));
    });
    it('wasm', async () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        await assert.doesNotReject(() => wasm.compress(hugeBuffer));
    });
});

describe('should reject huge input', () => {
    const bufferOf3GB = Buffer.alloc(3 * 1024 * 1024 * 1024);
    /** will decompress to 3147483645 bytes */
    const compressed3GBSize = 3_147_483_645;
    const compressed3GB = root.decompressSync(
        Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'),
    );
    it('napi', async () => {
        await assert.rejects(() => napi.compress(bufferOf3GB), { message: 'Input data is too large' });
        await assert.rejects(() => napi.compress(bufferOf3GB.buffer), { message: 'Input data is too large' });
        await assert.rejects(() => napi.decompress(bufferOf3GB), { message: 'Input data is too large' });
        await assert.rejects(() => napi.decompress(compressed3GB), { message: 'Content size is too large' });
    });
    it('wasm', async () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        await assert.rejects(() => wasm.compress(hugeBuffer), { message: 'Failed to allocate memory' });
        await assert.rejects(() => wasm.compress(bufferOf3GB), { message: 'Input data is too large' });
        await assert.rejects(() => wasm.compress(bufferOf3GB.buffer), { message: 'Input data is too large' });
        await assert.rejects(() => wasm.decompress(bufferOf3GB), { message: 'Input data is too large' });
        await assert.rejects(() => wasm.decompress(compressed3GB), {
            message: `Content size is too large: ${compressed3GBSize}`,
        });
    });
});

describe('should reject bad compressed data', () => {
    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await assert.rejects(() => decompress(zeroBuffer), { message: 'Invalid compressed data' });
        });
    }
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            const result = await decompress(data);
            assert.strictEqual(result.length, 1_048_576);
        });
    }
});

describe('should accept empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            const result = await decompress(data);
            assert.strictEqual(result.length, 0);
        });
    }
});

describe('should reject uncompleted block', () => {
    const data = wasm.compressSync(randomBytes(100)).slice(0, -1);

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await assert.rejects(() => decompress(data), { message: 'Invalid compressed data' });
        });
    }
});
