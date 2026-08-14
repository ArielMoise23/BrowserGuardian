import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_TYPES, makeEnvelope, isValidEnvelope, nextNonce, serializeArg } from '../src/sandbox/protocol.js';

describe('envelope construction', () => {
  test('makeEnvelope stamps the channel and a nonce', () => {
    const env = makeEnvelope(MESSAGE_TYPES.LOG, { level: 'log', text: 'hi' });
    assert.equal(env.channel, 'bg-rdl');
    assert.equal(env.type, MESSAGE_TYPES.LOG);
    assert.ok(env.nonce);
  });

  test('nextNonce never repeats', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i += 1) seen.add(nextNonce());
    assert.equal(seen.size, 1000);
  });
});

describe('isValidEnvelope', () => {
  test('accepts a well-formed envelope', () => {
    assert.equal(isValidEnvelope(makeEnvelope(MESSAGE_TYPES.DONE, {})), true);
  });

  test('rejects messages missing the channel marker (e.g. from an unrelated postMessage)', () => {
    assert.equal(isValidEnvelope({ type: MESSAGE_TYPES.DONE, payload: {} }), false);
  });

  test('rejects messages with an unknown type', () => {
    assert.equal(isValidEnvelope({ channel: 'bg-rdl', type: 'not-a-real-type' }), false);
  });

  test('rejects non-object payloads', () => {
    assert.equal(isValidEnvelope(null), false);
    assert.equal(isValidEnvelope('a string'), false);
    assert.equal(isValidEnvelope(42), false);
  });

  test('rejects a forged envelope missing the type field', () => {
    assert.equal(isValidEnvelope({ channel: 'bg-rdl', payload: {} }), false);
  });
});

describe('serializeArg', () => {
  test('serializes primitives, functions, errors, and objects distinctly', () => {
    assert.equal(serializeArg(undefined), 'undefined');
    assert.equal(serializeArg(42), '42');
    assert.equal(serializeArg('x'), 'x');
    assert.match(serializeArg(function namedFn() {}), /ƒ namedFn/);
    assert.match(serializeArg(new Error('boom')), /Error: boom/);
    assert.equal(serializeArg({ a: 1 }), '{"a":1}');
  });

  test('never throws, even on a value that cannot be serialized', () => {
    const circular = {};
    circular.self = circular;
    assert.doesNotThrow(() => serializeArg(circular));
  });
});
