import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVIEW_QUESTIONS, pickQuestions, categoryLabel } from '../src/game/interviewBank.js';
import { defaultState } from '../src/state/persistence.js';
import { SKILL_CATEGORIES } from '../src/state/persistence.js';

describe('interview question bank', () => {
  test('has a substantial bank of questions (30+)', () => {
    assert.ok(INTERVIEW_QUESTIONS.length >= 30, `only ${INTERVIEW_QUESTIONS.length} questions`);
  });

  test('every question has a real prompt, model answer, and valid skill tag', () => {
    for (const q of INTERVIEW_QUESTIONS) {
      assert.ok(q.id);
      assert.ok(q.prompt.length > 20);
      assert.ok(q.modelAnswer.length > 20);
      assert.ok(SKILL_CATEGORIES.includes(q.skillTag), `unknown skillTag "${q.skillTag}" on ${q.id}`);
    }
  });

  test('question ids are unique', () => {
    const ids = INTERVIEW_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('pickQuestions', () => {
  test('returns the requested count with no duplicates', () => {
    const picked = pickQuestions(defaultState().skills, 6);
    assert.equal(picked.length, 6);
    assert.equal(new Set(picked.map((q) => q.id)).size, 6);
  });

  test('never returns more than exist in the bank', () => {
    const picked = pickQuestions(defaultState().skills, 999);
    assert.ok(picked.length <= INTERVIEW_QUESTIONS.length);
  });
});

describe('categoryLabel', () => {
  test('has a human-readable label for every skill category', () => {
    for (const tag of SKILL_CATEGORIES) {
      const label = categoryLabel(tag);
      assert.notEqual(label, tag, `category "${tag}" is missing a friendly label`);
    }
  });
});
