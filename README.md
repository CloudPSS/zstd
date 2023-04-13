# @cloudpss/zstd

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

## API

### `compress(input: ArrayBufferView, level?: number): Buffer`

Compresses the input buffer with the given compression level (default: 4).

### `decompress(input: ArrayBufferView): Buffer`

Decompresses the input buffer.

> Notice: If you are using this library in a browser, the `Buffer` classes is replaced with `Uint8Array` classes.
