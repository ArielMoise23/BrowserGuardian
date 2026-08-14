import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mission from '../src/missions/chapter8/wrap-fetch-without-breaking-it.js';

// Exercises the mission's own validate() against fabricated sandbox run results —
// standing in for "does the grading logic correctly reward a wrapper that preserves
// arguments/return value/rejection behavior, and correctly penalize one that doesn't"
// without needing a real browser sandbox for this specific check.
describe('wrap-fetch-without-breaking-it: validate()', () => {
  const fullyCorrect = {
    error: null,
    timedOut: false,
    returnValue: {
      resolvesWithResponse: true,
      calledUnderlyingFetch: true,
      forwardedArgs: true,
      propagatesRejection: true,
      logged: true,
    },
  };

  test('a fully correct wrapper passes with a perfect score', () => {
    const result = mission.validate(fullyCorrect);
    assert.equal(result.passed, true);
    assert.equal(result.score.correctness, 1);
    assert.equal(result.score.compatibility, 1);
  });

  test('a wrapper that forgets to return the underlying call fails compatibility, not correctness', () => {
    const broken = {
      ...fullyCorrect,
      returnValue: { ...fullyCorrect.returnValue, resolvesWithResponse: false, propagatesRejection: false },
    };
    const result = mission.validate(broken);
    assert.equal(result.passed, false);
    assert.equal(result.score.correctness, 1, 'it still logged the call, so correctness should not be penalized');
    assert.ok(result.score.compatibility < 1);
  });

  test('a wrapper that never logs fails correctness even if behavior is preserved', () => {
    const silent = { ...fullyCorrect, returnValue: { ...fullyCorrect.returnValue, logged: false } };
    const result = mission.validate(silent);
    assert.equal(result.passed, false);
    assert.equal(result.score.correctness, 0);
    assert.equal(result.score.compatibility, 1);
  });

  test('a sandbox execution error is reported as a full failure, not a crash', () => {
    const result = mission.validate({ error: 'ReferenceError: fetch is not defined', timedOut: false, returnValue: undefined });
    assert.equal(result.passed, false);
    assert.equal(result.score.correctness, 0);
    assert.match(result.feedback[0], /ReferenceError/);
  });

  test('a timeout is reported as a full failure, not a crash', () => {
    const result = mission.validate({ error: null, timedOut: true, returnValue: undefined });
    assert.equal(result.passed, false);
  });
});
