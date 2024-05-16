import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import { TransformStream } from 'node:stream/web';
import { MAX_SIZE } from './config.js';
import { checkInput, checkLevel, createModule } from './common.js';

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
    /** compress_async */
    compress_async(data: Buffer, level: number, callback: (error: string | null, data: Buffer | null) => void): void;
    /** decompress */
    decompress(data: Buffer, maxSize: number): Buffer;
    /** decompress_async */
    decompress_async(
        data: Buffer,
        maxSize: number,
        callback: (error: string | null, data: Buffer | null) => void,
    ): void;
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

/** NodeJs Transform stream Compressor */
export class Compressor extends Transform {
    private _binding: _Compressor | null = null;
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
            checkInput(chunk);
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
            this._binding = null;
            callback(error);
        } catch (ex) {
            callback(ex as Error);
        }
    }
}
/** NodeJs Transform stream Decompressor */
export class Decompressor extends Transform {
    private _binding: _Decompressor | null = null;
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
            checkInput(chunk);
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
            this._binding = null;
            callback(error);
        } catch (ex) {
            callback(ex as Error);
        }
    }
}

/** Stream compressor */
class WebCompressor implements Transformer<BinaryData, Uint8Array> {
    constructor(readonly level: number) {}

    private _binding: _Compressor | null = null;
    /** @inheritdoc */
    start(): void {
        this._binding = new bindings.Compressor(this.level);
    }

    /** @inheritdoc */
    transform(chunk: BinaryData, controller: TransformStreamDefaultController<Uint8Array>): void {
        checkInput(chunk);
        this._binding!.data(coercion(chunk), (data) => controller.enqueue(data));
    }

    /** @inheritdoc */
    flush(controller: TransformStreamDefaultController<Uint8Array>): void {
        this._binding!.end((data) => controller.enqueue(data));
        this._binding = null;
    }
}

/** Stream decompressor */
class WebDecompressor implements Transformer<BinaryData, Uint8Array> {
    private _binding: _Compressor | null = null;
    /** @inheritdoc */
    start(): void {
        this._binding = new bindings.Decompressor();
    }

    /** @inheritdoc */
    transform(chunk: BinaryData, controller: TransformStreamDefaultController<Uint8Array>): void {
        checkInput(chunk);
        this._binding!.data(coercion(chunk), (data) => controller.enqueue(data));
    }

    /** @inheritdoc */
    flush(controller: TransformStreamDefaultController<Uint8Array>): void {
        this._binding!.end((data) => controller.enqueue(data));
        this._binding = null;
    }
}

export const { compressSync, compress, decompressSync, decompress, compressor, decompressor } = createModule({
    coercion,
    compressSync: (data, level) => bindings.compress(data, level),
    decompressSync: (data) => bindings.decompress(data, MAX_SIZE),
    compress: (data, level) =>
        new Promise((resolve, reject) => {
            bindings.compress_async(data, level, (error, data) => {
                if (error) reject(new Error(error));
                else resolve(data!);
            });
        }),
    decompress: (data) =>
        new Promise((resolve, reject) => {
            bindings.decompress_async(data, MAX_SIZE, (error, data) => {
                if (error) reject(new Error(error));
                else resolve(data!);
            });
        }),
    Compressor: WebCompressor,
    Decompressor: WebDecompressor,
    TransformStream: TransformStream as typeof globalThis.TransformStream,
});

export const ZSTD_VERSION = (): string => bindings.version;

export const TYPE = 'napi';

// For testing purpose
export const _NapiBindings = bindings;

export default null;
