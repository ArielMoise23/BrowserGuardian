import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canRevealMore, revealNext } from '../src/game/hints.js';

describe('progressive hints', () => {
  test('can reveal more while under the total', () => {
    assert.equal(canRevealMore(0, 3), true);
    assert.equal(canRevealMore(2, 3), true);
    assert.equal(canRevealMore(3, 3), false);
  });

  test('revealNext increments up to the total and then stops', () => {
    assert.equal(revealNext(0, 3), 1);
    assert.equal(revealNext(1, 3), 2);
    assert.equal(revealNext(2, 3), 3);
    assert.equal(revealNext(3, 3), 3, 'does not exceed the total number of hints');
  });
});
