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
 * @param {ArrayBufferView} data 数据
 */
function asBuffer(data) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

const ALL = /** @type {const} */ ([
    ['napi compress', napi.compress],
    ['napi decompress', napi.decompress],
    ['wasm compress', wasm.compress],
    ['wasm decompress', wasm.decompress],
]);

const COMPRESS = /** @type {const} */ ([
    ['napi', napi.compress],
    ['wasm', wasm.compress],
]);

const DECOMPRESS = /** @type {const} */ ([
    ['napi', napi.decompress],
    ['wasm', wasm.decompress],
]);

const ROUNDTRIP = /** @type {const} */ ([
    [
        'napi',
        (/** @type {BinaryData} */ data, /** @type {number | undefined} */ level) =>
            napi.decompress(napi.compress(data, level)),
    ],
    [
        'wasm',
        (/** @type {BinaryData} */ data, /** @type {number | undefined} */ level) =>
            wasm.decompress(wasm.compress(data, level)),
    ],
]);

test('napi api should return buffer', () => {
    expect(napi.compress(randomBuffer)).toBeInstanceOf(Buffer);
    expect(napi.compress(emptyBuffer)).toBeInstanceOf(Buffer);
    expect(napi.decompress(napi.compress(randomBuffer))).toBeInstanceOf(Buffer);
    expect(napi.decompress(napi.compress(emptyBuffer))).toBeInstanceOf(Buffer);
});

test('wasm api should return uint8array', () => {
    expect(wasm.compress(randomBuffer)).toBeInstanceOf(Uint8Array);
    expect(wasm.compress(emptyBuffer)).toBeInstanceOf(Uint8Array);
    expect(wasm.decompress(wasm.compress(randomBuffer))).toBeInstanceOf(Uint8Array);
    expect(wasm.decompress(wasm.compress(emptyBuffer))).toBeInstanceOf(Uint8Array);
});

test('wasm api should not return buffer', () => {
    expect(wasm.compress(randomBuffer)).not.toBeInstanceOf(Buffer);
    expect(wasm.compress(emptyBuffer)).not.toBeInstanceOf(Buffer);
    expect(wasm.decompress(wasm.compress(randomBuffer))).not.toBeInstanceOf(Buffer);
    expect(wasm.decompress(wasm.compress(emptyBuffer))).not.toBeInstanceOf(Buffer);
});

test('napi & wasm compress should got same result', () => {
    expect(napi.compress(randomBuffer)).toEqual(asBuffer(wasm.compress(randomBuffer)));
    expect(napi.compress(emptyBuffer)).toEqual(asBuffer(wasm.compress(emptyBuffer)));
    expect(napi.compress(emptyFloat64Array)).toEqual(asBuffer(wasm.compress(emptyFloat64Array)));
});

test('napi roundtrip should got same result', () => {
    expect(napi.decompress(napi.compress(randomBuffer))).toEqual(randomBuffer);
    expect(napi.decompress(napi.compress(emptyBuffer))).toEqual(emptyBuffer);
});

test('wasm roundtrip should got same result', () => {
    expect(asBuffer(wasm.decompress(wasm.compress(randomBuffer)))).toEqual(randomBuffer);
    expect(asBuffer(wasm.decompress(wasm.compress(emptyBuffer)))).toEqual(emptyBuffer);
});

describe('should accept float64array', () => {
    for (const [key, roundtrip] of ROUNDTRIP) {
        it(key, () => {
            expect(asBuffer(roundtrip(emptyFloat64Array))).toEqual(emptyBuffer);
        });
    }
});

describe('should accept dataview', () => {
    for (const [key, roundtrip] of ROUNDTRIP) {
        it(key, () => {
            expect(asBuffer(roundtrip(emptyDataView))).toEqual(emptyBuffer);
        });
    }
});

describe('should accept arraybuffer', () => {
    for (const [key, roundtrip] of ROUNDTRIP) {
        it(key, () => {
            expect(asBuffer(roundtrip(emptyBuffer.buffer))).toEqual(emptyBuffer);
        });
    }
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
    for (const [key, compress] of COMPRESS) {
        it(key, () => {
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, '1')).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, {})).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, [])).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, null)).toThrow();
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            expect(() => compress(emptyBuffer, new Number(1))).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, true)).toThrow();
            // @ts-expect-error ts(2345)
            expect(() => compress(emptyBuffer, { valueOf: () => 1 })).toThrow();
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, () => {
            expect(() => compress(emptyBuffer, 0)).not.toThrow();
            expect(() => compress(emptyBuffer, 1.2)).not.toThrow();
            expect(() => compress(emptyBuffer, Number.NaN)).not.toThrow();
            expect(() => compress(emptyBuffer, Number.MAX_VALUE)).not.toThrow();
            expect(() => compress(emptyBuffer, -Number.MAX_VALUE)).not.toThrow();
            expect(() => compress(emptyBuffer, -Number.MIN_VALUE)).not.toThrow();
            expect(() => compress(emptyBuffer, -Infinity)).not.toThrow();
            expect(() => compress(emptyBuffer, Infinity)).not.toThrow();
            expect(() => compress(emptyBuffer, Number.MAX_SAFE_INTEGER)).not.toThrow();
            expect(() => compress(emptyBuffer, Number.MIN_SAFE_INTEGER)).not.toThrow();
        });
    }
});

describe('should accept huge input', () => {
    it('napi', () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        expect(napi.compress(hugeBuffer)).toBeDefined();
    });
    it('wasm', () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        expect(wasm.compress(hugeBuffer)).toBeDefined();
    });
});

describe('should reject huge input', () => {
    const bufferOf3GB = Buffer.alloc(3 * 1024 * 1024 * 1024);
    /** will decompress to 3147483645 bytes */
    const compressed3GBSize = 3_147_483_645;
    const compressed3GB = root.decompress(
        Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'),
    );
    it('napi', () => {
        expect(() => napi.compress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.compress(bufferOf3GB.buffer)).toThrow(`Input data is too large`);
        expect(() => napi.decompress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.decompress(compressed3GB)).toThrow(`Content size is too large`);
    });
    it('wasm', () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        expect(() => wasm.compress(hugeBuffer)).toThrow(`Failed to allocate memory`);
        expect(() => wasm.compress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.compress(bufferOf3GB.buffer)).toThrow(`Input data is too large`);
        expect(() => wasm.decompress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.decompress(compressed3GB)).toThrow(`Content size is too large: ${compressed3GBSize}`);
    });
});

describe('should reject bad compressed data', () => {
    for (const [key, decompress] of DECOMPRESS) {
        it(key, () => {
            expect(() => decompress(emptyBuffer)).toThrow('Invalid compressed data');
        });
    }
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, () => {
            expect(decompress(data)).toHaveProperty('length', 1_048_576);
        });
    }
});

describe('should reject empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, () => {
            expect(() => decompress(data)).toThrow(`Unknown content size`);
        });
    }
});

describe('should reject uncompleted block', () => {
    const data = wasm.compress(randomBytes(100)).slice(0, -1);

    for (const [key, decompress] of DECOMPRESS) {
        it(key, () => {
            expect(() => decompress(data)).toThrow(`Src size is incorrect`);
        });
    }
});
