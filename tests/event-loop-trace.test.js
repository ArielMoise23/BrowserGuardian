import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrace, consoleOrderFromTrace } from '../src/simulators/event-loop-trace.js';

describe('buildTrace', () => {
  test('produces a step snapshot per event', () => {
    const events = [
      { kind: 'sync-start', label: 'Global script' },
      { kind: 'sync-end', label: 'Global script' },
    ];
    const steps = buildTrace(events);
    assert.equal(steps.length, 2);
  });

  test('call stack grows on start events and shrinks on matching end events', () => {
    const events = [
      { kind: 'sync-start', label: 'Global script' },
      { kind: 'schedule-macro', label: 'timer#1' },
      { kind: 'sync-end', label: 'Global script' },
      { kind: 'run-macro-start', label: 'timer#1' },
      { kind: 'run-macro-end', label: 'timer#1' },
    ];
    const steps = buildTrace(events);
    assert.deepEqual(steps[0].stack, ['Global script']);
    assert.deepEqual(steps[1].macroQueue, ['timer#1']);
    assert.deepEqual(steps[2].stack, [], 'Global script frame popped on sync-end');
    assert.deepEqual(steps[3].stack, ['timer#1'], 'macrotask frame pushed on run-macro-start');
    assert.deepEqual(steps[3].macroQueue, [], 'consumed from the queue once it starts running');
    assert.deepEqual(steps[4].stack, [], 'macrotask frame popped on run-macro-end');
  });

  test('microtasks and macrotasks are tracked in separate queues', () => {
    const events = [
      { kind: 'schedule-micro', label: 'm1' },
      { kind: 'schedule-macro', label: 't1' },
    ];
    const steps = buildTrace(events);
    assert.deepEqual(steps[1].microQueue, ['m1']);
    assert.deepEqual(steps[1].macroQueue, ['t1']);
  });

  test('console lines accumulate across steps without disturbing the stack/queues', () => {
    const events = [
      { kind: 'sync-start', label: 'Global script' },
      { kind: 'log', level: 'log', text: 'A' },
      { kind: 'log', level: 'log', text: 'B' },
    ];
    const steps = buildTrace(events);
    assert.deepEqual(consoleOrderFromTrace(steps), ['A', 'B']);
    assert.deepEqual(steps[2].stack, ['Global script'], 'log events do not affect the call stack');
  });

  test('reproduces the classic microtask-before-macrotask ordering from real trace events', () => {
    // Mirrors what the worker sandbox actually emits for:
    //   setTimeout(() => console.log('B'), 0); Promise.resolve().then(() => console.log('A'));
    const events = [
      { kind: 'sync-start', label: 'Global script' },
      { kind: 'schedule-macro', label: 'setTimeout #1' },
      { kind: 'schedule-micro', label: 'Promise.then #1 (resolve)' },
      { kind: 'sync-end', label: 'Global script' },
      { kind: 'run-micro-start', label: 'Promise.then #1 (resolve)' },
      { kind: 'log', level: 'log', text: 'A' },
      { kind: 'run-micro-end', label: 'Promise.then #1 (resolve)' },
      { kind: 'run-macro-start', label: 'setTimeout #1' },
      { kind: 'log', level: 'log', text: 'B' },
      { kind: 'run-macro-end', label: 'setTimeout #1' },
    ];
    const steps = buildTrace(events);
    assert.deepEqual(consoleOrderFromTrace(steps), ['A', 'B']);
  });
});
