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
    ['napi', async (data: BufferSource, level?: number) => await napi.decompress(await napi.compress(data, level))],
    ['wasm', async (data: BufferSource, level?: number) => await wasm.decompress(await wasm.compress(data, level))],
] as const;

afterAll(() => {
    wasm.terminate();
});

describe.each([
    ['napi', napi],
    ['wasm', wasm],
])(`%s async api`, (key, api) => {
    it('should return uint8array', async () => {
        await expect(api.compress(randomBuffer)).resolves.toBeInstanceOf(Uint8Array);
        await expect(api.compress(zeroBuffer)).resolves.toBeInstanceOf(Uint8Array);
        await expect(api.decompress(await api.compress(randomBuffer))).resolves.toBeInstanceOf(Uint8Array);
        await expect(api.decompress(await api.compress(zeroBuffer))).resolves.toBeInstanceOf(Uint8Array);
    });
    it('should not return buffer', async () => {
        await expect(api.compress(randomBuffer)).resolves.not.toBeInstanceOf(Buffer);
        await expect(api.compress(zeroBuffer)).resolves.not.toBeInstanceOf(Buffer);
        await expect(api.decompress(await api.compress(randomBuffer))).resolves.not.toBeInstanceOf(Buffer);
        await expect(api.decompress(await api.compress(zeroBuffer))).resolves.not.toBeInstanceOf(Buffer);
    });
});

test('napi & wasm async compress should got same result', async () => {
    await expect(napi.compress(randomBuffer)).resolves.toEqual(wasm.compressSync(randomBuffer));
    await expect(napi.compress(zeroBuffer)).resolves.toEqual(wasm.compressSync(zeroBuffer));
    await expect(napi.compress(zeroFloat64Array)).resolves.toEqual(wasm.compressSync(zeroFloat64Array));
});

test('napi async api should run in parallel', async () => {
    const parallel = Array.from({ length: 16384 }).map(() => napi.compress(new Uint8Array(1024)));
    await expect(Promise.all(parallel)).resolves.toHaveLength(16384);
}, 10000);

test('wasm async api should run in parallel', async () => {
    wasm.terminate();
    const parallel = Array.from({ length: 16384 }).map(() => wasm.compress(new Uint8Array(1024)));
    await expect(Promise.all(parallel)).resolves.toHaveLength(16384);
    expect(wasm.workers()).toEqual({ idle: availableParallelism() - 1, busy: 0 });
    wasm.terminate();
    expect(wasm.workers()).toEqual({ idle: 0, busy: 0 });
}, 10000);

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
        expect(await roundtrip(randomBuffer)).toEqual(randomBuffer);
    });
    it('empty buffer', async () => {
        expect(await roundtrip(zeroBuffer)).toEqual(zeroBuffer);
    });
    it('float64array', async () => {
        expect(await roundtrip(zeroFloat64Array)).toEqual(zeroBuffer);
    });
    it('dataview', async () => {
        expect(await roundtrip(zeroDataView)).toEqual(zeroBuffer);
    });
    it('arraybuffer', async () => {
        expect(await roundtrip(zeroBuffer.buffer)).toEqual(zeroBuffer);
    });
});

describe('should reject bad buffer data', () => {
    for (const [key, method] of ALL) {
        it(key, async () => {
            const e = `Input data must be BufferSource`;
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
            await expect(() => compress(zeroBuffer, '1')).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(zeroBuffer, {})).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(zeroBuffer, [])).rejects.toThrow();
            // @ts-expect-error ts(2345)
            // eslint-disable-next-line unicorn/new-for-builtins
            await expect(() => compress(zeroBuffer, new Number(1))).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(zeroBuffer, true)).rejects.toThrow();
            // @ts-expect-error ts(2345)
            await expect(() => compress(zeroBuffer, { valueOf: () => 1 })).rejects.toThrow();
        });
    }
});

describe('should accept allowed level', () => {
    for (const [key, compress] of COMPRESS) {
        it(key, async () => {
            // @ts-expect-error ts(2345)
            await expect(compress(zeroBuffer, null)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, undefined)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, 1.2)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, Number.NaN)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, Number.MAX_VALUE)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, -Number.MAX_VALUE)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, -Number.MIN_VALUE)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, -Infinity)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, Infinity)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, Number.MAX_SAFE_INTEGER)).resolves.not.toThrow();
            await expect(compress(zeroBuffer, Number.MIN_SAFE_INTEGER)).resolves.not.toThrow();
        });
    }
});

describe('should accept huge input', () => {
    it('napi', async () => {
        const hugeBuffer = Buffer.alloc(config.MAX_SIZE);
        await expect(napi.compress(hugeBuffer)).resolves.toBeDefined();
    }, 30000);
    it('wasm', async () => {
        // For wasm, the max heap size is 2GB, so we can only allocate 0.8GB for input
        const hugeBuffer = Buffer.alloc(0.8 * 1024 * 1024 * 1024);
        await expect(wasm.compress(hugeBuffer)).resolves.toBeDefined();
    }, 30000);
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
    }, 30000);
    it('wasm', async () => {
        const hugeBuffer = Buffer.alloc(1 * 1024 * 1024 * 1024);
        await expect(() => wasm.compress(hugeBuffer)).rejects.toThrow(`Failed to allocate memory`);
        await expect(() => wasm.compress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.compress(bufferOf3GB.buffer)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.decompress(bufferOf3GB)).rejects.toThrow(`Input data is too large`);
        await expect(() => wasm.decompress(compressed3GB)).rejects.toThrow(
            `Content size is too large: ${compressed3GBSize}`,
        );
    }, 30000);
});

describe('should reject bad compressed data', () => {
    for (const [key, decompress] of DECOMPRESS) {
        it(key, async () => {
            await expect(() => decompress(zeroBuffer)).rejects.toThrow('Invalid compressed data');
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
