import { el, mount } from '../utils/dom.js';
import { renderPanel } from './panel.js';
import { createCodeEditor } from './code-editor.js';
import { renderConsole } from './console-panel.js';
import { renderCallStack } from './call-stack-panel.js';
import { renderMacroQueue, renderMicroQueue } from './queue-panel.js';
import { renderAlerts } from './security-alerts-panel.js';
import { renderHints } from './hint-panel.js';
import { renderDebrief } from './debrief-panel.js';
import { showToast } from './toast.js';
import { renderDomTree } from '../simulators/dom-inspector.js';
import { renderNetworkTable } from '../simulators/network-panel.js';
import { renderEventPath } from '../simulators/event-path-visualizer.js';
import { buildTrace } from '../simulators/event-loop-trace.js';
import { createWorkerSandbox } from '../sandbox/worker-sandbox.js';
import { createIframeSandbox } from '../sandbox/iframe-sandbox.js';
import { buildResult } from '../game/scoring.js';
import { revealNext } from '../game/hints.js';
import { store } from '../state/store.js';

export function renderMissionView(mission, registry) {
  const local = {
    revealedHints: 0,
    combinedEvents: [],
    networkLog: [],
    alerts: [],
    domSnapshot: null,
    eventPath: null,
    traceSteps: [],
    traceIndex: 0,
    runResult: null,
    answers: {},
    running: false,
  };

  const panelsWanted = mission.panels ?? (mission.runner === 'worker' ? ['trace'] : mission.runner === 'iframe' ? ['dom', 'network', 'alerts'] : []);

  // Stable containers that get their contents replaced in place, so the code editor
  // (and its caret/focus) never gets torn down while telemetry panels update live.
  const previewHost = el('div', {});
  const sandbox = mission.runner === 'worker' ? createWorkerSandbox() : mission.runner === 'iframe' ? createIframeSandbox(previewHost) : null;
  const consoleSlot = el('div', {});
  const stackSlot = el('div', {});
  const macroSlot = el('div', {});
  const microSlot = el('div', {});
  const traceStepLabel = el('div', { class: 'trace-step-indicator' }, 'No run yet');
  const domSlot = el('div', {});
  const networkSlot = el('div', {});
  const alertsSlot = el('div', {});
  const eventPathSlot = el('div', {});
  const hintsSlot = el('div', {});
  const debriefSlot = el('div', {});
  const statusSlot = el('div', { class: 'trace-step-indicator' }, '');

  function reRenderConsole() {
    const lines = local.combinedEvents.filter((e) => e.kind === 'log');
    mount(consoleSlot, renderConsole(lines));
  }
  function reRenderTrace() {
    local.traceSteps = buildTrace(local.combinedEvents);
    local.traceIndex = local.traceSteps.length - 1;
    renderTraceStep();
  }
  function renderTraceStep() {
    const step = local.traceSteps[local.traceIndex];
    mount(stackSlot, renderCallStack(step?.stack));
    mount(macroSlot, renderMacroQueue(step?.macroQueue));
    mount(microSlot, renderMicroQueue(step?.microQueue));
    traceStepLabel.textContent = step
      ? `Step ${local.traceIndex + 1} / ${local.traceSteps.length} — ${step.description}`
      : 'No run yet';
  }
  function reRenderDom() {
    mount(domSlot, renderDomTree(local.domSnapshot, mission.isSuspiciousNode ?? (() => false)));
  }
  function reRenderNetwork() {
    mount(networkSlot, renderNetworkTable(local.networkLog, mission.isSuspiciousRequest ?? (() => false)));
  }
  function reRenderAlerts() {
    mount(alertsSlot, renderAlerts(local.alerts));
  }
  function reRenderEventPath() {
    mount(eventPathSlot, renderEventPath(local.eventPath));
  }
  function reRenderHints() {
    mount(hintsSlot, renderHints(mission.hints, local.revealedHints, () => {
      local.revealedHints = revealNext(local.revealedHints, mission.hints.length);
      reRenderHints();
    }));
  }

  reRenderConsole();
  reRenderTrace();
  reRenderDom();
  reRenderNetwork();
  reRenderAlerts();
  reRenderEventPath();
  reRenderHints();

  const editor = mission.submissionMode === 'code'
    ? createCodeEditor({ initialCode: mission.initialCode, ariaLabel: `${mission.title} code editor` })
    : null;

  const answerForm = mission.submissionMode === 'answer' ? renderAnswerForm(mission, local) : null;

  async function runSandbox() {
    if (!sandbox || local.running) return;
    local.running = true;
    statusSlot.textContent = 'Running…';
    local.combinedEvents = [];
    local.networkLog = [];
    local.alerts = [];
    local.domSnapshot = null;
    local.eventPath = null;
    reRenderConsole();
    reRenderDom();
    reRenderNetwork();
    reRenderAlerts();

    const onLog = (payload) => { local.combinedEvents.push({ kind: 'log', ...payload }); reRenderConsole(); };
    const onTrace = (payload) => { local.combinedEvents.push(payload); if (panelsWanted.includes('trace')) reRenderTrace(); };
    const onNetwork = (payload) => { local.networkLog.push(payload); reRenderNetwork(); };
    const onSecurityAlert = (payload) => { local.alerts.push(payload); reRenderAlerts(); };
    const onDomSnapshot = (payload) => { local.domSnapshot = payload.tree; reRenderDom(); };
    const onEventPath = (payload) => { local.eventPath = payload.path ?? []; reRenderEventPath(); };

    let result;
    if (mission.runner === 'worker') {
      result = await sandbox.run(editor ? editor.getValue() : mission.initialCode, {
        testScript: mission.testScript, onLog, onTrace,
      });
    } else {
      result = await sandbox.run(
        {
          siteHtml: mission.siteSnapshot,
          setupScript: mission.setupScript,
          code: mission.submissionMode === 'code' && editor ? editor.getValue() : '',
          testScript: mission.testScript,
        },
        { onLog, onTrace, onNetwork, onSecurityAlert, onDomSnapshot, onEventPath }
      );
    }

    local.running = false;
    local.runResult = result;
    if (panelsWanted.includes('trace')) reRenderTrace();
    statusSlot.textContent = result.timedOut
      ? 'Timed out.'
      : result.error
        ? `Error: ${result.error}`
        : 'Run complete.';
  }

  function resetMission() {
    sandbox?.reset();
    local.revealedHints = 0;
    local.combinedEvents = [];
    local.networkLog = [];
    local.alerts = [];
    local.domSnapshot = null;
    local.eventPath = null;
    local.traceSteps = [];
    local.traceIndex = 0;
    local.runResult = null;
    local.answers = {};
    editor?.setValue(mission.initialCode);
    reRenderConsole();
    reRenderTrace();
    reRenderDom();
    reRenderNetwork();
    reRenderAlerts();
    reRenderEventPath();
    mount(debriefSlot, '');
    statusSlot.textContent = '';
    if (mission.submissionMode === 'answer' && mission.runner === 'iframe') runSandbox();
  }

  function submitSolution() {
    let raw;
    if (mission.submissionMode === 'code') {
      if (!local.runResult) {
        showToast('Run your code first so the mission can grade the actual execution.', 'danger');
        return;
      }
      raw = mission.validate(local.runResult, editor.getValue());
    } else {
      raw = mission.validate(local.answers, {
        networkLog: local.networkLog,
        domSnapshot: local.domSnapshot,
        alerts: local.alerts,
        consoleLines: local.combinedEvents.filter((e) => e.kind === 'log'),
        runResult: local.runResult,
      });
    }
    const result = buildResult(mission, raw.score, raw.passed, raw.feedback ?? []);
    const { unlockedAchievements } = store.submitMissionResult(mission, result, registry);
    mount(debriefSlot, renderDebrief(mission, result));
    showToast(result.passed ? `Mission passed — +${result.xpAward} XP` : 'Not yet — see the debrief for what to fix.', result.passed ? 'success' : 'danger');
    unlockedAchievements.forEach((id) => showToast(`Achievement unlocked: ${id}`, 'achievement'));
  }

  const runBtn = el('button', { class: 'btn btn--primary', onClick: runSandbox }, mission.runner === 'none' ? 'Run' : mission.submissionMode === 'answer' ? 'Replay Simulation' : 'Run');
  const resetBtn = el('button', { class: 'btn', onClick: resetMission }, 'Reset Mission');
  const submitBtn = el('button', { class: 'btn btn--primary', onClick: submitSolution }, 'Submit Solution');

  const leftCol = [
    mission.runner === 'iframe' ? renderPanel('Site Simulation (sandboxed iframe, isolated realm)', previewHost, { flush: true }) : null,
    mission.sourceCode ? renderPanel('Source Under Investigation', el('pre', { class: 'code-source' }, mission.sourceCode)) : null,
    editor ? renderPanel(mission.editorLabel ?? 'Your Code', editor.element, { flush: true }) : renderPanel('Your Answer', answerForm),
    renderPanel('Hints', hintsSlot),
  ].filter(Boolean);

  const rightColPanels = [];
  if (panelsWanted.includes('trace')) {
    const stepperControls = el('div', { class: 'trace-controls' }, [
      el('button', { class: 'btn btn--sm', onClick: () => { local.traceIndex = Math.max(0, local.traceIndex - 1); renderTraceStep(); } }, '◀ Prev'),
      traceStepLabel,
      el('button', { class: 'btn btn--sm', onClick: () => { local.traceIndex = Math.min(local.traceSteps.length - 1, local.traceIndex + 1); renderTraceStep(); } }, 'Next ▶'),
    ]);
    rightColPanels.push(
      renderPanel('Execution Trace', el('div', {}, [
        el('div', { class: 'trace-columns' }, [
          el('div', {}, [el('div', { class: 'trace-col__title' }, 'Call Stack'), stackSlot]),
          el('div', {}, [el('div', { class: 'trace-col__title' }, 'Microtask Queue'), microSlot]),
          el('div', {}, [el('div', { class: 'trace-col__title' }, 'Macrotask Queue'), macroSlot]),
        ]),
        stepperControls,
      ]))
    );
  }
  rightColPanels.push(renderPanel('Console', consoleSlot));
  if (panelsWanted.includes('dom')) rightColPanels.push(renderPanel('DOM Inspector', domSlot));
  if (panelsWanted.includes('network')) rightColPanels.push(renderPanel('Network Activity (mocked — no real requests leave the sandbox)', networkSlot, { flush: true }));
  if (panelsWanted.includes('alerts')) rightColPanels.push(renderPanel('Security Alerts', alertsSlot));
  if (panelsWanted.includes('eventPath')) {
    rightColPanels.push(renderPanel('Event Path (captured from the last Run)', eventPathSlot));
  }

  const view = el('div', { class: 'mission-view' }, [
    el('div', { class: 'mission-header' }, [
      el('div', {}, [
        el('h1', {}, mission.title),
        el('div', { class: 'mission-header__meta' }, [
          el('span', { class: 'badge badge--accent' }, mission.type),
          el('span', { class: 'badge' }, mission.difficulty),
          el('span', { class: 'badge' }, `${mission.xp} XP`),
          el('span', { class: 'badge' }, `~${mission.estimatedMinutes} min`),
        ]),
      ]),
      el('div', {}, [el('div', { class: 'btn-row' }, [runBtn, resetBtn, submitBtn]), statusSlot]),
    ]),
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
  ]);

  // Auto-run investigation missions so the panels are populated without requiring
  // the learner to press Run first — they're here to observe, not to author code.
  if (mission.runner === 'iframe' && mission.submissionMode === 'answer') {
    queueMicrotask(runSandbox);
  }

  return { element: view, cleanup: () => sandbox?.reset() };
}

