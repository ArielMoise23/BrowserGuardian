import { el, mount } from '../utils/dom.js';
import { renderPanel } from './panel.js';
import { createCodeEditor } from './code-editor.js';
import { renderHints } from './hint-panel.js';
import { renderAnswerForm } from './answer-form.js';
import { renderScoreMeter } from './debrief-panel.js';
import { showToast } from './toast.js';
import { createRunController, renderTraceStepper } from './sandbox-run-controller.js';
import { buildResult } from '../game/scoring.js';
import { revealNext } from '../game/hints.js';

const LAB_TYPE_LABELS = {
  predict: 'Predict', modify: 'Modify', implement: 'Implement', break: 'Break it', defend: 'Defend it',
};

/**
 * A compact, embeddable lab card — reuses the exact same sandbox/scoring/hint engine
 * as mission-view.js (via sandbox-run-controller.js) so lab grading is behaviorally
 * validated, never a source-text comparison. `onResult(result)` fires after every
 * Submit with the built {passed, score, feedback, xpAward} result.
 */
export function renderLabRunner(lab, { onResult } = {}) {
  const local = { revealedHints: 0, answers: {}, solutionRevealed: false };

  const previewHost = el('div', {});
  const controller = createRunController({
    runner: lab.runner,
    panels: lab.panels,
    hostElement: previewHost,
    isSuspiciousNode: lab.isSuspiciousNode,
    isSuspiciousRequest: lab.isSuspiciousRequest,
  });
  const panelsWanted = controller.panelsWanted;

  const hintsSlot = el('div', {});
  const feedbackSlot = el('div', {});
  const solutionSlot = el('div', {});

  function reRenderHints() {
    mount(hintsSlot, renderHints(lab.hints, local.revealedHints, () => {
      local.revealedHints = revealNext(local.revealedHints, lab.hints.length);
      reRenderHints();
    }));
  }
  reRenderHints();

  const editor = lab.submissionMode === 'code'
    ? createCodeEditor({ initialCode: lab.initialCode, ariaLabel: `${lab.title} code editor` })
    : null;
  const answerForm = lab.submissionMode === 'answer' ? renderAnswerForm(lab.answerSchema, local.answers) : null;

  async function runSandbox() {
    if (lab.runner === 'worker') {
      await controller.run(editor ? editor.getValue() : lab.initialCode, lab.testScript);
    } else if (lab.runner === 'iframe') {
      await controller.run({
        siteHtml: lab.siteSnapshot,
        setupScript: lab.setupScript,
        code: lab.submissionMode === 'code' && editor ? editor.getValue() : '',
        testScript: lab.testScript,
      });
    }
  }

  function resetLab() {
    controller.reset();
    local.revealedHints = 0;
    local.answers = {};
    editor?.setValue(lab.initialCode);
    reRenderHints();
    mount(feedbackSlot, '');
    if (lab.runner === 'iframe' && lab.submissionMode === 'answer') runSandbox();
  }

  function submitLab() {
    const runResult = controller.getLastResult();
    let raw;
    if (lab.submissionMode === 'code') {
      if (!runResult) {
        showToast('Run your code first — grading looks at what actually happened.', 'danger');
        return;
      }
      raw = lab.validate(runResult, editor.getValue());
    } else {
      raw = lab.validate(local.answers, {
        networkLog: controller.getNetworkLog(),
        domSnapshot: controller.getDomSnapshot(),
        alerts: controller.getAlerts(),
        consoleLines: controller.getConsoleLines(),
        runResult,
      });
    }
    const result = buildResult(lab, raw.score, raw.passed, raw.feedback ?? []);
    mount(feedbackSlot, renderFeedback(lab, result));
    showToast(result.passed ? 'Lab passed.' : 'Not quite — see the feedback below.', result.passed ? 'success' : 'danger');
    onResult?.(result);
  }

  const autoRuns = lab.runner === 'iframe' && lab.submissionMode === 'answer' && lab.type !== 'predict';
  const runBtn = el('button', { class: 'btn btn--sm btn--primary', onClick: runSandbox }, autoRuns ? 'Replay' : 'Run');
  const resetBtn = el('button', { class: 'btn btn--sm', onClick: resetLab }, 'Reset');
  const submitBtn = el('button', { class: 'btn btn--sm btn--primary', onClick: submitLab }, 'Submit');
  const solutionBtn = el('button', { class: 'btn btn--sm btn--ghost', onClick: () => {
    local.solutionRevealed = true;
    mount(solutionSlot, renderSolution(lab));
  } }, 'Show solution');

  const leftCol = [
    lab.runner === 'iframe' ? renderPanel('Simulation', previewHost, { flush: true }) : null,
    lab.sourceCode ? renderPanel('Code', el('pre', { class: 'code-source' }, lab.sourceCode)) : null,
    editor ? renderPanel('Your code', editor.element, { flush: true }) : renderPanel('Your answer', answerForm),
    lab.hints.length ? renderPanel('Hints', hintsSlot) : null,
  ].filter(Boolean);

  const rightColPanels = [];
  if (panelsWanted.includes('trace')) rightColPanels.push(renderPanel('Execution trace', renderTraceStepper(controller)));
  if (lab.runner !== 'none') rightColPanels.push(renderPanel('Console', controller.slots.consoleSlot));
  if (panelsWanted.includes('dom')) rightColPanels.push(renderPanel('DOM inspector', controller.slots.domSlot));
  if (panelsWanted.includes('network')) rightColPanels.push(renderPanel('Network activity', controller.slots.networkSlot, { flush: true }));
  if (panelsWanted.includes('alerts')) rightColPanels.push(renderPanel('Security alerts', controller.slots.alertsSlot));
  if (panelsWanted.includes('eventPath')) rightColPanels.push(renderPanel('Event path', controller.slots.eventPathSlot));

  const element = el('section', { class: 'card lab-card', id: `lab-${lab.id}` }, [
    el('div', { class: 'lab-card__head' }, [
      el('div', {}, [
        el('span', { class: 'badge badge--accent' }, LAB_TYPE_LABELS[lab.type] ?? lab.type),
        el('strong', {}, ` ${lab.title}`),
      ]),
      el('div', { class: 'btn-row' }, [runBtn, resetBtn, submitBtn, solutionBtn]),
    ]),
    el('p', {}, lab.instructions),
    controller.slots.statusSlot,
    el('div', { class: 'workspace' }, [
      el('div', { class: 'workspace__col' }, leftCol),
      el('div', { class: 'workspace__col' }, rightColPanels),
    ]),
    feedbackSlot,
    solutionSlot,
  ]);

  // Auto-run investigation-style answer-mode labs so panels are populated to explore
  // immediately — but NEVER for 'predict' labs, where auto-running would hand the
  // learner the real console/DOM/network output before they've made their prediction.
  if (autoRuns) queueMicrotask(runSandbox);

  return { element, controller };
}

function renderFeedback(lab, result) {
  const meters = Object.entries({ correctness: 'Correctness', security: 'Security', compatibility: 'Compatibility', performance: 'Performance' })
    .filter(([key]) => typeof result.score[key] === 'number')
    .map(([key, label]) => renderScoreMeter(label, result.score[key]));

  return el('div', { class: 'debrief' }, [
    el('h4', {}, result.passed ? 'Correct' : 'Not yet'),
    el('div', { class: 'debrief__score-grid' }, meters),
    result.feedback.length ? el('ul', {}, result.feedback.map((f) => el('li', {}, f))) : null,
    el('p', {}, lab.explanation),
  ].filter(Boolean));
}

function renderSolution(lab) {
  return el('div', { class: 'debrief__section' }, [
    el('h4', {}, 'Solution'),
    el('pre', { class: 'code-source' }, lab.solution),
    el('p', {}, lab.explanation),
  ]);
}
