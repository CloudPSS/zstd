import { DEFAULT_LEVEL, MAX_SIZE, MIN_LEVEL, MAX_LEVEL, WORKER_THRESHOLD_SIZE } from './config.js';

/** Check input */
function isBlob(value: NonNullable<unknown>): value is Blob {
    return (
        typeof (value as Blob).size == 'number' &&
        typeof (value as Blob).type == 'string' &&
        typeof (value as Blob).slice == 'function' &&
        typeof (value as Blob).arrayBuffer == 'function' &&
        typeof (value as Blob).text == 'function'
    );
}
/** Check input */
function isArrayBuffer(value: NonNullable<unknown>): value is ArrayBuffer {
    return typeof (value as ArrayBuffer).byteLength == 'number' && typeof (value as ArrayBuffer).slice == 'function';
}

/** check and coercion input */
export function coercionInput<const B extends boolean>(
    input: unknown,
    allowBlob: B,
): B extends true ? Blob | Uint8Array : Uint8Array {
    if (input != null && typeof input == 'object') {
        if (ArrayBuffer.isView(input)) {
            if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
            return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        }

        if (isArrayBuffer(input)) {
            if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
            return new Uint8Array(input);
        }

        if (allowBlob && isBlob(input)) {
            if (input.size > MAX_SIZE) throw new Error(`Input data is too large`);
            return input as B extends true ? Blob : never;
        }
    }

    throw new TypeError(`Input data must be BufferSource${allowBlob ? ' or Blob' : ''}.`);
}

/** check and clamp compress level */
export function checkLevel(level: number | undefined): number {
    if (level == null) return DEFAULT_LEVEL;
    if (typeof level != 'number') throw new Error(`level must be an integer`);
    if (Number.isNaN(level)) return DEFAULT_LEVEL;
    if (level < MIN_LEVEL) return MIN_LEVEL;
    if (level > MAX_LEVEL) return MAX_LEVEL;
    return Math.trunc(level);
}

/** Should use current thread for given data */
export function shouldInPlace(data: Blob | Uint8Array): data is Uint8Array {
    // Always use worker for Blob
    if (!ArrayBuffer.isView(data)) return false;
    return data.byteLength < WORKER_THRESHOLD_SIZE;
}
