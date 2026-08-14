import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkNewAchievements, ACHIEVEMENTS } from '../src/state/achievements.js';
import { defaultState } from '../src/state/persistence.js';
import { registry } from '../src/game/missionRegistry.js';

describe('checkNewAchievements', () => {
  test('a fresh state unlocks nothing', () => {
    assert.deepEqual(checkNewAchievements(defaultState(), registry), []);
  });

  test('completing one mission unlocks "first-blood" but not "full-clear"', () => {
    const state = { ...defaultState(), missions: { 'closure-incident': { completed: true, bestScore: { composite: 1 } } } };
    const unlocked = checkNewAchievements(state, registry);
    assert.ok(unlocked.includes('first-blood'));
    assert.ok(!unlocked.includes('full-clear'));
  });

  test('already-recorded achievements are not returned again', () => {
    const state = {
      ...defaultState(),
      achievements: ['first-blood'],
      missions: { 'closure-incident': { completed: true, bestScore: { composite: 1 } } },
    };
    const unlocked = checkNewAchievements(state, registry);
    assert.ok(!unlocked.includes('first-blood'));
  });

  test('completing every mission unlocks "full-clear"', () => {
    const missions = Object.fromEntries(registry.allMissions().map((m) => [m.id, { completed: true, bestScore: { composite: 1 } }]));
    const state = { ...defaultState(), missions };
    assert.ok(checkNewAchievements(state, registry).includes('full-clear'));
  });

  test('every achievement id is unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
