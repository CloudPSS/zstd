import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

it('should have correct config', () => {
    expect(config.DEFAULT_LEVEL satisfies number).toBe(napi._NapiBindings.defaultLevel);
    expect(config.MIN_LEVEL satisfies number).toBe(napi._NapiBindings.minLevel);
    expect(config.MAX_LEVEL satisfies number).toBe(napi._NapiBindings.maxLevel);
    expect(config.MAX_SIZE satisfies number).toBeGreaterThanOrEqual(1024 * 1024 * 1024);
});

it('should have correct TYPE', () => {
    expect(napi.TYPE satisfies 'napi').toBe('napi');
    expect(wasm.TYPE satisfies 'wasm').toBe('wasm');
    expect(root.TYPE satisfies 'wasm' | 'napi').toBe('napi');
});

it('should have correct VERSION', () => {
    console.log(`napi: ${napi.ZSTD_VERSION()}; wasm: ${wasm.ZSTD_VERSION()}; root: ${root.ZSTD_VERSION()}`);

    expect(napi.ZSTD_VERSION() satisfies string).toMatch(/^\d+\.\d+\.\d+$/);
    expect(wasm.ZSTD_VERSION() satisfies string).toMatch(/^\d+\.\d+\.\d+$/);
    expect(root.ZSTD_VERSION() satisfies string).toMatch(/^\d+\.\d+\.\d+$/);
});

it.skip('wasm version should be equal to root version', () => {
    expect(wasm.ZSTD_VERSION()).toBe(root.ZSTD_VERSION());
});

it.skip('napi version should be equal to root version', () => {
    expect(napi.ZSTD_VERSION()).toBe(root.ZSTD_VERSION());
});
