import { el, mount } from '../utils/dom.js';
import { renderPanel } from './panel.js';
import { createCodeEditor } from './code-editor.js';
import { renderHints } from './hint-panel.js';
import { renderDebrief } from './debrief-panel.js';
import { showToast } from './toast.js';
import { createRunController, renderTraceStepper } from './sandbox-run-controller.js';
import { renderAnswerForm } from './answer-form.js';
import { buildResult } from '../game/scoring.js';
import { revealNext } from '../game/hints.js';
import { store } from '../state/store.js';
import { lessonRegistry } from '../game/lessonRegistry.js';
import { missionTypeLabel } from '../game/missionSchema.js';

export function renderMissionView(mission, registry) {
  const local = { revealedHints: 0, answers: {} };

  const previewHost = el('div', {});
  const controller = createRunController({
    runner: mission.runner,
    panels: mission.panels,
    hostElement: previewHost,
    isSuspiciousNode: mission.isSuspiciousNode,
    isSuspiciousRequest: mission.isSuspiciousRequest,
  });
  const panelsWanted = controller.panelsWanted;

  const hintsSlot = el('div', {});
  const debriefSlot = el('div', {});

  function reRenderHints() {
    mount(hintsSlot, renderHints(mission.hints, local.revealedHints, () => {
      local.revealedHints = revealNext(local.revealedHints, mission.hints.length);
      reRenderHints();
    }));
  }
  reRenderHints();

  const editor = mission.submissionMode === 'code'
    ? createCodeEditor({ initialCode: mission.initialCode, ariaLabel: `${mission.title} code editor` })
    : null;

  const answerForm = mission.submissionMode === 'answer' ? renderAnswerForm(mission.answerSchema, local.answers) : null;

  async function runSandbox() {
    if (mission.runner === 'worker') {
      await controller.run(editor ? editor.getValue() : mission.initialCode, mission.testScript);
    } else if (mission.runner === 'iframe') {
      await controller.run({
        siteHtml: mission.siteSnapshot,
        setupScript: mission.setupScript,
        code: mission.submissionMode === 'code' && editor ? editor.getValue() : '',
        testScript: mission.testScript,
      });
    }
  }

  function resetMission() {
    controller.reset();
    local.revealedHints = 0;
    local.answers = {};
    editor?.setValue(mission.initialCode);
    reRenderHints();
    mount(debriefSlot, '');
    if (mission.submissionMode === 'answer' && mission.runner === 'iframe') runSandbox();
  }

  function submitSolution() {
    const runResult = controller.getLastResult();
    let raw;
    if (mission.submissionMode === 'code') {
      if (!runResult) {
        showToast('Run your code first so the mission can grade the actual execution.', 'danger');
        return;
      }
      raw = mission.validate(runResult, editor.getValue());
    } else {
      raw = mission.validate(local.answers, {
        networkLog: controller.getNetworkLog(),
        domSnapshot: controller.getDomSnapshot(),
        alerts: controller.getAlerts(),
        consoleLines: controller.getConsoleLines(),
        runResult,
      });
    }
    const result = buildResult(mission, raw.score, raw.passed, raw.feedback ?? []);
    const { unlockedAchievements } = store.submitMissionResult(mission, result, registry);
    mount(debriefSlot, renderDebrief(mission, result, relatedLessonsFor(mission.id)));
    showToast(result.passed ? `Mission passed — +${result.xpAward} XP` : 'Not yet — see the debrief for what to fix.', result.passed ? 'success' : 'danger');
    unlockedAchievements.forEach((id) => showToast(`Achievement unlocked: ${id}`, 'achievement'));
  }

  const runBtn = el('button', { class: 'btn btn--primary', onClick: runSandbox }, mission.runner === 'none' ? 'Run' : mission.submissionMode === 'answer' ? 'Replay Simulation' : 'Run');
  const resetBtn = el('button', { class: 'btn', onClick: resetMission }, 'Reset Mission');
  const submitBtn = el('button', { class: 'btn btn--primary', onClick: submitSolution }, 'Submit Solution');

  const relatedLessons = relatedLessonsFor(mission.id);
  const prepBanner = relatedLessons.length
    ? el('div', { class: 'card prep-banner' }, [
        el('strong', {}, 'Recommended prep: '),
        ...relatedLessons.flatMap((lesson, i) => [
          i > 0 ? ', ' : '',
          el('a', { href: `#/learn/${lesson.id}` }, lesson.title),
        ]),
        el('span', { class: 'prep-banner__note' }, ' — optional; jump straight into the mission if you\'re confident.'),
      ])
    : null;

  const leftCol = [
    mission.runner === 'iframe' ? renderPanel('Site Simulation (sandboxed iframe, isolated realm)', previewHost, { flush: true }) : null,
    mission.sourceCode ? renderPanel('Source Under Investigation', el('pre', { class: 'code-source' }, mission.sourceCode)) : null,
    editor ? renderPanel(mission.editorLabel ?? 'Your Code', editor.element, { flush: true }) : renderPanel('Your Answer', answerForm),
    renderPanel('Hints', hintsSlot),
  ].filter(Boolean);

  const rightColPanels = [];
  if (panelsWanted.includes('trace')) rightColPanels.push(renderPanel('Execution Trace', renderTraceStepper(controller)));
  if (mission.runner !== 'none') rightColPanels.push(renderPanel('Console', controller.slots.consoleSlot));
  if (panelsWanted.includes('dom')) rightColPanels.push(renderPanel('DOM Inspector', controller.slots.domSlot));
  if (panelsWanted.includes('network')) rightColPanels.push(renderPanel('Network Activity (mocked — no real requests leave the sandbox)', controller.slots.networkSlot, { flush: true }));
  if (panelsWanted.includes('alerts')) rightColPanels.push(renderPanel('Security Alerts', controller.slots.alertsSlot));
  if (panelsWanted.includes('eventPath')) rightColPanels.push(renderPanel('Event Path (captured from the last Run)', controller.slots.eventPathSlot));

  const view = el('div', { class: 'mission-view' }, [
    el('div', { class: 'mission-header' }, [
      el('div', {}, [
        el('h1', {}, mission.title),
        el('div', { class: 'mission-header__meta' }, [
          el('span', { class: 'badge badge--accent' }, missionTypeLabel(mission.type)),
          el('span', { class: 'badge' }, mission.difficulty),
          el('span', { class: 'badge' }, `${mission.xp} XP`),
          el('span', { class: 'badge' }, `~${mission.estimatedMinutes} min`),
        ]),
      ]),
      el('div', {}, [el('div', { class: 'btn-row' }, [runBtn, resetBtn, submitBtn]), controller.slots.statusSlot]),
    ]),
    prepBanner,
    el('div', { class: 'card mission-briefing' }, [
      el('p', {}, mission.scenario),
      el('dl', {}, [
        el('dt', {}, 'Objective'), el('dd', {}, mission.objective),
        el('dt', {}, 'Prerequisite knowledge'), el('dd', {}, mission.prerequisites),
        el('dt', {}, 'Task'), el('dd', {}, mission.task),
        el('dt', {}, 'Expected behavior'), el('dd', {}, mission.expectedBehavior),
      ]),
    ]),
    el('div', { class: 'workspace' }, [
      el('div', { class: 'workspace__col' }, leftCol),
      el('div', { class: 'workspace__col' }, rightColPanels),
    ]),
    debriefSlot,
  ].filter(Boolean));

  // Auto-run investigation missions so the panels are populated without requiring
  // the learner to press Run first — they're here to observe, not to author code.
  if (mission.runner === 'iframe' && mission.submissionMode === 'answer') {
    queueMicrotask(runSandbox);
  }

  return { element: view, cleanup: () => controller.destroy() };
}

function relatedLessonsFor(missionId) {
  try {
    return lessonRegistry.missionToLessons(missionId);
  } catch {
    return [];
  }
}
