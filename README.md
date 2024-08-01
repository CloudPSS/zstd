# @cloudpss/zstd

[![check](https://img.shields.io/github/actions/workflow/status/CloudPSS/zstd/check.yml?event=push&logo=github)](https://github.com/CloudPSS/zstd/actions/workflows/check.yml)
[![Codacy coverage](https://img.shields.io/codacy/coverage/c0b6811e7e5f45eeb46383607cac81a8?logo=jest)](https://app.codacy.com/gh/CloudPSS/zstd/dashboard)
[![Codacy Badge](https://img.shields.io/codacy/grade/c0b6811e7e5f45eeb46383607cac81a8?logo=codacy)](https://app.codacy.com/gh/CloudPSS/zstd/dashboard)
[![npm version](https://img.shields.io/npm/v/@cloudpss/zstd?logo=npm)](https://npmjs.org/package/@cloudpss/zstd)

This is a [pure esm package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
contains the [zstd](https://github.com/facebook/zstd) n-api addon for node.js & wasm for browsers.

## Installation

```bash
npm install @cloudpss/zstd
```

## Usage

### Basic

```js
import { compress, decompress } from '@cloudpss/zstd';

const compressed = await compress(new TextEncoder().encode('Hello World!'));
const decompressed = await decompress(compressed);

console.log(new TextDecoder().decode(decompressed)); // Hello World!
```

To explicitly use the wasm or the n-api version, import `@cloudpss/zstd/wasm` and `@cloudpss/zstd/napi` respectively.

## API

### Module `@cloudpss/zstd` / `@cloudpss/zstd/wasm` / `@cloudpss/zstd/napi`

#### `compress(input: BinaryData | Blob, level?: number): Promise<Uint8Array>`<br> `compressSync(input: BinaryData, level?: number): Uint8Array`

Compresses the input data with the given compression level (default: 4).

#### `decompress(input: BinaryData | Blob): Promise<Uint8Array>`<br> `decompressSync(input: BinaryData): Uint8Array`

Decompresses the input data.

#### `TYPE: 'napi' | 'wasm'`

The type of the current module.

#### `ZSTD_VERSION(): string`

The version of the zstd library.

### Module `@cloudpss/zstd/config`

#### `MAX_SIZE: number`

The maximum size of the input/output buffer.

#### `DEFAULT_LEVEL: number`

The default compression level.

#### `MIN_LEVEL: number`

Minimum compression level.

#### `MAX_LEVEL: number`

Maximum compression level.

## License

MIT
