import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, computeLevel, xpProgress, computeStreaks, recordMissionResult, todayIso } from '../src/state/progress.js';
import { defaultState } from '../src/state/persistence.js';

describe('level curve', () => {
  test('level 1 requires 0 XP', () => {
    assert.equal(computeLevel(0), 1);
  });

  test('computeLevel matches xpForLevel thresholds', () => {
    for (let level = 1; level <= 10; level += 1) {
      const threshold = xpForLevel(level);
      assert.equal(computeLevel(threshold), level, `at exactly the threshold for level ${level}`);
      assert.equal(computeLevel(threshold - 1) < level, threshold > 0, `just under the threshold for level ${level}`);
    }
  });

  test('xpProgress reports fraction within [0,1)', () => {
    const p = xpProgress(250);
    assert.ok(p.fraction >= 0 && p.fraction < 1);
    assert.equal(p.xpIntoLevel + xpForLevel(p.level), 250);
  });
});

describe('streaks', () => {
  test('empty history has zero streak', () => {
    assert.deepEqual(computeStreaks([]), { current: 0, best: 0 });
  });

  test('consecutive days build a current streak', () => {
    const s = computeStreaks(['2026-08-10', '2026-08-11', '2026-08-12'], '2026-08-12');
    assert.equal(s.current, 3);
    assert.equal(s.best, 3);
  });

  test('a gap breaks the current streak but preserves best', () => {
    const s = computeStreaks(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10'], '2026-08-10');
    assert.equal(s.current, 1);
    assert.equal(s.best, 3);
  });

  test('streak is still current the day after last activity (not yet broken)', () => {
    const s = computeStreaks(['2026-08-10', '2026-08-11'], '2026-08-12');
    assert.equal(s.current, 2);
  });

  test('streak is broken two days after last activity', () => {
    const s = computeStreaks(['2026-08-10', '2026-08-11'], '2026-08-13');
    assert.equal(s.current, 0);
  });

  test('duplicate dates in the same day do not inflate the streak', () => {
    const s = computeStreaks(['2026-08-10', '2026-08-10', '2026-08-11'], '2026-08-11');
    assert.equal(s.current, 2);
  });
});

describe('recordMissionResult', () => {
  test('awards XP on first pass and marks completed', () => {
    const state = defaultState();
    const result = { passed: true, score: { composite: 1 }, xpAward: 100 };
    const next = recordMissionResult(state, 'mission-a', result, new Date('2026-08-14T00:00:00Z'));
    assert.equal(next.xp, 100);
    assert.equal(next.missions['mission-a'].completed, true);
    assert.equal(next.missions['mission-a'].attempts, 1);
    assert.deepEqual(next.activityDates, [todayIso(new Date('2026-08-14T00:00:00Z'))]);
  });

  test('does not re-award XP for a second passing attempt on an already-completed mission', () => {
    let state = defaultState();
    const passResult = { passed: true, score: { composite: 1 }, xpAward: 100 };
    state = recordMissionResult(state, 'mission-a', passResult, new Date('2026-08-14T00:00:00Z'));
    state = recordMissionResult(state, 'mission-a', passResult, new Date('2026-08-14T01:00:00Z'));
    assert.equal(state.xp, 100);
    assert.equal(state.missions['mission-a'].attempts, 2);
  });

  test('a failed attempt records the attempt without awarding XP or completing', () => {
    const state = defaultState();
    const result = { passed: false, score: { composite: 0.3 }, xpAward: 30 };
    const next = recordMissionResult(state, 'mission-a', result, new Date('2026-08-14T00:00:00Z'));
    assert.equal(next.xp, 0);
    assert.equal(next.missions['mission-a'].completed, false);
    assert.equal(next.missions['mission-a'].attempts, 1);
  });

  test('bestScore keeps the highest composite seen across attempts', () => {
    let state = defaultState();
    state = recordMissionResult(state, 'mission-a', { passed: false, score: { composite: 0.4 }, xpAward: 40 }, new Date('2026-08-14T00:00:00Z'));
    state = recordMissionResult(state, 'mission-a', { passed: false, score: { composite: 0.2 }, xpAward: 20 }, new Date('2026-08-14T00:00:00Z'));
    assert.equal(state.missions['mission-a'].bestScore.composite, 0.4);
  });

  test('does not mutate the original state object', () => {
    const state = defaultState();
    const snapshot = JSON.stringify(state);
    recordMissionResult(state, 'mission-a', { passed: true, score: { composite: 1 }, xpAward: 100 }, new Date());
    assert.equal(JSON.stringify(state), snapshot);
  });
});
