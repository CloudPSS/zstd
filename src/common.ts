import { MAX_SIZE } from './config.js';

/** check input before coercion */
function checkInput(input: unknown): void {
    if (input == null || typeof input != 'object') throw new TypeError(`Input data must be BinaryData`);

    if (ArrayBuffer.isView(input)) {
        if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
        return;
    }

    if ((typeof ArrayBuffer == 'function' && input instanceof ArrayBuffer) || (typeof SharedArrayBuffer == 'function' && input instanceof SharedArrayBuffer)) {
        if (input.byteLength > MAX_SIZE) throw new Error(`Input data is too large`);
        return;
    }

    throw new TypeError(`Input data must be BinaryData`);
}

/** warp module */
export function createModule<TBinary extends Uint8Array>(options: {
    coercion: (input: BinaryData) => TBinary;
    compress: (data: TBinary, level: number) => TBinary;
    decompress: (data: TBinary) => TBinary;
}): {
    /** ZStandard compress */
    compress: (data: BinaryData, level?: number) => Uint8Array;
    /** ZStandard decompress */
    decompress: (data: BinaryData) => Uint8Array;
} {
    const { coercion, compress, decompress } = options;
    return {
        compress: (data: BinaryData, level = 4) => {
            if (!Number.isSafeInteger(level)) throw new Error('level must be an integer');
            checkInput(data);
            const input = coercion(data);
            const output = compress(input, level);
            return output;
        },
        decompress: (data: BinaryData) => {
            checkInput(data);
            const input = coercion(data);
            const output = decompress(input);
            return output;
        },
    };
}
