import * as common from './common.js';
import { onMessage, postMessage } from '#worker-polyfill';

/** Worker request */
export type WorkerRequest = [number, 'compress', [Uint8Array, number]] | [number, 'decompress', [Uint8Array]];
/** Worker response */
export type WorkerResponse = [number, Uint8Array] | [number, null, Error];
/** Worker ready */
export type WorkerReady = 'ready';

onMessage((data) => {
    const [seq, method, args] = data as WorkerRequest;
    try {
        switch (method) {
            case 'compress': {
                const [src, level] = args;
                const dst = common.compress(src, level);
                postMessage([seq, dst], [dst.buffer]);
                break;
            }
            case 'decompress': {
                const [src] = args;
                const dst = common.decompress(src);
                postMessage([seq, dst], [dst.buffer]);
                break;
            }
            default:
                throw new Error('Invalid method');
        }
    } catch (err) {
        postMessage([seq, null, err]);
    }
});

postMessage('ready' satisfies WorkerReady);
