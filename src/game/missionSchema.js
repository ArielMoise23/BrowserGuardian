export const MISSION_TYPES = [
  'predict-output',
  'code-repair',
  'attack-investigation',
  'runtime-defense',
  'debugging',
  'performance',
  'threat-modeling',
  'architecture-decision',
  'boss-battle',
];

// Display labels for MISSION_TYPES — the single source of truth for how a mission's
// type renders as a badge, so the map and the mission page can never drift apart.
export const MISSION_TYPE_LABELS = {
  'predict-output': 'Predict Output',
  'code-repair': 'Code Repair',
  'attack-investigation': 'Attack Investigation',
  'runtime-defense': 'Runtime Defense',
  debugging: 'Debugging',
  performance: 'Performance',
  'threat-modeling': 'Threat Modeling',
  'architecture-decision': 'Architecture Decision',
  'boss-battle': 'Boss Battle',
};

export function missionTypeLabel(type) {
  return MISSION_TYPE_LABELS[type] ?? type;
}

export const RUNNERS = ['worker', 'iframe', 'none'];

/**
 * 'code'   — the editable panel is a code editor; submitted code is executed by the
 *            mission's runner and validate(runResult, code) grades the execution trace.
 * 'answer' — the editable panel is a structured Q&A form (used by investigation /
 *            threat-modeling missions); validate(answers) grades the form answers
 *            directly. The sandbox may still run automatically to populate the live
 *            panels (console/DOM/network) for the learner to investigate.
 */
export const SUBMISSION_MODES = ['code', 'answer'];

const REQUIRED_STRING_FIELDS = [
  'id', 'title', 'type', 'difficulty',
  'objective', 'prerequisites', 'scenario',
  'task', 'expectedBehavior',
  'solution', 'explanation',
  'securityImpact', 'runtimeExplanation',
  'sourceDefenseConnection', 'followUp',
];

/**
 * Validates a mission object against the content-quality checklist every mission
 * must satisfy (objective, hints, explanation, security impact, etc). Throws with a
 * precise message naming the mission id and the missing field, so a bad mission file
 * fails loudly at registry build time instead of rendering a half-empty screen.
 */
export function validateMission(mission) {
  const errors = [];
  const label = mission?.id ?? '(missing id)';

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof mission?.[field] !== 'string' || mission[field].trim() === '') {
      errors.push(`mission "${label}" is missing required string field "${field}"`);
    }
  }

  if (!MISSION_TYPES.includes(mission?.type)) {
    errors.push(`mission "${label}" has invalid type "${mission?.type}"`);
  }
  if (!RUNNERS.includes(mission?.runner)) {
    errors.push(`mission "${label}" has invalid runner "${mission?.runner}"`);
  }
  if (!SUBMISSION_MODES.includes(mission?.submissionMode)) {
    errors.push(`mission "${label}" has invalid submissionMode "${mission?.submissionMode}"`);
  }
  if (mission?.submissionMode === 'answer' && !Array.isArray(mission?.answerSchema)) {
    errors.push(`mission "${label}" uses submissionMode "answer" but has no "answerSchema"`);
  }
  if (typeof mission?.chapter !== 'number') {
    errors.push(`mission "${label}" is missing numeric "chapter"`);
  }
  if (typeof mission?.xp !== 'number' || mission.xp <= 0) {
    errors.push(`mission "${label}" is missing a positive numeric "xp"`);
  }
  if (typeof mission?.estimatedMinutes !== 'number' || mission.estimatedMinutes <= 0) {
    errors.push(`mission "${label}" is missing a positive numeric "estimatedMinutes"`);
  }
  if (typeof mission?.initialCode !== 'string') {
    errors.push(`mission "${label}" is missing "initialCode" (use "" for read-only briefings)`);
  }
  if (!Array.isArray(mission?.hints) || mission.hints.length < 3) {
    errors.push(`mission "${label}" needs at least 3 progressive hints`);
  }
  if (!Array.isArray(mission?.commonWrongAnswers) || mission.commonWrongAnswers.length < 1) {
    errors.push(`mission "${label}" needs at least 1 entry in commonWrongAnswers`);
  }
  if (!Array.isArray(mission?.skillTags) || mission.skillTags.length < 1) {
    errors.push(`mission "${label}" needs at least 1 skillTags entry`);
  }
  if (typeof mission?.validate !== 'function') {
    errors.push(`mission "${label}" is missing a validate() function`);
  }

  if (mission?.runner === 'iframe' && typeof mission?.siteSnapshot !== 'string') {
    errors.push(`mission "${label}" uses the iframe runner but has no "siteSnapshot" HTML`);
  }

  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
  return true;
}
