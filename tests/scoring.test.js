import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeComposite, computeXpAward, buildResult } from '../src/game/scoring.js';

describe('computeComposite', () => {
  test('averages only the dimensions that are present', () => {
    assert.equal(computeComposite({ correctness: 1 }), 1);
    assert.equal(computeComposite({ correctness: 1, security: 0 }), 0.5);
    assert.equal(computeComposite({ correctness: 0.5, security: 0.5, compatibility: 0.5, performance: 0.5 }), 0.5);
  });

  test('ignores undefined dimensions rather than treating them as zero', () => {
    // A mission that only grades correctness shouldn't be penalized for not having a performance score.
    assert.equal(computeComposite({ correctness: 1, performance: undefined }), 1);
  });

  test('returns 0 for a completely empty score object', () => {
    assert.equal(computeComposite({}), 0);
  });
});

describe('computeXpAward', () => {
  test('scales mission XP by the composite score', () => {
    assert.equal(computeXpAward({ xp: 200 }, 1), 200);
    assert.equal(computeXpAward({ xp: 200 }, 0.5), 100);
    assert.equal(computeXpAward({ xp: 200 }, 0), 0);
  });
});

describe('buildResult', () => {
  test('bundles score, composite, and computed xpAward', () => {
    const result = buildResult({ xp: 100 }, { correctness: 1, security: 1 }, true, ['ok']);
    assert.equal(result.passed, true);
    assert.equal(result.score.composite, 1);
    assert.equal(result.xpAward, 100);
    assert.deepEqual(result.feedback, ['ok']);
  });

  test('a failing partial score still yields a partial (not zero) XP award', () => {
    const result = buildResult({ xp: 100 }, { correctness: 0.5 }, false, []);
    assert.equal(result.xpAward, 50);
  });
});
