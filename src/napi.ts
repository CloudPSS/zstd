import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MAX_SIZE } from './config.js';
import { createModule } from './common.js';

/** node bindings */
interface Binding {
    /** compress */
    compress(data: Buffer, level: number): Buffer;
    /** decompress */
    decompress(data: Buffer, maxSize: number): Buffer;
    /** Get zstd version */
    version(): string;
}

const require = createRequire(import.meta.url);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), './../');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
const bindings = require('node-gyp-build')(rootDir) as Binding;

export const { compress, decompress } = createModule({
    coercion: (data) => {
        if (Buffer.isBuffer(data)) return data;
        if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        return Buffer.from(data, 0, data.byteLength);
    },
    compress: (data, level) => bindings.compress(data, level),
    decompress: (data) => bindings.decompress(data, MAX_SIZE),
});

export const ZSTD_VERSION = (): string => bindings.version();

export const TYPE = 'napi';

export const _NapiBindings = bindings;

export default null;
