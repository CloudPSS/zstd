import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

it('should have correct config', () => {
    expect(config.DEFAULT_LEVEL).toBe(napi._NapiBindings.defaultLevel());
    expect(config.MIN_LEVEL).toBe(napi._NapiBindings.minLevel());
    expect(config.MAX_LEVEL).toBe(napi._NapiBindings.maxLevel());
    expect(config.MAX_SIZE).toBeGreaterThanOrEqual(1024 * 1024 * 1024);
});

describe('should have correct TYPE', () => {
    expect(napi.TYPE).toBe('napi');
    expect(wasm.TYPE).toBe('wasm');
    expect(root.TYPE).toBe('napi');
});

describe('should have correct VERSION', () => {
    expect(napi.ZSTD_VERSION()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(wasm.ZSTD_VERSION()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(root.ZSTD_VERSION()).toMatch(/^\d+\.\d+\.\d+$/);

    expect(wasm.ZSTD_VERSION()).toBe(root.ZSTD_VERSION());
    expect(napi.ZSTD_VERSION()).toBe(root.ZSTD_VERSION());
});