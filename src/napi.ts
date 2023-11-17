import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import { MAX_SIZE } from './config.js';
import { checkLevel, createModule } from './common.js';

/** Compressor class */
declare class _Compressor {
    /** constructor */
    constructor(level: number);
    /** compress */
    data(data: Buffer, callback: (data: Buffer) => void): void;
    /** end */
    end(callback: (data: Buffer) => void): void;
}
/** Decompressor class */
declare class _Decompressor {
    /** constructor */
    constructor();
    /** decompress */
    data(data: Buffer, callback: (data: Buffer) => void): void;
    /** end */
    end(callback: (data: Buffer) => void): void;
}

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

    /** recommended size for input buffer */
    compressInputLength: number;
    /** recommended size for output buffer */
    compressOutputLength: number;
    /** recommended size for input buffer */
    decompressInputLength: number;
    /** recommended size for output buffer */
    decompressOutputLength: number;

    /** Compressor class */
    Compressor: typeof _Compressor;
    /** Decompressor class */
    Decompressor: typeof _Decompressor;
}

const nodeRequire = createRequire(import.meta.url);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), './../');
const bindings = (nodeRequire('node-gyp-build') as (root: string) => Binding)(rootDir);

const coercion = (data: BinaryData): Buffer => {
    if (Buffer.isBuffer(data)) return data;
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    return Buffer.from(data, 0, data.byteLength);
};

export const { compress, decompress } = createModule({
    coercion,
    compress: (data, level) => bindings.compress(data, level),
    decompress: (data) => bindings.decompress(data, MAX_SIZE),
});

/** NodeJs Transform stream Compressor */
export class Compressor extends Transform {
    private _binding?: _Compressor | undefined;
    private readonly _level: number;
    constructor(level?: number) {
        super({ objectMode: false });
        this._level = checkLevel(level);
    }
    /** @inheritdoc */
    override _construct(callback: (error?: Error | null | undefined) => void): void {
        try {
            this._binding = new bindings.Compressor(this._level);
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`Compressor is destroyed`);
            this._binding.data(chunk, (data) => this.push(data));
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _flush(callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`Compressor is destroyed`);
            this._binding.end((data) => this.push(data));
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _destroy(error: Error | null, callback: (error: Error | null) => void): void {
        try {
            this._binding = undefined;
            callback(error);
        } catch (ex) {
            callback(ex as Error);
        }
    }
}
/** NodeJs Transform stream Decompressor */
export class Decompressor extends Transform {
    private _binding?: _Decompressor | undefined;
    constructor() {
        super({ objectMode: false });
    }
    /** @inheritdoc */
    override _construct(callback: (error?: Error | null | undefined) => void): void {
        try {
            this._binding = new bindings.Decompressor();
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`Decompressor is destroyed`);
            this._binding.data(chunk, (data) => this.push(data));
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _flush(callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`Decompressor is destroyed`);
            this._binding.end((data) => this.push(data));
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _destroy(error: Error | null, callback: (error: Error | null) => void): void {
        try {
            this._binding = undefined;
            callback(error);
        } catch (ex) {
            callback(ex as Error);
        }
    }
}

export const ZSTD_VERSION = (): string => bindings.version;

export const TYPE = 'napi';

// For testing purpose
export const _NapiBindings = bindings;

export default null;
