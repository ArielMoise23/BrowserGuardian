import { RUNNERS, SUBMISSION_MODES } from './missionSchema.js';

/**
 * Type contract for lesson content. There is no TypeScript build step in this codebase,
 * so these JSDoc typedefs are the closest equivalent: they give editor autocomplete/hover
 * on every lesson file (see the `@type {LessonContent}` annotation above each lesson's
 * `export default`), while validateLesson()/validateLab() below enforce the same contract
 * at runtime, failing loudly at registry build time if a lesson doesn't match.
 *
 * @typedef {Object} MentalModelDistinction
 * @property {'ECMAScript spec'|'Browser-provided'|'Simplified model'|'Implementation detail'} label
 * @property {string} text
 *
 * @typedef {Object} MentalModel
 * @property {string} coreIdea - Short, intuitive lead-in shown before the technical mechanism.
 * @property {string} explanation - The precise technical mechanism.
 * @property {string} snippet - Minimal illustrative code shown inline with the explanation.
 * @property {MentalModelDistinction[]} distinctions - At least 2, using only the four labels above.
 *
 * @typedef {Object} WhyItMatters
 * @property {string} development
 * @property {string} security
 * @property {string} sourceDefense
 *
 * @typedef {Object} LessonExample
 * @property {'worker'|'iframe'|'none'} runner
 * @property {string} code
 * @property {string} predictPrompt
 * @property {string} [siteSnapshot] - Required when runner is 'iframe'.
 * @property {string} [setupScript]
 * @property {string} [testScript]
 *
 * @typedef {Object} KnowledgeCheckItem
 * @property {string} id
 * @property {string} question
 * @property {string} modelAnswer
 * @property {string} skillTag - Must be a real entry in SKILL_CATEGORIES (state/persistence.js).
 *
 * @typedef {Object} AnswerSchemaField
 * @property {string} id
 * @property {string} prompt
 * @property {'boolean'|'select'|'multiselect'|'text'} type
 * @property {string[]} [options] - Required for 'select'/'multiselect'.
 *
 * @typedef {Object} LabValidationResult
 * @property {boolean} passed
 * @property {Object<string, number>} score - correctness/security/compatibility/performance -> 0..1.
 * @property {string[]} [feedback]
 *
 * A Lab is deliberately mission-shaped — same runner/submissionMode/validate contract as
 * a Mission (missionSchema.js) — so it reuses the exact same sandbox and scoring engine.
 * @typedef {Object} Lab
 * @property {string} id
 * @property {string} title
 * @property {'predict'|'modify'|'implement'|'break'|'defend'} type
 * @property {string} instructions
 * @property {'worker'|'iframe'|'none'} runner
 * @property {'code'|'answer'} submissionMode
 * @property {string} initialCode - Use '' for answer-mode labs.
 * @property {string} [sourceCode] - Read-only reference code shown alongside the editor.
 * @property {string} [siteSnapshot] - Required when runner is 'iframe'.
 * @property {string} [setupScript]
 * @property {string} [testScript]
 * @property {AnswerSchemaField[]} [answerSchema] - Required when submissionMode is 'answer'.
 * @property {(runResultOrAnswers: any, extra?: any) => LabValidationResult} validate
 * @property {string[]} hints - At least 2, ordered from vaguest to most specific.
 * @property {string} solution
 * @property {string} explanation
 *
 * The full content + behavior contract for one Guided Learning lesson.
 * @typedef {Object} LessonContent
 * @property {string} id - Stable, unique across every lesson.
 * @property {string} moduleId - Must reference a real id in MODULES (game/modules.js).
 * @property {string} title
 * @property {number} estimatedMinutes
 * @property {string} difficulty
 * @property {string[]} prerequisites - Lesson ids, informational only — never gates access.
 * @property {string[]} relatedMissionIds - Mission ids this lesson prepares a learner for.
 * @property {string[]} skillTags - Must be real entries in SKILL_CATEGORIES (state/persistence.js).
 * @property {WhyItMatters} whyItMatters
 * @property {MentalModel} mentalModel
 * @property {string} nuance - An important edge case, misconception, or interview-relevant detail.
 * @property {string} securityAngle - A concrete security scenario tied to this concept.
 * @property {string} runtimeSecurityAngle - How this concept applies to observing/restricting/instrumenting scripts at runtime.
 * @property {string[]} keyTakeaways - 3-5 precise, standalone points.
 * @property {LessonExample} example
 * @property {string[]} [panels] - Which of trace/dom/network/alerts/eventPath the example/labs show.
 * @property {Lab[]} labs - At least 3.
 * @property {KnowledgeCheckItem[]} knowledgeCheck - 2-4 items.
 * @property {string[]} interviewQuestions - Exactly 3.
 */

