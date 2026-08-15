import { validateLesson } from './lessonSchema.js';

import varLetConstClosures from '../lessons/module1/var-let-const-closures.js';
import executionContextsScopeChains from '../lessons/module1/execution-contexts-scope-chains.js';
import callStackEventLoop from '../lessons/module3/call-stack-event-loop.js';
import eventCaptureBubbleDelegation from '../lessons/module4/event-capture-bubble-delegation.js';
import originsSopCors from '../lessons/module5/origins-sop-cors.js';
import thirdPartyJsExecution from '../lessons/module6/third-party-js-execution.js';
import formjackingExfiltration from '../lessons/module7/formjacking-exfiltration.js';
import wrappingFetchSafely from '../lessons/module8/wrapping-fetch-safely.js';
import instrumentationEvasion from '../lessons/module8/instrumentation-evasion.js';
import instrumentationPerformance from '../lessons/module9/instrumentation-performance.js';

// One import per lesson file, added here as each is authored — mirrors
// missionRegistry.js exactly.
const LESSONS = [
  varLetConstClosures,
  executionContextsScopeChains,
  callStackEventLoop,
  eventCaptureBubbleDelegation,
  originsSopCors,
  thirdPartyJsExecution,
  formjackingExfiltration,
  wrappingFetchSafely,
  instrumentationEvasion,
  instrumentationPerformance,
];

for (const lesson of LESSONS) validateLesson(lesson);

const byId = new Map(LESSONS.map((l) => [l.id, l]));

const missionIndex = new Map();
for (const lesson of LESSONS) {
  for (const missionId of lesson.relatedMissionIds) {
    if (!missionIndex.has(missionId)) missionIndex.set(missionId, []);
    missionIndex.get(missionId).push(lesson);
  }
}

export function createLessonRegistry() {
  return {
    allLessons: () => LESSONS,
    lessonsByModule: (moduleId) => LESSONS.filter((l) => l.moduleId === moduleId),
    getLesson: (id) => byId.get(id),
    modulesWithLessons: () => [...new Set(LESSONS.map((l) => l.moduleId))],
    /** Lessons that recommend prep for the given mission, most relevant first. */
    missionToLessons: (missionId) => missionIndex.get(missionId) ?? [],
  };
}

export const lessonRegistry = createLessonRegistry();
