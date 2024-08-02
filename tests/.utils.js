import { randomBytes } from 'node:crypto';

export const randomBuffer = asUint8Array(randomBytes(1000));

export const zeroBuffer = new Uint8Array(1000);
export const zeroFloat64Array = new Float64Array(1000 / 8);
export const zeroDataView = new DataView(zeroFloat64Array.buffer);

export const emptyRaw = new Uint8Array(0);
export const emptyCompressed = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x20, 0x00, 0x01, 0x00, 0x00]);

/**
 * 转换 buffer
 * @param {ArrayBufferView} data
 * @returns {Uint8Array}
 */
export function asUint8Array(data) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
