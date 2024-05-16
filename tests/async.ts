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

afterAll(() => {
    wasm.terminate();
});

test('napi async api should return buffer', async () => {
    await expect(napi.compress(randomBuffer)).resolves.toBeInstanceOf(Buffer);
    await expect(napi.compress(emptyBuffer)).resolves.toBeInstanceOf(Buffer);
    await expect(napi.decompress(napi.compressSync(randomBuffer))).resolves.toBeInstanceOf(Buffer);
    await expect(napi.decompress(napi.compressSync(emptyBuffer))).resolves.toBeInstanceOf(Buffer);
});

test('wasm async api should return uint8array', async () => {
    await expect(wasm.compress(randomBuffer)).resolves.toBeInstanceOf(Uint8Array);
    await expect(wasm.compress(emptyBuffer)).resolves.toBeInstanceOf(Uint8Array);
    await expect(wasm.decompress(wasm.compressSync(randomBuffer))).resolves.toBeInstanceOf(Uint8Array);
    await expect(wasm.decompress(wasm.compressSync(emptyBuffer))).resolves.toBeInstanceOf(Uint8Array);
});

test('wasm async api should not return buffer', async () => {
    await expect(wasm.compress(randomBuffer)).resolves.not.toBeInstanceOf(Buffer);
    await expect(wasm.compress(emptyBuffer)).resolves.not.toBeInstanceOf(Buffer);
    await expect(wasm.decompress(wasm.compressSync(randomBuffer))).resolves.not.toBeInstanceOf(Buffer);
    await expect(wasm.decompress(wasm.compressSync(emptyBuffer))).resolves.not.toBeInstanceOf(Buffer);
});

test('napi & wasm async compress should got same result', async () => {
    await expect(napi.compress(randomBuffer)).resolves.toEqual(asBuffer(wasm.compressSync(randomBuffer)));
    await expect(napi.compress(emptyBuffer)).resolves.toEqual(asBuffer(wasm.compressSync(emptyBuffer)));
    await expect(napi.compress(emptyFloat64Array)).resolves.toEqual(asBuffer(wasm.compressSync(emptyFloat64Array)));
});

test.each(COMPRESS)('%s async compress should not transfer input', async (key, compress) => {
    const data = new Uint8Array(1000);
    await compress(data);
    expect(data.buffer.byteLength).toBe(1000);
});

test.each(DECOMPRESS)('%s async compress should not transfer input', async (key, decompress) => {
    const data = root.compressSync(new Uint8Array(1000));
    const dataSize = data.buffer.byteLength;
    await decompress(data);
    expect(data.buffer.byteLength).toBe(dataSize);
});

describe.each(ROUNDTRIP)('%s async roundtrip should got same result', (key, roundtrip) => {
    it('random buffer', async () => {
        expect(asBuffer(await roundtrip(randomBuffer))).toEqual(randomBuffer);
    });
    it('empty buffer', async () => {
        expect(asBuffer(await roundtrip(emptyBuffer))).toEqual(emptyBuffer);
    });
    it('float64array', async () => {
        expect(asBuffer(await roundtrip(emptyFloat64Array))).toEqual(emptyBuffer);
    });
    it('dataview', async () => {
        expect(asBuffer(await roundtrip(emptyDataView))).toEqual(emptyBuffer);
    });
    it('arraybuffer', async () => {
        expect(asBuffer(await roundtrip(emptyBuffer.buffer))).toEqual(emptyBuffer);
    });
});

describe('should reject bad buffer data', () => {
    for (const [key, method] of ALL) {
        it(key, async () => {
            const e = `Input data must be BinaryData`;
            // @ts-expect-error ts(2345)
            await expect(() => method(1)).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method('')).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method({})).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method([])).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method(null)).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method(undefined)).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method(true)).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method(true)).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method({ byteLength: -1 })).rejects.toThrow(e);
            // @ts-expect-error ts(2345)
            await expect(() => method({ byteLength: 0 })).rejects.toThrow(e);
        });
    }
});

describe('should reject bad level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            // @ts-expect-error ts(2345)
            await expect(() => compress(emptyBuffer, '1')).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(emptyBuffer, {})).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(emptyBuffer, [])).rejects.toThrow();
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            await expect(() => compress(emptyBuffer, new Number(1))).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(emptyBuffer, true)).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(emptyBuffer, { valueOf: () => 1 })).rejects.toThrow();
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            // @ts-expect-error ts(2345)
            await expect(compress(emptyBuffer, null)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, undefined)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, 1.2)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, Number.NaN)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, Number.MAX_VALUE)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, -Number.MAX_VALUE)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, -Number.MIN_VALUE)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, -Infinity)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, Infinity)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, Number.MAX_SAFE_INTEGER)).resolves.not.toThrow();
            await expect(compress(emptyBuffer, Number.MIN_SAFE_INTEGER)).resolves.not.toThrow();
        });
    }
});

describe('should accept huge input', () => {
    it('napi', async () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        await expect(napi.compress(hugeBuffer)).resolves.toBeDefined();
    }, 10000);
    it('wasm', async () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        await expect(wasm.compress(hugeBuffer)).resolves.toBeDefined();
    }, 10000);
});

describe('should reject huge input', () => {
    const bufferOf3GB = Buffer.alloc(3 * 1024 * 1024 * 1024);
    /** will decompress to 3147483645 bytes */
    const compressed3GBSize = 3_147_483_645;
    const compressed3GB = root.decompressSync(
        Buffer.from('KLUv/aBLdwEAPQEA+Ci1L/2AWP3JmrtUAAAQAAABAPv/OcACAgAQAOtPBgABAKfcnbsx', 'base64'),
    );
    it('napi', async () => {
        await expect(() => napi.compress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => napi.compress(bufferOf3GB.buffer)).rejects.toThrow(`Input data is too large`);
        await expect(() => napi.decompress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => napi.decompress(compressed3GB)).rejects.toThrow(`Content size is too large`);
    });
    it('wasm', async () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        await expect(() => wasm.compress(hugeBuffer)).rejects.toThrow(`Failed to allocate memory`);
        await expect(() => wasm.compress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.compress(bufferOf3GB.buffer)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.decompress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.decompress(compressed3GB)).rejects.toThrow(
            `Content size is too large: ${compressed3GBSize}`,
        );
    });
});

describe('should reject bad compressed data', () => {
    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await expect(() => decompress(emptyBuffer)).rejects.toThrow('Invalid compressed data');
        });
    }
});

describe('should accept rle first block', () => {
    const data = Buffer.from('KLUv/aQAABAAAgAQAAIAEAACABAAAgAQAAIAEAACABAAAgAQAAMAEADxPhbh', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await expect(decompress(data)).resolves.toHaveProperty('length', 1_048_576);
        });
    }
});

describe('should accept empty block', () => {
    const data = Buffer.from('KLUv/QAAFQAAAAA=', 'base64');

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await expect(decompress(data)).resolves.toHaveProperty('length', 0);
        });
    }
});

describe('should reject uncompleted block', () => {
    const data = wasm.compressSync(randomBytes(100)).slice(0, -1);

    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await expect(() => decompress(data)).rejects.toThrow(`Invalid compressed data`);
        });
    }
});
