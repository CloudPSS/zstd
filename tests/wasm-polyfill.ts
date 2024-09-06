/* eslint-disable unicorn/prefer-add-event-listener */
/* eslint-disable @typescript-eslint/unbound-method */
/// <reference lib="webworker" />
import { describe, it, before, after, mock, beforeEach, afterEach, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import * as nodePolyfill from '../dist/wasm/polyfill/node.js';
import * as browserPolyfill from '../dist/wasm/polyfill/browser.js';

const MODULES = Object.entries({
    node: nodePolyfill,
    browser: browserPolyfill,
});

describe('wasm polyfill', () => {
    for (const [name, module] of MODULES) {
        it(`${name} has correct exports`, () => {
            if (name === 'node') {
                // No browser environment to have a global Worker
                assert.ok(module.Worker instanceof Function);
            }
            assert.ok(module.onMessage instanceof Function);
            assert.ok(module.postMessage instanceof Function);
            assert.ok(module.TransformStream instanceof Function);
            assert.ok(module.MAX_WORKERS >= 1);
        });
    }
});

describe('browser polyfill', () => {
    let self: DedicatedWorkerGlobalScope;
    let addEventListener: Mock<DedicatedWorkerGlobalScope['addEventListener']>;
    let postMessage: Mock<DedicatedWorkerGlobalScope['postMessage']>;
    before(() => {
        self = new EventTarget() as DedicatedWorkerGlobalScope;
        addEventListener = self.addEventListener = mock.fn(self.addEventListener);
        postMessage = self.postMessage = mock.fn();
        Reflect.defineProperty(globalThis, 'self', { value: self, configurable: true });
    });
    after(() => {
        Reflect.deleteProperty(globalThis, 'self');
    });

    it('onMessage', () => {
        const callback = mock.fn();
        browserPolyfill.onMessage(callback);
        assert.equal(addEventListener.mock.callCount(), 1);
        assert.equal(addEventListener.mock.calls[0]!.arguments[0], 'message');
        assert(addEventListener.mock.calls[0]!.arguments[1] instanceof Function);
        self.dispatchEvent(new MessageEvent('message', { data: 'test' }));
        assert.equal(callback.mock.calls[0]!.arguments[0], 'test');
    });

    it('postMessage', () => {
        browserPolyfill.postMessage('test');
        assert.equal(postMessage.mock.callCount(), 1);
        assert.equal(postMessage.mock.calls[0]!.arguments[0], 'test');
        assert.equal(postMessage.mock.calls[0]!.arguments[1], undefined);
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
        const onmessage = mock.fn<NonNullable<Worker['onmessage']>>();
        const onmessageerror = mock.fn<NonNullable<Worker['onmessageerror']>>();
        const onerror = mock.fn<NonNullable<Worker['onerror']>>();
        (worker as Worker).onmessage = onmessage;
        (worker as Worker).onmessageerror = onmessageerror;
        (worker as Worker).onerror = onerror;

        worker._worker.emit('message', 'message_test');
        worker._worker.emit('messageerror', 'messageerror_test');
        worker._worker.emit('error', new Error('error'));

        assert.equal(onmessage.mock.callCount(), 1);
        assert.equal(onmessage.mock.calls[0]!.arguments[0].type, 'message');
        assert.equal(onmessage.mock.calls[0]!.arguments[0].data, 'message_test');

        assert.equal(onmessageerror.mock.callCount(), 1);
        assert.equal(onmessageerror.mock.calls[0]!.arguments[0].type, 'messageerror');
        assert.equal(onmessageerror.mock.calls[0]!.arguments[0].data, 'messageerror_test');

        assert.equal(onerror.mock.callCount(), 1);
        assert.equal(onerror.mock.calls[0]!.arguments[0].type, 'error');
        assert.equal((onerror.mock.calls[0]!.arguments[0].error as Error).message, 'error');

        worker.onmessage = null;
        worker.onmessageerror = null;
        worker.onerror = null;
    });

    it('event handlers', () => {
        const onmessage = mock.fn<NonNullable<Worker['onmessage']>>();
        const onmessageerror = mock.fn<NonNullable<Worker['onmessageerror']>>();
        const onerror = mock.fn<NonNullable<Worker['onerror']>>();
        (worker as Worker).addEventListener('message', onmessage);
        (worker as Worker).addEventListener('messageerror', onmessageerror);
        (worker as Worker).addEventListener('error', onerror);

        worker._worker.emit('message', 'message_test');
        worker._worker.emit('messageerror', 'messageerror_test');
        worker._worker.emit('error', new Error('error'));

        assert.equal(onmessage.mock.callCount(), 1);
        assert.equal(onmessage.mock.calls[0]!.arguments[0].type, 'message');
        assert.equal(onmessage.mock.calls[0]!.arguments[0].data, 'message_test');

        assert.equal(onmessageerror.mock.callCount(), 1);
        assert.equal(onmessageerror.mock.calls[0]!.arguments[0].type, 'messageerror');
        assert.equal(onmessageerror.mock.calls[0]!.arguments[0].data, 'messageerror_test');

        assert.equal(onerror.mock.callCount(), 1);
        assert.equal(onerror.mock.calls[0]!.arguments[0].type, 'error');
        assert.equal((onerror.mock.calls[0]!.arguments[0].error as Error).message, 'error');

        (worker as Worker).removeEventListener('message', onmessage);
        (worker as Worker).removeEventListener('messageerror', onmessageerror);
        (worker as Worker).removeEventListener('error', onerror);
    });

    it('postMessage', () => {
        const postMessage = mock.fn(worker._worker.postMessage);
        worker._worker.postMessage = postMessage;

        worker.postMessage('test');
        assert.equal(postMessage.mock.callCount(), 1);
        assert.deepEqual(postMessage.mock.calls[0]!.arguments, ['test', []]);

        worker.postMessage('test', [new ArrayBuffer(0)]);
        assert.equal(postMessage.mock.callCount(), 2);
        assert.equal(postMessage.mock.calls[1]!.arguments[0], 'test');
        assert(postMessage.mock.calls[1]!.arguments[1]![0] instanceof ArrayBuffer);
        assert(postMessage.mock.calls[1]!.arguments[1]![0].detached);

        worker.postMessage('test', { transfer: [new ArrayBuffer(0)] });
        assert.equal(postMessage.mock.callCount(), 3);
        assert.equal(postMessage.mock.calls[2]!.arguments[0], 'test');
        assert(postMessage.mock.calls[2]!.arguments[1]![0] instanceof ArrayBuffer);
        assert(postMessage.mock.calls[2]!.arguments[1]![0].detached);
    });
});
