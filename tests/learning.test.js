import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  touchLesson, recordExampleRun, recordLabResult, recordKnowledgeCheck,
  computeLessonCompletion, markLessonComplete, resetLessonProgress, moduleProgress, getLessonEntry,
} from '../src/state/learning.js';
import { defaultState } from '../src/state/persistence.js';

const fakeLesson = {
  id: 'lesson-a',
  labs: [{ id: 'lab-1' }, { id: 'lab-2' }],
  knowledgeCheck: [{ id: 'q1' }, { id: 'q2' }],
};

describe('touchLesson / recordExampleRun', () => {
  test('touchLesson stamps lastVisitedAt without touching other fields', () => {
    const state = defaultState();
    const next = touchLesson(state, 'lesson-a', new Date('2026-08-14T00:00:00Z'));
    assert.equal(next.lessons['lesson-a'].lastVisitedAt, '2026-08-14T00:00:00.000Z');
    assert.equal(next.lessons['lesson-a'].completed, false);
  });

  test('recordExampleRun sets exampleRun true', () => {
    const state = defaultState();
    const next = recordExampleRun(state, 'lesson-a');
    assert.equal(next.lessons['lesson-a'].exampleRun, true);
  });
});

describe('recordLabResult', () => {
  test('a passing attempt adds the lab to completedLabs', () => {
    const state = defaultState();
    const { state: next, isFirstPass } = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } });
    assert.ok(next.lessons['lesson-a'].completedLabs.includes('lab-1'));
    assert.equal(isFirstPass, true);
  });

  test('a failing attempt does not add the lab to completedLabs, but records the attempt', () => {
    const state = defaultState();
    const { state: next, isFirstPass } = recordLabResult(state, 'lesson-a', 'lab-1', { passed: false, score: { composite: 0.3 } });
    assert.ok(!next.lessons['lesson-a'].completedLabs.includes('lab-1'));
    assert.equal(next.lessons['lesson-a'].labAttempts['lab-1'].attempts, 1);
    assert.equal(isFirstPass, false);
  });

  test('isFirstPass is false on a second passing attempt', () => {
    let state = defaultState();
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } }).state;
    const { isFirstPass, attemptNumber } = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } });
    assert.equal(isFirstPass, false);
    assert.equal(attemptNumber, 2);
  });

  test('bestComposite keeps the highest score seen', () => {
    let state = defaultState();
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: false, score: { composite: 0.4 } }).state;
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: false, score: { composite: 0.2 } }).state;
    assert.equal(state.lessons['lesson-a'].labAttempts['lab-1'].bestComposite, 0.4);
  });

  test('does not mutate the input state', () => {
    const state = defaultState();
    const snapshot = JSON.stringify(state);
    recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } });
    assert.equal(JSON.stringify(state), snapshot);
  });
});

describe('recordKnowledgeCheck', () => {
  test('records a self-score with a timestamp', () => {
    const state = defaultState();
    const next = recordKnowledgeCheck(state, 'lesson-a', 'q1', 90, new Date('2026-08-14T00:00:00Z'));
    assert.equal(next.lessons['lesson-a'].knowledgeCheck.q1.selfScore, 90);
    assert.equal(next.lessons['lesson-a'].knowledgeCheck.q1.date, '2026-08-14T00:00:00.000Z');
  });
});

describe('computeLessonCompletion', () => {
  test('false when no labs or knowledge checks are done', () => {
    assert.equal(computeLessonCompletion(fakeLesson, defaultState()), false);
  });

  test('false when labs are done but knowledge checks are not', () => {
    let state = defaultState();
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } }).state;
    state = recordLabResult(state, 'lesson-a', 'lab-2', { passed: true, score: { composite: 1 } }).state;
    assert.equal(computeLessonCompletion(fakeLesson, state), false);
  });

  test('true once every lab passed and every knowledge check answered', () => {
    let state = defaultState();
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } }).state;
    state = recordLabResult(state, 'lesson-a', 'lab-2', { passed: true, score: { composite: 1 } }).state;
    state = recordKnowledgeCheck(state, 'lesson-a', 'q1', 90);
    state = recordKnowledgeCheck(state, 'lesson-a', 'q2', 80);
    assert.equal(computeLessonCompletion(fakeLesson, state), true);
  });
});

describe('markLessonComplete / resetLessonProgress', () => {
  test('markLessonComplete sets completed true, idempotently', () => {
    const state = defaultState();
    const next = markLessonComplete(state, 'lesson-a');
    assert.equal(next.lessons['lesson-a'].completed, true);
    const again = markLessonComplete(next, 'lesson-a');
    assert.equal(again, next, 'returns the same reference when already complete (no-op)');
  });

  test('resetLessonProgress removes only that lesson, leaving others untouched', () => {
    let state = defaultState();
    state = recordLabResult(state, 'lesson-a', 'lab-1', { passed: true, score: { composite: 1 } }).state;
    state = recordLabResult(state, 'lesson-b', 'lab-1', { passed: true, score: { composite: 1 } }).state;
    const next = resetLessonProgress(state, 'lesson-a');
    assert.equal(next.lessons['lesson-a'], undefined);
    assert.ok(next.lessons['lesson-b']);
  });
});

describe('moduleProgress', () => {
  test('computes fraction complete across a set of lessons', () => {
    let state = defaultState();
    state = markLessonComplete(state, 'lesson-a');
    const lessons = [{ id: 'lesson-a' }, { id: 'lesson-b' }];
    const progress = moduleProgress(lessons, state);
    assert.equal(progress.totalLessons, 2);
    assert.equal(progress.completedLessons, 1);
    assert.equal(progress.fraction, 0.5);
  });

  test('handles an empty lesson list without dividing by zero', () => {
    assert.deepEqual(moduleProgress([], defaultState()), { totalLessons: 0, completedLessons: 0, fraction: 0 });
  });
});

describe('getLessonEntry', () => {
  test('returns sensible defaults for a lesson never touched', () => {
    const entry = getLessonEntry(defaultState(), 'never-visited');
    assert.deepEqual(entry.completedLabs, []);
    assert.equal(entry.completed, false);
  });
});
