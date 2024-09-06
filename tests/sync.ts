import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { randomBuffer, zeroBuffer, zeroDataView, zeroFloat64Array } from './.utils.js';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

const ALL = [
    ['napi compress', napi.compressSync],
    ['napi decompress', napi.decompressSync],
    ['wasm compress', wasm.compressSync],
    ['wasm decompress', wasm.decompressSync],
] as const;

const COMPRESS = [
    ['napi', napi.compressSync],
    ['wasm', wasm.compressSync],
] as const;

const DECOMPRESS = [
    ['napi', napi.decompressSync],
    ['wasm', wasm.decompressSync],
] as const;

const ROUNDTRIP = [
    ['napi', (data: BinaryData, level?: number) => napi.decompressSync(napi.compressSync(data, level))],
    ['wasm', (data: BinaryData, level?: number) => wasm.decompressSync(wasm.compressSync(data, level))],
] as const;

const MODULE = [
    ['napi', napi],
    ['wasm', wasm],
] as const;

for (const [key, api] of MODULE) {
    describe(`${key} stream compress api`, () => {
        it('should return uint8array', () => {
            assert(api.compressSync(randomBuffer) instanceof Uint8Array);
            assert(api.compressSync(zeroBuffer) instanceof Uint8Array);
            assert(api.decompressSync(api.compressSync(randomBuffer)) instanceof Uint8Array);
            assert(api.decompressSync(api.compressSync(zeroBuffer)) instanceof Uint8Array);
        });
        it('should not return buffer', () => {
            assert(!(api.compressSync(randomBuffer) instanceof Buffer));
            assert(!(api.compressSync(zeroBuffer) instanceof Buffer));
            assert(!(api.decompressSync(api.compressSync(randomBuffer)) instanceof Buffer));
            assert(!(api.decompressSync(api.compressSync(zeroBuffer)) instanceof Buffer));
        });
    });
}

test('napi & wasm compress should got same result', () => {
    assert.deepEqual(napi.compressSync(randomBuffer), wasm.compressSync(randomBuffer));
    assert.deepEqual(napi.compressSync(zeroBuffer), wasm.compressSync(zeroBuffer));
    assert.deepEqual(napi.compressSync(zeroFloat64Array), wasm.compressSync(zeroFloat64Array));
});

for (const [key, roundtrip] of ROUNDTRIP) {
    describe(`${key} roundtrip should got same result`, () => {
        it('random buffer', () => {
            assert.deepEqual(roundtrip(randomBuffer), randomBuffer);
        });
        it('empty buffer', () => {
            assert.deepEqual(roundtrip(zeroBuffer), zeroBuffer);
        });
        it('float64array', () => {
            assert.deepEqual(roundtrip(zeroFloat64Array), zeroBuffer);
        });
        it('dataview', () => {
            assert.deepEqual(roundtrip(zeroDataView), zeroBuffer);
        });
        it('arraybuffer', () => {
            assert.deepEqual(roundtrip(zeroBuffer.buffer), zeroBuffer);
        });
    });
}

describe('should reject bad buffer data', () => {
    for (const [key, method] of ALL) {
        it(key, () => {
            const e = { message: `Input data must be BinaryData.` };
            // @ts-expect-error ts(2345)
            assert.throws(() => method(1), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method(''), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method({}), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method([]), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method(null), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method(undefined), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method(true), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method(false), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method({ byteLength: -1 }), e);
            // @ts-expect-error ts(2345)
            assert.throws(() => method({ byteLength: 0 }), e);
        });
    }
});

describe('should reject bad level', () => {
    for (const [key, compressSync] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            assert.throws(() => compressSync(zeroBuffer, '1'));
            // @ts-expect-error ts(2345)
            assert.throws(() => compressSync(zeroBuffer, {}));
            // @ts-expect-error ts(2345)
            assert.throws(() => compressSync(zeroBuffer, []));
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            assert.throws(() => compressSync(zeroBuffer, new Number(1)));
            // @ts-expect-error ts(2345)
            assert.throws(() => compressSync(zeroBuffer, true));
            // @ts-expect-error ts(2345)
            assert.throws(() => compressSync(zeroBuffer, { valueOf: () => 1 }));
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compressSync] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            assert.doesNotThrow(() => compressSync(zeroBuffer, null));
            assert.doesNotThrow(() => compressSync(zeroBuffer, undefined));
            assert.doesNotThrow(() => compressSync(zeroBuffer, 1.2));
            assert.doesNotThrow(() => compressSync(zeroBuffer, Number.NaN));
            assert.doesNotThrow(() => compressSync(zeroBuffer, Number.MAX_VALUE));
            assert.doesNotThrow(() => compressSync(zeroBuffer, -Number.MAX_VALUE));
            assert.doesNotThrow(() => compressSync(zeroBuffer, -Number.MIN_VALUE));
            assert.doesNotThrow(() => compressSync(zeroBuffer, -Infinity));
            assert.doesNotThrow(() => compressSync(zeroBuffer, Infinity));
            assert.doesNotThrow(() => compressSync(zeroBuffer, Number.MAX_SAFE_INTEGER));
            assert.doesNotThrow(() => compressSync(zeroBuffer, Number.MIN_SAFE_INTEGER));
        });
    }
});

describe('should accept huge input', () => {
    it('napi', () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        assert.ok(napi.compressSync(hugeBuffer));
    });
    it('wasm', () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        assert.ok(wasm.compressSync(hugeBuffer));
    });
});

describe('should reject huge input', () => {
    const bufferOf3GB = Buffer.alloc(3 * 1024 * 1024 * 1024);
    /** will decompress to 3147483645 bytes */
    const compressed3GBSize = 3_147_483_645;
    const compressed3GB = root.decompressSync(
        Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'),
    );
    it('napi', () => {
        assert.throws(() => napi.compressSync(bufferOf3GB), { message: 'Input data is too large' });
        assert.throws(() => napi.compressSync(bufferOf3GB.buffer), { message: 'Input data is too large' });
        assert.throws(() => napi.decompressSync(bufferOf3GB), { message: 'Input data is too large' });
        assert.throws(() => napi.decompressSync(compressed3GB), { message: 'Content size is too large' });
    });
    it('wasm', () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        assert.throws(() => wasm.compressSync(hugeBuffer), { message: 'Failed to allocate memory' });
        assert.throws(() => wasm.compressSync(bufferOf3GB), { message: 'Input data is too large' });
        assert.throws(() => wasm.compressSync(bufferOf3GB.buffer), { message: 'Input data is too large' });
        assert.throws(() => wasm.decompressSync(bufferOf3GB), { message: 'Input data is too large' });
        assert.throws(() => wasm.decompressSync(compressed3GB), {
            message: `Content size is too large: ${compressed3GBSize}`,
        });
    });
});

describe('should reject bad compressed data', () => {
    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            assert.throws(() => decompressSync(zeroBuffer), { message: 'Invalid compressed data' });
        });
    }
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            assert.equal(decompressSync(data).length, 1_048_576);
        });
    }
});

describe('should accept empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            assert.equal(decompressSync(data).length, 0);
        });
    }
});

describe('should reject uncompleted block', () => {
    const data = wasm.compressSync(randomBytes(100)).slice(0, -1);

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            assert.throws(() => decompressSync(data), { message: 'Invalid compressed data' });
        });
    }
});
