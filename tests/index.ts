import { randomBytes } from 'node:crypto';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

const randomBuffer = randomBytes(1000);

const emptyBuffer = Buffer.alloc(1000);
const emptyFloat64Array = new Float64Array(1000 / 8);
const emptyDataView = new DataView(emptyFloat64Array.buffer);

/**
 * 转换 buffer
 */
function asBuffer(data: ArrayBufferView): Buffer {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

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

test('napi api should return buffer', () => {
    expect(napi.compressSync(randomBuffer)).toBeInstanceOf(Buffer);
    expect(napi.compressSync(emptyBuffer)).toBeInstanceOf(Buffer);
    expect(napi.decompressSync(napi.compressSync(randomBuffer))).toBeInstanceOf(Buffer);
    expect(napi.decompressSync(napi.compressSync(emptyBuffer))).toBeInstanceOf(Buffer);
});

test('wasm api should return uint8array', () => {
    expect(wasm.compressSync(randomBuffer)).toBeInstanceOf(Uint8Array);
    expect(wasm.compressSync(emptyBuffer)).toBeInstanceOf(Uint8Array);
    expect(wasm.decompressSync(wasm.compressSync(randomBuffer))).toBeInstanceOf(Uint8Array);
    expect(wasm.decompressSync(wasm.compressSync(emptyBuffer))).toBeInstanceOf(Uint8Array);
});

test('wasm api should not return buffer', () => {
    expect(wasm.compressSync(randomBuffer)).not.toBeInstanceOf(Buffer);
    expect(wasm.compressSync(emptyBuffer)).not.toBeInstanceOf(Buffer);
    expect(wasm.decompressSync(wasm.compressSync(randomBuffer))).not.toBeInstanceOf(Buffer);
    expect(wasm.decompressSync(wasm.compressSync(emptyBuffer))).not.toBeInstanceOf(Buffer);
});

test('napi & wasm compress should got same result', () => {
    expect(napi.compressSync(randomBuffer)).toEqual(asBuffer(wasm.compressSync(randomBuffer)));
    expect(napi.compressSync(emptyBuffer)).toEqual(asBuffer(wasm.compressSync(emptyBuffer)));
    expect(napi.compressSync(emptyFloat64Array)).toEqual(asBuffer(wasm.compressSync(emptyFloat64Array)));
});

describe.each(ROUNDTRIP)('%s roundtrip should got same result', (key, roundtrip) => {
    it('random buffer', () => {
        expect(asBuffer(roundtrip(randomBuffer))).toEqual(randomBuffer);
    });
    it('empty buffer', () => {
        expect(asBuffer(roundtrip(emptyBuffer))).toEqual(emptyBuffer);
    });
    it('float64array', () => {
        expect(asBuffer(roundtrip(emptyFloat64Array))).toEqual(emptyBuffer);
    });
    it('dataview', () => {
        expect(asBuffer(roundtrip(emptyDataView))).toEqual(emptyBuffer);
    });
    it('arraybuffer', () => {
        expect(asBuffer(roundtrip(emptyBuffer.buffer))).toEqual(emptyBuffer);
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
            expect(() => compressSync(emptyBuffer, '1')).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(emptyBuffer, {})).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(emptyBuffer, [])).toThrow();
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            expect(() => compressSync(emptyBuffer, new Number(1))).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(emptyBuffer, true)).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compressSync(emptyBuffer, { valueOf: () => 1 })).toThrow();
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compressSync] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            expect(() => compressSync(emptyBuffer, null)).not.toThrow();
            expect(() => compressSync(emptyBuffer, undefined)).not.toThrow();
            expect(() => compressSync(emptyBuffer, 1.2)).not.toThrow();
            expect(() => compressSync(emptyBuffer, Number.NaN)).not.toThrow();
            expect(() => compressSync(emptyBuffer, Number.MAX_VALUE)).not.toThrow();
            expect(() => compressSync(emptyBuffer, -Number.MAX_VALUE)).not.toThrow();
            expect(() => compressSync(emptyBuffer, -Number.MIN_VALUE)).not.toThrow();
            expect(() => compressSync(emptyBuffer, -Infinity)).not.toThrow();
            expect(() => compressSync(emptyBuffer, Infinity)).not.toThrow();
            expect(() => compressSync(emptyBuffer, Number.MAX_SAFE_INTEGER)).not.toThrow();
            expect(() => compressSync(emptyBuffer, Number.MIN_SAFE_INTEGER)).not.toThrow();
        });
    }
});

describe('should accept huge input', () => {
    it('napi', () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        expect(napi.compressSync(hugeBuffer)).toBeDefined();
    });
    it('wasm', () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        expect(wasm.compressSync(hugeBuffer)).toBeDefined();
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
            expect(() => decompressSync(emptyBuffer)).toThrow('Invalid compressed data');
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
