/** Pure state machine for progressive hint reveal: never reveals more than exists. */
export function canRevealMore(revealedCount, totalHints) {
  return revealedCount < totalHints;
}

export function revealNext(revealedCount, totalHints) {
  return canRevealMore(revealedCount, totalHints) ? revealedCount + 1 : revealedCount;
}
