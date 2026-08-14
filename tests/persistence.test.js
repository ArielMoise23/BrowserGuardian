import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, clearState, defaultState, SAVE_KEY } from '../src/state/persistence.js';

function mockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    _data: data,
  };
}

describe('loadState', () => {
  test('returns defaultState when nothing is saved', () => {
    const storage = mockStorage();
    assert.deepEqual(loadState(storage), defaultState());
  });

  test('returns defaultState when saved data is corrupt JSON', () => {
    const storage = mockStorage({ [SAVE_KEY]: '{not valid json' });
    assert.deepEqual(loadState(storage), defaultState());
  });

  test('round-trips a saved state', () => {
    const storage = mockStorage();
    const state = { ...defaultState(), xp: 250 };
    saveState(state, storage);
    const loaded = loadState(storage);
    assert.equal(loaded.xp, 250);
  });

  test('merges missing fields from defaultState (forward-compatible with older saves)', () => {
    const storage = mockStorage({ [SAVE_KEY]: JSON.stringify({ version: 1, xp: 50 }) });
    const loaded = loadState(storage);
    assert.equal(loaded.xp, 50);
    assert.ok(Array.isArray(loaded.activityDates));
    assert.ok(typeof loaded.skills === 'object');
  });
});

describe('clearState', () => {
  test('removes the save key', () => {
    const storage = mockStorage({ [SAVE_KEY]: JSON.stringify(defaultState()) });
    clearState(storage);
    assert.equal(storage.getItem(SAVE_KEY), null);
  });
});
