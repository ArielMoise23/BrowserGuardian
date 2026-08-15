const SAVE_KEY = 'bg_rdl_save_v1';
const SCHEMA_VERSION = 1;

export const SKILL_CATEGORIES = [
  'fundamentals',
  'runtime',
  'asyncEventLoop',
  'dom',
  'events',
  'browserArchitecture',
  'browserApis',
  'network',
  'webSecurity',
  'clientSideAttacks',
  'runtimeInstrumentation',
  'threatModeling',
  'debugging',
  'performance',
  'productionReliability',
];

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    xp: 0,
    missions: {},
    activityDates: [],
    achievements: [],
    skills: Object.fromEntries(SKILL_CATEGORIES.map((c) => [c, 50])),
    interview: { history: [], sessions: [] },
    settings: { reducedMotion: 'system' },
    // Guided Learning Mode state — additive only. Old saves are missing these keys
    // entirely; loadState()'s existing defaultState-merge backfills them below, so no
    // SCHEMA_VERSION bump (and no risk of wiping existing mission/XP progress) is needed.
    lessons: {}, // { [lessonId]: { completedLabs: [], labAttempts: {}, knowledgeCheck: {}, exampleRun: false, completed: false, lastVisitedAt: null } }
    bookmarks: [], // lessonId[]
    notes: {}, // { [lessonId]: string }
    mistakes: [], // { id, lessonId, labId, mistakeType, date, failedAttempts, resolved, resolvedDate }
  };
}

// Migration stub: bump SCHEMA_VERSION and add a case here when the shape changes.
function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  if (raw.version === SCHEMA_VERSION) return raw;
  // No prior versions exist yet; fall back to a fresh state if something unexpected shows up.
  return defaultState();
}

export function loadState(storage = safeStorage()) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    // Merge with defaults so newly-added fields in code are present even in old saves.
    return { ...defaultState(), ...migrated, skills: { ...defaultState().skills, ...migrated.skills } };
  } catch {
    return defaultState();
  }
}

export function saveState(state, storage = safeStorage()) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage = safeStorage()) {
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

function safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* localStorage can throw in restricted contexts (e.g. private mode) */
  }
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
}

export { SAVE_KEY, SCHEMA_VERSION };
