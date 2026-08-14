// Pure functions over plain state objects — no DOM, no localStorage — so they're
// trivially unit-testable and reusable from both the store and the tests.

/** Cumulative XP required to *reach* a given level (triangular growth curve). */
export function xpForLevel(level) {
  return 100 * ((level - 1) * level) / 2;
}

export function computeLevel(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function xpProgress(xp) {
  const level = computeLevel(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: ceil - floor,
    fraction: ceil > floor ? (xp - floor) / (ceil - floor) : 1,
  };
}

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Consecutive-day streak ending today-or-yesterday, plus the best streak ever seen. */
export function computeStreaks(activityDates, today = todayIso()) {
  const days = [...new Set(activityDates)].sort();
  if (days.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    if (dayDiff(days[i - 1], days[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }

  const last = days[days.length - 1];
  const diffFromToday = dayDiff(last, today);
  let current = 0;
  if (diffFromToday <= 1) {
    // Streak is still "alive" if the most recent activity was today or yesterday.
    current = run;
    if (diffFromToday === 1 && last !== today) {
      // Yesterday was the last active day; today hasn't happened yet but streak isn't broken.
    }
  }
  return { current, best };
}

function dayDiff(isoA, isoB) {
  const a = Date.UTC(...isoA.split('-').map(Number));
  const b = Date.UTC(...isoB.split('-').map(Number));
  return Math.round((b - a) / 86400000);
}

/**
 * Records a mission attempt/completion into state, returning a new state object.
 * `result` = { passed, score: {correctness, security, compatibility, performance, composite}, xpAward }
 */
export function recordMissionResult(state, missionId, result, now = new Date()) {
  const prior = state.missions[missionId] ?? { completed: false, attempts: 0, bestScore: null };
  const attempts = prior.attempts + 1;
  const bestScore = !prior.bestScore || result.score.composite > prior.bestScore.composite
    ? result.score
    : prior.bestScore;

  const wasAlreadyComplete = prior.completed;
  const nowComplete = prior.completed || result.passed;
  const xpGain = !wasAlreadyComplete && result.passed ? result.xpAward : 0;

  const today = todayIso(now);
  const activityDates = state.activityDates.includes(today)
    ? state.activityDates
    : [...state.activityDates, today];

  return {
    ...state,
    xp: state.xp + xpGain,
    activityDates,
    missions: {
      ...state.missions,
      [missionId]: {
        completed: nowComplete,
        attempts,
        bestScore,
        lastCompletedAt: result.passed ? now.toISOString() : (prior.lastCompletedAt ?? null),
      },
    },
  };
}
