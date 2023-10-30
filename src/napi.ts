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
    version: string;
    /** min compress level */
    minLevel: number;
    /** max compress level */
    maxLevel: number;
    /** default compress level */
    defaultLevel: number;
}

const nodeRequire = createRequire(import.meta.url);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), './../');
const bindings = (nodeRequire('node-gyp-build') as (root: string) => Binding)(rootDir);

export const { compress, decompress } = createModule({
    coercion: (data) => {
        if (Buffer.isBuffer(data)) return data;
        if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        return Buffer.from(data, 0, data.byteLength);
    },
    compress: (data, level) => bindings.compress(data, level),
    decompress: (data) => bindings.decompress(data, MAX_SIZE),
});

export const ZSTD_VERSION = (): string => bindings.version;

export const TYPE = 'napi';

// For testing purpose
export const _NapiBindings = bindings;

export default null;
