import createModule, { type Ptr } from '../prebuilds/zstd.js';

/** Wasm module */
export type Module = typeof Module;
export const Module = await createModule();

export { type Ptr };
