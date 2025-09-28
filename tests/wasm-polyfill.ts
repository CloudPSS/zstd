/* eslint-disable @typescript-eslint/unbound-method */
/// <reference lib="webworker" />
import * as nodePolyfill from '../dist/wasm/polyfill/node.js';
import * as browserPolyfill from '../dist/wasm/polyfill/browser.js';
import { jest } from '@jest/globals';

const MODULES = Object.entries({
    node: nodePolyfill,
    browser: browserPolyfill,
});

test.each(MODULES)('%s has correct exports', (name, module) => {
    expect(module).toHaveProperty('Worker');
    expect(module.onMessage).toBeInstanceOf(Function);
    expect(module.postMessage).toBeInstanceOf(Function);
    expect(module).toHaveProperty('TransformStream');
    expect(module.MAX_WORKERS).toBeGreaterThanOrEqual(1);
});

describe('browser polyfill', () => {
    let self: DedicatedWorkerGlobalScope;
    beforeAll(() => {
        self = new EventTarget() as DedicatedWorkerGlobalScope;
        jest.spyOn(self, 'addEventListener');
        self.postMessage = jest.fn();
        Reflect.defineProperty(globalThis, 'self', { value: self, configurable: true });
    });
    afterAll(() => {
        Reflect.deleteProperty(globalThis, 'self');
    });

    it('onMessage', () => {
        const callback = jest.fn();
        browserPolyfill.onMessage(callback);
        expect(self.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
        self.dispatchEvent(new MessageEvent('message', { data: 'test' }));
        expect(callback).toHaveBeenCalledWith('test');
    });

    it('postMessage', () => {
        browserPolyfill.postMessage('test');
        expect(self.postMessage).toHaveBeenCalledWith('test', undefined);
    });
});

describe('node polyfill', () => {
    let worker: nodePolyfill.Worker & { _worker: nodePolyfill.Worker['_worker'] };
    beforeEach(() => {
        worker = new nodePolyfill.Worker(new URL('data:text/javascript;base64,'), {
            type: 'module',
        }) as never;
    });
    afterEach(() => {
        worker?.terminate();
    });

    it('events', () => {
        const onmessage = jest.fn();
        const onmessageerror = jest.fn();
        const onerror = jest.fn();
        // eslint-disable-next-line unicorn/prefer-add-event-listener
        worker.onmessage = onmessage;
        worker.addEventListener('messageerror', onmessageerror);
        // eslint-disable-next-line unicorn/prefer-add-event-listener
        worker.onerror = onerror;

        worker._worker.emit('message', 'message_test');
        worker._worker.emit('messageerror', 'messageerror_test');
        worker._worker.emit('error', new Error('error'));

        expect(onmessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'message',
                data: 'message_test',
            }),
        );
        expect(onmessageerror).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'messageerror',
                data: 'messageerror_test',
            }),
        );
        expect(onerror).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                error: expect.any(Error) as Error,
            }),
        );

        // eslint-disable-next-line unicorn/prefer-add-event-listener
        worker.onmessage = null;
        // eslint-disable-next-line unicorn/prefer-add-event-listener
        worker.onmessageerror = null;
        // eslint-disable-next-line unicorn/prefer-add-event-listener
        worker.onerror = null;
    });

    it('event handlers', () => {
        const onmessage = jest.fn();
        const onmessageerror = jest.fn();
        const onerror = jest.fn();
        worker.addEventListener('message', onmessage);
        worker.addEventListener('messageerror', onmessageerror);
        worker.addEventListener('error', onerror);

        worker._worker.emit('message', 'message_test');
        worker._worker.emit('messageerror', 'messageerror_test');
        worker._worker.emit('error', new Error('error'));

        expect(onmessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'message',
                data: 'message_test',
            }),
        );
        expect(onmessageerror).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'messageerror',
                data: 'messageerror_test',
            }),
        );
        expect(onerror).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                error: expect.any(Error) as Error,
            }),
        );

        worker.removeEventListener('message', onmessage);
        worker.removeEventListener('messageerror', onmessageerror);
        worker.removeEventListener('error', onerror);
    });

    it('postMessage', () => {
        jest.spyOn(worker._worker, 'postMessage');

        worker.postMessage('test');
        expect(worker._worker.postMessage).toHaveBeenCalledWith('test', []);

        worker.postMessage('test', [new ArrayBuffer(0)]);
        expect(worker._worker.postMessage).toHaveBeenCalledWith('test', [expect.any(ArrayBuffer)]);

        worker.postMessage('test', { transfer: [new ArrayBuffer(0)] });
        expect(worker._worker.postMessage).toHaveBeenCalledWith('test', [expect.any(ArrayBuffer)]);
    });
});