function renderAnswerForm(mission, local) {
  const fields = mission.answerSchema.map((q) => {
    if (q.type === 'boolean') {
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('select', { onChange: (e) => { local.answers[q.id] = e.target.value; } }, [
          el('option', { value: '' }, 'Select…'),
          el('option', { value: 'true' }, 'True'),
          el('option', { value: 'false' }, 'False'),
        ]),
      ]);
    }
    if (q.type === 'select') {
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('select', { onChange: (e) => { local.answers[q.id] = e.target.value; } }, [
          el('option', { value: '' }, 'Select…'),
          ...q.options.map((opt) => el('option', { value: opt }, opt)),
        ]),
      ]);
    }
    if (q.type === 'multiselect') {
      local.answers[q.id] = [];
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('div', {}, q.options.map((opt) => {
          const id = `${q.id}-${opt}`;
          return el('div', {}, [
            el('input', { type: 'checkbox', id, onChange: (e) => {
              const set = new Set(local.answers[q.id]);
              e.target.checked ? set.add(opt) : set.delete(opt);
              local.answers[q.id] = [...set];
            } }),
            el('label', { for: id }, ` ${opt}`),
          ]);
        })),
      ]);
    }
    return el('div', { class: 'field' }, [
      el('label', {}, q.prompt),
      el('textarea', { rows: '3', onInput: (e) => { local.answers[q.id] = e.target.value; } }),
    ]);
  });
  return el('form', { onSubmit: (e) => e.preventDefault() }, fields);
}