export const LAB_TYPES = ['predict', 'modify', 'implement', 'break', 'defend'];

// Display labels for LAB_TYPES — the single source of truth so a lab's type badge
// renders the same wherever it appears (inside a lesson, or in the Review screen's
// mistake history), instead of leaking the raw internal string to the learner.
export const LAB_TYPE_LABELS = {
  predict: 'Predict', modify: 'Modify', implement: 'Implement', break: 'Break it', defend: 'Defend it',
};

export function labTypeLabel(type) {
  return LAB_TYPE_LABELS[type] ?? type;
}

export const MENTAL_MODEL_LABELS = [
  'ECMAScript spec',
  'Browser-provided',
  'Simplified model',
  'Implementation detail',
];

/**
 * A Lab is deliberately mission-shaped: same runner/submissionMode/validate contract
 * as missionSchema.js, so it reuses the exact same sandbox + scoring engine. Throws
 * with a precise message naming the lesson+lab id so bad content fails loudly at
 * registry build time.
 */
export function validateLab(lab, lessonLabel) {
  const errors = [];
  const label = `${lessonLabel} / lab "${lab?.id ?? '(missing id)'}"`;

  for (const field of ['id', 'title', 'instructions', 'solution', 'explanation']) {
    if (typeof lab?.[field] !== 'string' || lab[field].trim() === '') {
      errors.push(`${label} is missing required string field "${field}"`);
    }
  }
  if (!LAB_TYPES.includes(lab?.type)) errors.push(`${label} has invalid type "${lab?.type}"`);
  if (!RUNNERS.includes(lab?.runner)) errors.push(`${label} has invalid runner "${lab?.runner}"`);
  if (!SUBMISSION_MODES.includes(lab?.submissionMode)) errors.push(`${label} has invalid submissionMode "${lab?.submissionMode}"`);
  if (lab?.submissionMode === 'answer' && !Array.isArray(lab?.answerSchema)) {
    errors.push(`${label} uses submissionMode "answer" but has no "answerSchema"`);
  }
  if (typeof lab?.initialCode !== 'string') errors.push(`${label} is missing "initialCode" (use "" for answer-mode labs)`);
  if (!Array.isArray(lab?.hints) || lab.hints.length < 2) errors.push(`${label} needs at least 2 progressive hints`);
  if (typeof lab?.validate !== 'function') errors.push(`${label} is missing a validate() function`);
  if (lab?.runner === 'iframe' && typeof lab?.siteSnapshot !== 'string') {
    errors.push(`${label} uses the iframe runner but has no "siteSnapshot" HTML`);
  }
  return errors;
}

