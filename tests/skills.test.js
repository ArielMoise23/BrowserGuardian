import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { updateRating, applySkillUpdate, weakestCategories, strongestCategories } from '../src/state/skills.js';

describe('updateRating (EWMA)', () => {
  test('moves toward the observed score, not all the way to it', () => {
    const next = updateRating(50, 100);
    assert.ok(next > 50 && next < 100, `expected 50 < ${next} < 100`);
  });

  test('stays put when the observation equals the current rating', () => {
    assert.equal(updateRating(70, 70), 70);
  });

  test('clamps observed scores to [0, 100]', () => {
    assert.equal(updateRating(50, 200), updateRating(50, 100));
    assert.equal(updateRating(50, -50), updateRating(50, 0));
  });
});

describe('applySkillUpdate', () => {
  test('only updates the tagged categories', () => {
    const skills = { fundamentals: 50, dom: 50 };
    const next = applySkillUpdate(skills, ['fundamentals'], 1);
    assert.notEqual(next.fundamentals, 50);
    assert.equal(next.dom, 50);
  });

  test('ignores unknown skill tags rather than adding them', () => {
    const skills = { fundamentals: 50 };
    const next = applySkillUpdate(skills, ['not-a-real-category'], 1);
    assert.deepEqual(next, { fundamentals: 50 });
  });

  test('does not mutate the input skills object', () => {
    const skills = { fundamentals: 50 };
    applySkillUpdate(skills, ['fundamentals'], 1);
    assert.equal(skills.fundamentals, 50);
  });
});

describe('weakest/strongest categories', () => {
  const skills = { a: 10, b: 90, c: 50, d: 30 };

  test('weakestCategories sorts ascending', () => {
    assert.deepEqual(weakestCategories(skills, 2), ['a', 'd']);
  });

  test('strongestCategories sorts descending', () => {
    assert.deepEqual(strongestCategories(skills, 2), ['b', 'c']);
  });
});
