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

describe.each([
    ['napi', napi],
    ['wasm', wasm],
])(`%s api`, (key, api) => {
    it('should return uint8array', () => {
        expect(api.compressSync(randomBuffer)).toBeInstanceOf(Uint8Array);
        expect(api.compressSync(zeroBuffer)).toBeInstanceOf(Uint8Array);
        expect(api.decompressSync(api.compressSync(randomBuffer))).toBeInstanceOf(Uint8Array);
        expect(api.decompressSync(api.compressSync(zeroBuffer))).toBeInstanceOf(Uint8Array);
    });
    it('should not return buffer', () => {
        expect(api.compressSync(randomBuffer)).not.toBeInstanceOf(Buffer);
        expect(api.compressSync(zeroBuffer)).not.toBeInstanceOf(Buffer);
        expect(api.decompressSync(api.compressSync(randomBuffer))).not.toBeInstanceOf(Buffer);
        expect(api.decompressSync(api.compressSync(zeroBuffer))).not.toBeInstanceOf(Buffer);
    });
});

test('napi & wasm compress should got same result', () => {
    expect(napi.compressSync(randomBuffer)).toEqual(wasm.compressSync(randomBuffer));
    expect(napi.compressSync(zeroBuffer)).toEqual(wasm.compressSync(zeroBuffer));
    expect(napi.compressSync(zeroFloat64Array)).toEqual(wasm.compressSync(zeroFloat64Array));
});

describe.each(ROUNDTRIP)('%s roundtrip should got same result', (key, roundtrip) => {
    it('random buffer', () => {
        expect(roundtrip(randomBuffer)).toEqual(randomBuffer);
    });
    it('empty buffer', () => {
        expect(roundtrip(zeroBuffer)).toEqual(zeroBuffer);
    });
    it('float64array', () => {
        expect(roundtrip(zeroFloat64Array)).toEqual(zeroBuffer);
    });
    it('dataview', () => {
        expect(roundtrip(zeroDataView)).toEqual(zeroBuffer);
    });
    it('arraybuffer', () => {
        expect(roundtrip(zeroBuffer.buffer)).toEqual(zeroBuffer);
    });
});

describe('should reject bad buffer data', () => {
    for (const [key, method] of ALL) {
        it(key, () => {
            const e = `Input data must be BinaryData`;
            // @ts-expect-error ts(2345)
            expect(() => method(1)).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method('')).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method({})).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method([])).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method(null)).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method(undefined)).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method(true)).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method(true)).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method({ byteLength: -1 })).toThrow(e);
            // @ts-expect-error ts(2345)
            expect(() => method({ byteLength: 0 })).toThrow(e);
        });
    }
});

describe('should reject bad level', () => {
    for (const [key, compressSync] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, '1')).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, {})).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, [])).toThrow();
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            expect(() => compressSync(zeroBuffer, new Number(1))).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, true)).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, { valueOf: () => 1 })).toThrow();
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compressSync] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            expect(() => compressSync(zeroBuffer, null)).not.toThrow();
            expect(() => compressSync(zeroBuffer, undefined)).not.toThrow();
            expect(() => compressSync(zeroBuffer, 1.2)).not.toThrow();
            expect(() => compressSync(zeroBuffer, Number.NaN)).not.toThrow();
            expect(() => compressSync(zeroBuffer, Number.MAX_VALUE)).not.toThrow();
            expect(() => compressSync(zeroBuffer, -Number.MAX_VALUE)).not.toThrow();
            expect(() => compressSync(zeroBuffer, -Number.MIN_VALUE)).not.toThrow();
            expect(() => compressSync(zeroBuffer, -Infinity)).not.toThrow();
            expect(() => compressSync(zeroBuffer, Infinity)).not.toThrow();
            expect(() => compressSync(zeroBuffer, Number.MAX_SAFE_INTEGER)).not.toThrow();
            expect(() => compressSync(zeroBuffer, Number.MIN_SAFE_INTEGER)).not.toThrow();
        });
    }
});

describe('should accept huge input', () => {
    it('napi', () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        expect(napi.compressSync(hugeBuffer)).toBeDefined();
    }, 10000);
    it('wasm', () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        expect(wasm.compressSync(hugeBuffer)).toBeDefined();
    }, 10000);
});

describe('should reject huge input', () => {
    const bufferOf3GB = Buffer.alloc(3 * 1024 * 1024 * 1024);
    /** will decompress to 3147483645 bytes */
    const compressed3GBSize = 3_147_483_645;
    const compressed3GB = root.decompressSync(
        Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'),
    );
    it('napi', () => {
        expect(() => napi.compressSync(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.compressSync(bufferOf3GB.buffer)).toThrow(`Input data is too large`);
        expect(() => napi.decompressSync(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.decompressSync(compressed3GB)).toThrow(`Content size is too large`);
    });
    it('wasm', () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        expect(() => wasm.compressSync(hugeBuffer)).toThrow(`Failed to allocate memory`);
        expect(() => wasm.compressSync(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.compressSync(bufferOf3GB.buffer)).toThrow(`Input data is too large`);
        expect(() => wasm.decompressSync(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.decompressSync(compressed3GB)).toThrow(`Content size is too large: ${compressed3GBSize}`);
    });
});

describe('should reject bad compressed data', () => {
    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            expect(() => decompressSync(zeroBuffer)).toThrow('Invalid compressed data');
        });
    }
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            expect(decompressSync(data)).toHaveProperty('length', 1_048_576);
        });
    }
});

describe('should accept empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            expect(decompressSync(data)).toHaveProperty('length', 0);
        });
    }
});

describe('should reject uncompleted block', () => {
    const data = wasm.compressSync(randomBytes(100)).slice(0, -1);

    for (const [key, decompressSync] of DECOMPRESS) {
        it(key, () => {
            expect(() => decompressSync(data)).toThrow(`Invalid compressed data`);
        });
    }
});
