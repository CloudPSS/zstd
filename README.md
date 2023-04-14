# @cloudpss/zstd

[![check](https://img.shields.io/github/actions/workflow/status/CloudPSS/zstd/check.yml?event=push&logo=github)](https://github.com/CloudPSS/zstd/actions/workflows/check.yml)
[![Codacy coverage](https://img.shields.io/codacy/coverage/c0b6811e7e5f45eeb46383607cac81a8?logo=jest)](https://app.codacy.com/gh/CloudPSS/zstd/dashboard)
[![Codacy Badge](https://img.shields.io/codacy/grade/c0b6811e7e5f45eeb46383607cac81a8?logo=codacy)](https://app.codacy.com/gh/CloudPSS/zstd/dashboard)
[![npm version](https://img.shields.io/npm/v/@cloudpss/zstd?logo=npm)](https://npmjs.org/package/@cloudpss/zstd)

This is a [pure esm package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) contains the [zstd](http://github.com/facebook/zstd) n-api addon for node.js & wasm for browsers.

## Installation

```bash
npm install @cloudpss/zstd
```

## Usage

```js
import { compress, decompress } from '@cloudpss/zstd';

const compressed = compress(Buffer.from('Hello World!'));
const decompressed = decompress(compressed);

console.log(decompressed.toString()); // Hello World!
```

To explicitly use the wasm or the n-api version, import `@cloudpss/zstd/wasm` and `@cloudpss/zstd/napi` respectively.

## API

### `@cloudpss/zstd` / `@cloudpss/zstd/wasm` / `@cloudpss/zstd/napi`

#### `compress(input: BinaryData, level?: number): Buffer`

Compresses the input buffer with the given compression level (default: 4).

#### `decompress(input: BinaryData): Buffer`

Decompresses the input buffer.

#### `TYPE: 'napi' | 'wasm'`

The type of the current module.

> Notice: If you are using this library in a browser, the `Buffer` classes is replaced with `Uint8Array` classes.

### `@cloudpss/zstd/config`

#### `ZSTD_VERSION: string`

The version of the zstd library.

#### `MAX_SIZE: number`

The maximum size of the input/output buffer.

#### `DEFAULT_LEVEL: number`

The default compression level.

## License

MIT