export function validateLesson(lesson) {
  const errors = [];
  const label = lesson?.id ?? '(missing id)';

  for (const field of ['id', 'moduleId', 'title', 'difficulty']) {
    if (typeof lesson?.[field] !== 'string' || lesson[field].trim() === '') {
      errors.push(`lesson "${label}" is missing required string field "${field}"`);
    }
  }
  if (typeof lesson?.estimatedMinutes !== 'number' || lesson.estimatedMinutes <= 0) {
    errors.push(`lesson "${label}" is missing a positive numeric "estimatedMinutes"`);
  }
  if (!Array.isArray(lesson?.prerequisites)) errors.push(`lesson "${label}" is missing "prerequisites" (use [] if none)`);
  if (!Array.isArray(lesson?.relatedMissionIds)) errors.push(`lesson "${label}" is missing "relatedMissionIds" (use [] if none)`);
  if (!Array.isArray(lesson?.skillTags) || lesson.skillTags.length < 1) errors.push(`lesson "${label}" needs at least 1 skillTags entry`);

  const wim = lesson?.whyItMatters;
  if (!wim || !wim.development || !wim.security || !wim.sourceDefense) {
    errors.push(`lesson "${label}" needs whyItMatters.{development,security,sourceDefense}`);
  }

  const mm = lesson?.mentalModel;
  if (!mm || typeof mm.coreIdea !== 'string' || mm.coreIdea.trim() === '') {
    errors.push(`lesson "${label}" needs mentalModel.coreIdea (a short, intuitive lead-in before the technical mechanism)`);
  }
  if (!mm || typeof mm.explanation !== 'string' || mm.explanation.trim() === '') {
    errors.push(`lesson "${label}" needs mentalModel.explanation`);
  }
  if (!mm || typeof mm.snippet !== 'string' || mm.snippet.trim() === '') {
    errors.push(`lesson "${label}" needs mentalModel.snippet (a minimal illustrative code example, shown inline with the explanation)`);
  }
  if (!mm || !Array.isArray(mm.distinctions) || mm.distinctions.length < 2) {
    errors.push(`lesson "${label}" needs at least 2 mentalModel.distinctions`);
  } else {
    mm.distinctions.forEach((d, i) => {
      if (!MENTAL_MODEL_LABELS.includes(d.label)) {
        errors.push(`lesson "${label}" distinctions[${i}] has invalid label "${d.label}"`);
      }
      if (!d.text || d.text.trim() === '') {
        errors.push(`lesson "${label}" distinctions[${i}] is missing text`);
      }
    });
  }

  if (typeof lesson?.nuance !== 'string' || lesson.nuance.trim() === '') {
    errors.push(`lesson "${label}" needs "nuance" (an important edge case, misconception, or interview-relevant detail)`);
  }
  if (typeof lesson?.securityAngle !== 'string' || lesson.securityAngle.trim() === '') {
    errors.push(`lesson "${label}" needs "securityAngle" (a concrete security scenario tied to this concept)`);
  }
  if (typeof lesson?.runtimeSecurityAngle !== 'string' || lesson.runtimeSecurityAngle.trim() === '') {
    errors.push(`lesson "${label}" needs "runtimeSecurityAngle" (how this concept applies to observing/restricting/instrumenting scripts at runtime)`);
  }
  if (!Array.isArray(lesson?.keyTakeaways) || lesson.keyTakeaways.length < 3 || lesson.keyTakeaways.length > 5) {
    errors.push(`lesson "${label}" needs 3-5 keyTakeaways`);
  }

  const ex = lesson?.example;
  if (!ex || typeof ex.code !== 'string' || ex.code.trim() === '') {
    errors.push(`lesson "${label}" needs example.code`);
  }
  if (!ex || !RUNNERS.includes(ex.runner)) {
    errors.push(`lesson "${label}" example has invalid runner "${ex?.runner}"`);
  }
  if (!ex || typeof ex.predictPrompt !== 'string' || ex.predictPrompt.trim() === '') {
    errors.push(`lesson "${label}" needs example.predictPrompt`);
  }
  if (ex?.runner === 'iframe' && typeof ex?.siteSnapshot !== 'string') {
    errors.push(`lesson "${label}" example uses the iframe runner but has no siteSnapshot`);
  }

  if (!Array.isArray(lesson?.labs) || lesson.labs.length < 3) {
    errors.push(`lesson "${label}" needs at least 3 labs`);
  } else {
    for (const lab of lesson.labs) errors.push(...validateLab(lab, `lesson "${label}"`));
  }

  if (!Array.isArray(lesson?.knowledgeCheck) || lesson.knowledgeCheck.length < 2 || lesson.knowledgeCheck.length > 4) {
    errors.push(`lesson "${label}" needs 2-4 knowledgeCheck questions`);
  } else {
    lesson.knowledgeCheck.forEach((q, i) => {
      if (!q.id || !q.question || !q.modelAnswer || !q.skillTag) {
        errors.push(`lesson "${label}" knowledgeCheck[${i}] is missing id/question/modelAnswer/skillTag`);
      }
    });
  }

  if (!Array.isArray(lesson?.interviewQuestions) || lesson.interviewQuestions.length !== 3) {
    errors.push(`lesson "${label}" needs exactly 3 interviewQuestions`);
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}
