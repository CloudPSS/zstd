import { it } from 'node:test';
import assert from 'node:assert/strict';
import * as napi from '@cloudpss/zstd/napi';
import * as wasm from '@cloudpss/zstd/wasm';
import * as root from '@cloudpss/zstd';
import * as config from '@cloudpss/zstd/config';

it('should have correct config', () => {
    assert.equal(config.DEFAULT_LEVEL satisfies number, napi._NapiBindings.defaultLevel);
    assert.equal(config.MIN_LEVEL satisfies number, napi._NapiBindings.minLevel);
    assert.equal(config.MAX_LEVEL satisfies number, napi._NapiBindings.maxLevel);
    assert.ok((config.MAX_SIZE satisfies number) >= 1024 * 1024 * 1024);
});

it('should have correct TYPE', () => {
    assert.equal(napi.TYPE satisfies 'napi', 'napi');
    assert.equal(wasm.TYPE satisfies 'wasm', 'wasm');
    assert.equal(root.TYPE satisfies 'wasm' | 'napi', 'napi');
});

it('should have correct VERSION', () => {
    assert.match(napi.ZSTD_VERSION(), /^\d+\.\d+\.\d+$/);
    assert.match(wasm.ZSTD_VERSION(), /^\d+\.\d+\.\d+$/);
    assert.match(root.ZSTD_VERSION(), /^\d+\.\d+\.\d+$/);

    assert.equal(wasm.ZSTD_VERSION(), root.ZSTD_VERSION());
    assert.equal(napi.ZSTD_VERSION(), root.ZSTD_VERSION());
});
