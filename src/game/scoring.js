const DIMENSIONS = ['correctness', 'security', 'compatibility', 'performance'];

/**
 * A mission's validate() only returns the dimensions relevant to that mission type
 * (e.g. a pure predict-output mission has no "performance" dimension). The composite
 * is the mean of whichever dimensions are present, so missions aren't penalized for
 * dimensions that don't apply to them.
 */
export function computeComposite(score) {
  const present = DIMENSIONS.filter((d) => typeof score[d] === 'number');
  if (present.length === 0) return 0;
  const sum = present.reduce((acc, d) => acc + score[d], 0);
  return sum / present.length;
}

export function computeXpAward(mission, composite) {
  return Math.round(mission.xp * composite);
}

export function buildResult(mission, score, passed, feedback = []) {
  const composite = computeComposite(score);
  return {
    passed,
    score: { ...score, composite },
    xpAward: computeXpAward(mission, composite),
    feedback,
  };
}
