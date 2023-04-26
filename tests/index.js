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

it('should have correct config', () => {
    expect(config.DEFAULT_LEVEL).toBe(4);
    expect(config.MAX_SIZE).toBeGreaterThanOrEqual(1024 * 1024 * 1024);
});

it('should have correct TYPE', () => {
    expect(napi.TYPE).toBe('napi');
    expect(wasm.TYPE).toBe('wasm');
    expect(root.TYPE).toBe('napi');
});

it('should have correct VERSION', () => {
    expect(napi.ZSTD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(wasm.ZSTD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(root.ZSTD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});

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
    it('napi', () => {
        expect(napi.compress(emptyFloat64Array)).toBeInstanceOf(Buffer);
        expect(napi.decompress(napi.compress(emptyFloat64Array))).toEqual(emptyBuffer);
    });
    it('wasm', () => {
        expect(wasm.compress(emptyFloat64Array)).toBeInstanceOf(Uint8Array);
        expect(asBuffer(wasm.decompress(wasm.compress(emptyFloat64Array)))).toEqual(emptyBuffer);
    });
});

describe('should accept dataview', () => {
    it('napi', () => {
        expect(napi.compress(emptyDataView)).toBeInstanceOf(Buffer);
        expect(napi.decompress(napi.compress(emptyDataView))).toEqual(emptyBuffer);
    });
    it('wasm', () => {
        expect(wasm.compress(emptyDataView)).toBeInstanceOf(Uint8Array);
        expect(asBuffer(wasm.decompress(wasm.compress(emptyDataView)))).toEqual(emptyBuffer);
    });
});

describe('should accept arraybuffer', () => {
    it('napi', () => {
        expect(napi.compress(emptyBuffer.buffer)).toBeInstanceOf(Buffer);
        expect(napi.decompress(napi.compress(emptyBuffer.buffer))).toEqual(emptyBuffer);
    });
    it('wasm', () => {
        expect(wasm.compress(emptyBuffer.buffer)).toBeInstanceOf(Uint8Array);
        expect(asBuffer(wasm.decompress(wasm.compress(emptyBuffer.buffer)))).toEqual(emptyBuffer);
    });
});

describe('should reject bad buffer data', () => {
    it('napi compress', () => {
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(1)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress('')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress({})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress([])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(null)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(undefined)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(true)).toThrow();
    });
    it('napi decompress', () => {
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress(1)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress('')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress({})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress([])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress(null)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress(undefined)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.decompress(true)).toThrow();
    });
    it('wasm compress', () => {
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(1)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress('')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress({})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress([])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(null)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(undefined)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(true)).toThrow();
    });
    it('wasm decompress', () => {
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress(1)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress('')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress({})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress([])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress(null)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress(undefined)).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.decompress(true)).toThrow();
    });
});

describe('should reject bad compressed data', () => {
    it('napi', () => {
        expect(() => napi.decompress(emptyBuffer)).toThrow('Invalid compressed data');
    });
    it('wasm', () => {
        expect(() => wasm.decompress(emptyBuffer)).toThrow('Invalid compressed data');
    });
});

describe('should reject bad level', () => {
    it('napi', () => {
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(emptyBuffer, '1')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(emptyBuffer, {})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(emptyBuffer, [])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(emptyBuffer, null)).toThrow();
        // @ts-expect-error ts(2345)
        // eslint-disable-next-line unicorn/new-for-builtins
        expect(() => napi.compress(emptyBuffer, new Number(1))).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => napi.compress(emptyBuffer, true)).toThrow();
    });
    it('wasm', () => {
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(emptyBuffer, '1')).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(emptyBuffer, {})).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(emptyBuffer, [])).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(emptyBuffer, null)).toThrow();
        // @ts-expect-error ts(2345)
        // eslint-disable-next-line unicorn/new-for-builtins
        expect(() => wasm.compress(emptyBuffer, new Number(1))).toThrow();
        // @ts-expect-error ts(2345)
        expect(() => wasm.compress(emptyBuffer, true)).toThrow();
    });
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
    const compressed3GB = root.decompress(Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'));
    it('napi', () => {
        expect(() => napi.compress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.decompress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => napi.decompress(compressed3GB)).toThrow(`Content size is too large`);
    });
    it('wasm', () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        expect(() => wasm.compress(hugeBuffer)).toThrow(`Failed to allocate memory`);
        expect(() => wasm.compress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.decompress(bufferOf3GB)).toThrow(`Input data is too large`);
        expect(() => wasm.decompress(compressed3GB)).toThrow(`Content size is too large: ${compressed3GBSize}`);
    });
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');
    it('napi', () => {
        expect(napi.decompress(data)).toHaveProperty('length', 1_048_576);
    });
    it('wasm', () => {
        expect(wasm.decompress(data)).toHaveProperty('length', 1_048_576);
    });
});

describe('should reject empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');
    it('napi', () => {
        expect(() => napi.decompress(data)).toThrow(`Unknown content size`);
    });
    it('wasm', () => {
        expect(() => wasm.decompress(data)).toThrow(`Unknown content size`);
    });
});

describe('should reject uncompleted block', () => {
    const data = wasm.compress(randomBytes(100)).slice(0, -1);
    it('napi', () => {
        expect(() => napi.decompress(data)).toThrow(`Src size is incorrect`);
    });
    it('wasm', () => {
        expect(() => wasm.decompress(data)).toThrow(`Src size is incorrect`);
    });
});
