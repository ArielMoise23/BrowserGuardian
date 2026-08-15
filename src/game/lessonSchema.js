import { RUNNERS, SUBMISSION_MODES } from './missionSchema.js';

export const LAB_TYPES = ['predict', 'modify', 'implement', 'break', 'defend'];

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
  if (!mm || typeof mm.explanation !== 'string' || mm.explanation.trim() === '') {
    errors.push(`lesson "${label}" needs mentalModel.explanation`);
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
