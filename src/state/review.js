import { uid } from '../utils/id.js';

// Lightweight spaced-review tracking: what did the learner get wrong, on what, and
// have they since fixed it. Deliberately NOT a streak/engagement mechanic — this
// only ever surfaces "things worth retrying," never a guilt-trip about missed days.

/**
 * Records (or reinforces) a mistake. If an unresolved mistake already exists for the
 * same lesson+lab, its failedAttempts count is incremented instead of creating a
 * duplicate row — so retrying the same lab five times in a row produces one record
 * with failedAttempts: 5, not five records.
 */
export function recordMistake(state, { lessonId, labId, mistakeType }, now = new Date()) {
  const existingIndex = state.mistakes.findIndex((m) => m.lessonId === lessonId && m.labId === labId && !m.resolved);
  if (existingIndex >= 0) {
    const mistakes = [...state.mistakes];
    const existing = mistakes[existingIndex];
    mistakes[existingIndex] = { ...existing, failedAttempts: existing.failedAttempts + 1, date: now.toISOString(), mistakeType };
    return { ...state, mistakes };
  }
  const record = {
    id: uid('mistake'),
    lessonId,
    labId,
    mistakeType,
    date: now.toISOString(),
    failedAttempts: 1,
    resolved: false,
    resolvedDate: null,
  };
  return { ...state, mistakes: [...state.mistakes, record] };
}

export function resolveMistakesFor(state, lessonId, labId, now = new Date()) {
  const mistakes = state.mistakes.map((m) =>
    m.lessonId === lessonId && m.labId === labId && !m.resolved
      ? { ...m, resolved: true, resolvedDate: now.toISOString() }
      : m
  );
  return { ...state, mistakes };
}

/**
 * Returns up to `count` weak concepts (one per lab with unresolved mistakes),
 * ranked by failed-attempt count then recency, enriched with lesson/lab titles via
 * the registry so the Review screen can render and link directly to each.
 */
export function weakestConcepts(state, lessonRegistry, count = 5) {
  const unresolved = state.mistakes.filter((m) => !m.resolved);
  const ranked = [...unresolved].sort((a, b) => {
    if (b.failedAttempts !== a.failedAttempts) return b.failedAttempts - a.failedAttempts;
    return new Date(b.date) - new Date(a.date);
  });

  const results = [];
  for (const mistake of ranked) {
    if (results.length >= count) break;
    const lesson = lessonRegistry.getLesson(mistake.lessonId);
    if (!lesson) continue;
    const lab = lesson.labs.find((l) => l.id === mistake.labId);
    if (!lab) continue;
    results.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      labId: lab.id,
      labTitle: lab.title,
      failedAttempts: mistake.failedAttempts,
      lastAttemptDate: mistake.date,
    });
  }
  return results;
}

export function mistakeHistory(state, lessonRegistry) {
  return [...state.mistakes]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((m) => {
      const lesson = lessonRegistry.getLesson(m.lessonId);
      const lab = lesson?.labs.find((l) => l.id === m.labId);
      return { ...m, lessonTitle: lesson?.title ?? m.lessonId, labTitle: lab?.title ?? m.labId };
    });
}
