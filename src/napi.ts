import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_LEVEL, MAX_SIZE } from './config.js';

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

/** Convert to buffer */
function asBuffer(data: unknown): Buffer {
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (!ArrayBuffer.isView(data)) throw new Error('data must be an array buffer view');
    if (Buffer.isBuffer(data)) return data;
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/** ZStandard compress */
export function compress(data: BinaryData, level = DEFAULT_LEVEL): Buffer {
    if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
    const buf = asBuffer(data);
    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    return bindings.compress(buf, level);
}

/** ZStandard decompress */
export function decompress(data: BinaryData): Buffer {
    const buf = asBuffer(data);
    if (buf.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
    return bindings.decompress(buf, MAX_SIZE);
}

export const ZSTD_VERSION = (): string => bindings.version();

export const TYPE = 'napi';

export const _NapiBindings = bindings;
