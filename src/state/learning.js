// Pure functions over plain state objects for Guided Learning progress — same
// design as progress.js: no DOM, no localStorage, trivially unit-testable.

function lessonEntry(state, lessonId) {
  return state.lessons[lessonId] ?? { completedLabs: [], labAttempts: {}, knowledgeCheck: {}, exampleRun: false, completed: false, lastVisitedAt: null };
}

export function touchLesson(state, lessonId, now = new Date()) {
  const entry = lessonEntry(state, lessonId);
  return { ...state, lessons: { ...state.lessons, [lessonId]: { ...entry, lastVisitedAt: now.toISOString() } } };
}

export function recordExampleRun(state, lessonId) {
  const entry = lessonEntry(state, lessonId);
  return { ...state, lessons: { ...state.lessons, [lessonId]: { ...entry, exampleRun: true } } };
}

/**
 * Records a lab attempt. `result` = { passed, score: { composite }, feedback }.
 * Returns { state, isFirstPass } — isFirstPass tells the caller whether this attempt
 * just resolved a prior mistake (used to mark matching review records resolved).
 */
export function recordLabResult(state, lessonId, labId, result, now = new Date()) {
  const entry = lessonEntry(state, lessonId);
  const priorAttempts = entry.labAttempts[labId] ?? { attempts: 0, bestComposite: 0, passed: false };
  const wasAlreadyPassed = priorAttempts.passed;
  const isFirstPass = !wasAlreadyPassed && result.passed;

  const nextAttempts = {
    attempts: priorAttempts.attempts + 1,
    bestComposite: Math.max(priorAttempts.bestComposite, result.score.composite),
    passed: wasAlreadyPassed || result.passed,
    lastAttemptAt: now.toISOString(),
  };
  const completedLabs = result.passed && !entry.completedLabs.includes(labId)
    ? [...entry.completedLabs, labId]
    : entry.completedLabs;

  const nextEntry = {
    ...entry,
    labAttempts: { ...entry.labAttempts, [labId]: nextAttempts },
    completedLabs,
  };

  return {
    state: { ...state, lessons: { ...state.lessons, [lessonId]: nextEntry } },
    isFirstPass,
    attemptNumber: nextAttempts.attempts,
  };
}

export function recordKnowledgeCheck(state, lessonId, questionId, selfScore0to100, now = new Date()) {
  const entry = lessonEntry(state, lessonId);
  const nextEntry = {
    ...entry,
    knowledgeCheck: { ...entry.knowledgeCheck, [questionId]: { selfScore: selfScore0to100, date: now.toISOString() } },
  };
  return { ...state, lessons: { ...state.lessons, [lessonId]: nextEntry } };
}

/** A lesson is "complete" once every lab has passed and every knowledge-check question has been answered. */
export function computeLessonCompletion(lesson, state) {
  const entry = lessonEntry(state, lesson.id);
  const allLabsPassed = lesson.labs.every((lab) => entry.completedLabs.includes(lab.id));
  const allChecksAnswered = lesson.knowledgeCheck.every((q) => entry.knowledgeCheck[q.id] !== undefined);
  return allLabsPassed && allChecksAnswered;
}

export function markLessonComplete(state, lessonId) {
  const entry = lessonEntry(state, lessonId);
  if (entry.completed) return state;
  return { ...state, lessons: { ...state.lessons, [lessonId]: { ...entry, completed: true } } };
}

export function resetLessonProgress(state, lessonId) {
  const next = { ...state.lessons };
  delete next[lessonId];
  return { ...state, lessons: next };
}

/** { totalLessons, completedLessons, fraction } for a list of lessons belonging to one module. */
export function moduleProgress(moduleLessons, state) {
  const totalLessons = moduleLessons.length;
  const completedLessons = moduleLessons.filter((l) => lessonEntry(state, l.id).completed).length;
  return { totalLessons, completedLessons, fraction: totalLessons ? completedLessons / totalLessons : 0 };
}

export function getLessonEntry(state, lessonId) {
  return lessonEntry(state, lessonId);
}
