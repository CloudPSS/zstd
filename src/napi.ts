import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import { TransformStream } from 'node:stream/web';
import { MAX_SIZE } from './config.js';
import { coercionInput, checkLevel } from './utils.js';
import { createModule } from './common.js';

/** Compressor class */
declare class _Compressor {
    /** constructor */
    constructor(level: number);
    /** compress */
    data(data: Uint8Array, callback: (data: Buffer) => void): void;
    /** end */
    end(callback: (data: Buffer) => void): void;
}
/** Decompressor class */
declare class _Decompressor {
    /** constructor */
    constructor();
    /** decompress */
    data(data: Uint8Array, callback: (data: Buffer) => void): void;
    /** end */
    end(callback: (data: Buffer) => void): void;
}

/** node bindings */
interface Binding {
    /** compress */
    compress(data: Uint8Array, level: number): Buffer;
    /** compress_async */
    compress_async(
        data: Uint8Array,
        level: number,
        callback: (error: string | null, data: Buffer | null) => void,
    ): void;
    /** decompress */
    decompress(data: Uint8Array, maxSize: number): Buffer;
    /** decompress_async */
    decompress_async(
        data: Uint8Array,
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
const rootDir = dirname(nodeRequire.resolve('#packageJson'));
const bindings = (nodeRequire('node-gyp-build') as (root: string) => Binding)(rootDir);

/** NodeJs Transform stream Compressor/Decompressor */
abstract class CompressTransform extends Transform {
    protected _binding: _Compressor | _Decompressor | null = null;
    constructor(protected readonly _type: 'Compressor' | 'Decompressor') {
        super({ objectMode: false });
    }
    /** Create napi binding object */
    protected abstract binding(): _Compressor | _Decompressor;
    /** @inheritdoc */
    override _construct(callback: (error?: Error | null) => void): void {
        try {
            this._binding = this.binding();
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`${this._type} is destroyed`);
            this._binding.data(coercionInput(chunk, false), (data) => this.push(data));
            callback();
        } catch (ex) {
            callback(ex as Error);
        }
    }
    /** @inheritdoc */
    override _flush(callback: TransformCallback): void {
        try {
            if (this._binding == null) throw new Error(`${this._type} is destroyed`);
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

/** NodeJs Transform stream Compressor */
export class Compressor extends CompressTransform {
    private readonly _level: number;
    constructor(level?: number) {
        super('Compressor');
        this._level = checkLevel(level);
    }
    /** @inheritdoc */
    protected override binding(): _Compressor {
        return new bindings.Compressor(this._level);
    }
}
/** NodeJs Transform stream Decompressor */
export class Decompressor extends CompressTransform {
    constructor() {
        super('Decompressor');
    }
    /** @inheritdoc */
    protected override binding(): _Compressor {
        return new bindings.Decompressor();
    }
}
/** Web Transform stream Compressor/Decompressor */
abstract class WebCompressTransformer implements Transformer<BufferSource, Uint8Array> {
    protected _binding: _Compressor | _Decompressor | null = null;
    /** @inheritdoc */
    abstract start(): void;

    /** @inheritdoc */
    transform(chunk: BufferSource, controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            this._binding!.data(coercionInput(chunk, false), (data) => controller.enqueue(asUint8Array(data)));
        } catch (ex) {
            controller.error(ex);
            this._binding = null;
        }
    }

    /** @inheritdoc */
    flush(controller: TransformStreamDefaultController<Uint8Array>): void {
        try {
            this._binding!.end((data) => controller.enqueue(asUint8Array(data)));
        } catch (ex) {
            controller.error(ex);
        } finally {
            this._binding = null;
        }
    }
}

/** Stream compressor */
class WebCompressor extends WebCompressTransformer {
    constructor(readonly level: number) {
        super();
    }
    /** @inheritdoc */
    start(): void {
        this._binding = new bindings.Compressor(this.level);
    }
}

/** Stream decompressor */
class WebDecompressor extends WebCompressTransformer {
    /** @inheritdoc */
    start(): void {
        this._binding = new bindings.Decompressor();
    }
}
/** Convert to Uint8Array */
function asUint8Array(buf: Buffer): Uint8Array {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export const { compressSync, compress, decompressSync, decompress, compressor, decompressor } = createModule({
    compressSync: (data, level) => asUint8Array(bindings.compress(data, level)),
    decompressSync: (data) => asUint8Array(bindings.decompress(data, MAX_SIZE)),
    compress: async (data, level) => {
        const bin = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
        return new Promise((resolve, reject) => {
            bindings.compress_async(bin, level, (error, data) => {
                if (error) reject(new Error(error));
                else resolve(asUint8Array(data!));
            });
        });
    },
    decompress: async (data) => {
        const bin = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
        return new Promise((resolve, reject) => {
            bindings.decompress_async(bin, MAX_SIZE, (error, data) => {
                if (error) reject(new Error(error));
                else resolve(asUint8Array(data!));
            });
        });
    },
    Compressor: WebCompressor,
    Decompressor: WebDecompressor,
    TransformStream: TransformStream as typeof globalThis.TransformStream,
});

export const ZSTD_VERSION = (): string => bindings.version;

export const TYPE = 'napi';

// For testing purpose
export const _NapiBindings = bindings;

export default null;
