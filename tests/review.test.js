import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recordMistake, resolveMistakesFor, weakestConcepts, mistakeHistory } from '../src/state/review.js';
import { defaultState } from '../src/state/persistence.js';

function fakeRegistry(lessons) {
  return { getLesson: (id) => lessons.find((l) => l.id === id) };
}

describe('recordMistake', () => {
  test('creates a new unresolved mistake record', () => {
    const state = defaultState();
    const next = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' }, new Date('2026-08-14T00:00:00Z'));
    assert.equal(next.mistakes.length, 1);
    assert.equal(next.mistakes[0].failedAttempts, 1);
    assert.equal(next.mistakes[0].resolved, false);
  });

  test('a second mistake on the same lesson+lab increments failedAttempts instead of duplicating', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' }, new Date('2026-08-14T00:00:00Z'));
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' }, new Date('2026-08-14T01:00:00Z'));
    assert.equal(state.mistakes.length, 1);
    assert.equal(state.mistakes[0].failedAttempts, 2);
  });

  test('a mistake on a different lab creates a separate record', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab2', mistakeType: 'implement' });
    assert.equal(state.mistakes.length, 2);
  });

  test('does not mutate the input state', () => {
    const state = defaultState();
    const snapshot = JSON.stringify(state);
    recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    assert.equal(JSON.stringify(state), snapshot);
  });
});

describe('resolveMistakesFor', () => {
  test('marks a matching unresolved mistake as resolved', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = resolveMistakesFor(state, 'l1', 'lab1', new Date('2026-08-14T02:00:00Z'));
    assert.equal(state.mistakes[0].resolved, true);
    assert.equal(state.mistakes[0].resolvedDate, '2026-08-14T02:00:00.000Z');
  });

  test('a subsequent mistake on the same lab after resolution creates a NEW record (not reopening the old one)', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = resolveMistakesFor(state, 'l1', 'lab1');
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    assert.equal(state.mistakes.length, 2);
    assert.equal(state.mistakes[0].resolved, true);
    assert.equal(state.mistakes[1].resolved, false);
  });

  test('resolving a lab with no mistakes is a harmless no-op', () => {
    const state = defaultState();
    assert.deepEqual(resolveMistakesFor(state, 'l1', 'lab1').mistakes, []);
  });
});

describe('weakestConcepts', () => {
  const lessons = [{ id: 'l1', title: 'Lesson One', labs: [{ id: 'lab1', title: 'Lab One' }, { id: 'lab2', title: 'Lab Two' }] }];
  const registry = fakeRegistry(lessons);

  test('ranks by failedAttempts descending', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab2', mistakeType: 'implement' });
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab2', mistakeType: 'implement' });
    const weak = weakestConcepts(state, registry, 5);
    assert.equal(weak[0].labId, 'lab2');
    assert.equal(weak[0].failedAttempts, 2);
    assert.equal(weak[1].labId, 'lab1');
  });

  test('excludes resolved mistakes', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = resolveMistakesFor(state, 'l1', 'lab1');
    assert.deepEqual(weakestConcepts(state, registry, 5), []);
    });

  test('respects the count limit', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' });
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab2', mistakeType: 'implement' });
    assert.equal(weakestConcepts(state, registry, 1).length, 1);
  });

  test('skips mistakes whose lesson or lab no longer exists in the registry', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'ghost-lesson', labId: 'ghost-lab', mistakeType: 'predict' });
    assert.deepEqual(weakestConcepts(state, registry, 5), []);
  });
});

describe('mistakeHistory', () => {
  const lessons = [{ id: 'l1', title: 'Lesson One', labs: [{ id: 'lab1', title: 'Lab One' }] }];
  const registry = fakeRegistry(lessons);

  test('sorts most recent first and enriches with titles', () => {
    let state = defaultState();
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'predict' }, new Date('2026-08-13T00:00:00Z'));
    // resolve then re-fail to force a second, later record
    state = resolveMistakesFor(state, 'l1', 'lab1', new Date('2026-08-13T01:00:00Z'));
    state = recordMistake(state, { lessonId: 'l1', labId: 'lab1', mistakeType: 'implement' }, new Date('2026-08-14T00:00:00Z'));
    const history = mistakeHistory(state, registry);
    assert.equal(history.length, 2);
    assert.equal(history[0].mistakeType, 'implement', 'most recent first');
    assert.equal(history[0].lessonTitle, 'Lesson One');
    assert.equal(history[0].labTitle, 'Lab One');
  });
});
