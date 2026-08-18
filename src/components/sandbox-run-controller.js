// Shared "wire a sandbox to live panels" engine, extracted from what used to be
// inline in mission-view.js. Missions, lesson examples, and micro-labs all need the
// exact same glue: run code in a Worker/iframe sandbox, and keep the console/call
// stack/queues/DOM inspector/network/alerts/event-path panels in sync with what's
// actually happening — so it lives here once instead of being copy-pasted per caller.
import { el, mount } from '../utils/dom.js';
import { renderConsole } from './console-panel.js';
import { renderCallStack } from './call-stack-panel.js';
import { renderMacroQueue, renderMicroQueue } from './queue-panel.js';
import { renderAlerts } from './security-alerts-panel.js';
import { renderDomTree } from '../simulators/dom-inspector.js';
import { renderNetworkTable } from '../simulators/network-panel.js';
import { renderEventPath } from '../simulators/event-path-visualizer.js';
import { buildTrace } from '../simulators/event-loop-trace.js';
import { createWorkerSandbox } from '../sandbox/worker-sandbox.js';
import { createIframeSandbox } from '../sandbox/iframe-sandbox.js';

/**
 * @param {'worker'|'iframe'|'none'} runner
 * @param {string[]} panels - which of trace/dom/network/alerts/eventPath are relevant
 * @param {HTMLElement} [hostElement] - required for runner: 'iframe' (the sandboxed iframe mounts here)
 * @param {(nodeSnapshot) => boolean} [isSuspiciousNode]
 * @param {(networkEntry) => boolean} [isSuspiciousRequest]
 */
export function createRunController({ runner, panels, hostElement, isSuspiciousNode, isSuspiciousRequest } = {}) {
  const panelsWanted = panels ?? (runner === 'worker' ? ['trace'] : runner === 'iframe' ? ['dom', 'network', 'alerts'] : []);
  const sandbox = runner === 'worker' ? createWorkerSandbox() : runner === 'iframe' ? createIframeSandbox(hostElement) : null;

  const local = {
    combinedEvents: [], networkLog: [], alerts: [], domSnapshot: null, eventPath: null,
    traceSteps: [], traceIndex: 0, lastResult: null, running: false,
  };

  const slots = {
    consoleSlot: el('div', {}),
    stackSlot: el('div', {}),
    macroSlot: el('div', {}),
    microSlot: el('div', {}),
    traceStepLabel: el('div', { class: 'trace-step-indicator' }, 'No run yet'),
    domSlot: el('div', {}),
    networkSlot: el('div', {}),
    alertsSlot: el('div', {}),
    eventPathSlot: el('div', {}),
    statusSlot: el('div', { class: 'trace-step-indicator' }, ''),
  };

  function reRenderConsole() {
    mount(slots.consoleSlot, renderConsole(local.combinedEvents.filter((e) => e.kind === 'log')));
  }
  function renderTraceStep() {
    const step = local.traceSteps[local.traceIndex];
    mount(slots.stackSlot, renderCallStack(step?.stack));
    mount(slots.macroSlot, renderMacroQueue(step?.macroQueue));
    mount(slots.microSlot, renderMicroQueue(step?.microQueue));
    slots.traceStepLabel.textContent = step
      ? `Step ${local.traceIndex + 1} / ${local.traceSteps.length} — ${step.description}`
      : 'No run yet';
  }
  /**
   * @param {boolean} landOnFirstStep - true once the run has fully finished, so the
   *   learner lands on step 1 and steps forward with Next — not on the last step,
   *   which would mean immediately having to walk all the way back with Prev. False
   *   while events are still streaming in during the run itself, which keeps the view
   *   following the newest step as it happens.
   */
  function reRenderTrace(landOnFirstStep = false) {
    local.traceSteps = buildTrace(local.combinedEvents);
    local.traceIndex = landOnFirstStep ? 0 : local.traceSteps.length - 1;
    renderTraceStep();
  }
  function reRenderDom() {
    mount(slots.domSlot, renderDomTree(local.domSnapshot, isSuspiciousNode ?? (() => false)));
  }
  function reRenderNetwork() {
    mount(slots.networkSlot, renderNetworkTable(local.networkLog, isSuspiciousRequest ?? (() => false)));
  }
  function reRenderAlerts() {
    mount(slots.alertsSlot, renderAlerts(local.alerts));
  }
  function reRenderEventPath() {
    mount(slots.eventPathSlot, renderEventPath(local.eventPath));
  }
  function renderAll() {
    reRenderConsole(); reRenderTrace(); reRenderDom(); reRenderNetwork(); reRenderAlerts(); reRenderEventPath();
  }
  renderAll();

  /**
   * Status text is never the only signal — every state below pairs a distinct word
   * ("Running…", "Run complete.", "Error: …") with a color, so the state doesn't
   * depend on color perception alone.
   */
  function setStatus(text, tone) {
    slots.statusSlot.textContent = text;
    slots.statusSlot.className = `trace-step-indicator${tone ? ` trace-step-indicator--${tone}` : ''}`;
  }

  /**
   * @param {string|object} codeOrPayload - a code string for runner:'worker', or the
   *   full { siteHtml, setupScript, code, testScript } payload for runner:'iframe'
   *   (iframe testScript must already be included in the payload object itself).
   * @param {string} [testScript] - worker-runner only; ignored for iframe.
   */
  async function run(codeOrPayload, testScript) {
    if (!sandbox || local.running) return local.lastResult;
    local.running = true;
    setStatus('Running…', 'running');
    local.combinedEvents = [];
    local.networkLog = [];
    local.alerts = [];
    local.domSnapshot = null;
    local.eventPath = null;
    reRenderConsole(); reRenderDom(); reRenderNetwork(); reRenderAlerts();

    const onLog = (payload) => { local.combinedEvents.push({ kind: 'log', ...payload }); reRenderConsole(); };
    const onTrace = (payload) => { local.combinedEvents.push(payload); if (panelsWanted.includes('trace')) reRenderTrace(); };
    const onNetwork = (payload) => { local.networkLog.push(payload); reRenderNetwork(); };
    const onSecurityAlert = (payload) => { local.alerts.push(payload); reRenderAlerts(); };
    const onDomSnapshot = (payload) => { local.domSnapshot = payload.tree; reRenderDom(); };
    const onEventPath = (payload) => { local.eventPath = payload.path ?? []; reRenderEventPath(); };

    const result = runner === 'worker'
      ? await sandbox.run(codeOrPayload, { testScript, onLog, onTrace })
      : await sandbox.run(codeOrPayload, { onLog, onTrace, onNetwork, onSecurityAlert, onDomSnapshot, onEventPath });

    local.running = false;
    local.lastResult = result;
    if (panelsWanted.includes('trace')) reRenderTrace(true);
    if (result.timedOut) setStatus('Timed out.', 'danger');
    else if (result.error) setStatus(`Error: ${result.error}`, 'danger');
    else setStatus('Run complete.', 'success');
    return result;
  }

  function reset() {
    sandbox?.reset();
    local.combinedEvents = [];
    local.networkLog = [];
    local.alerts = [];
    local.domSnapshot = null;
    local.eventPath = null;
    local.traceSteps = [];
    local.traceIndex = 0;
    local.lastResult = null;
    setStatus('', null);
    renderAll();
  }

  function stepBack() {
    local.traceIndex = Math.max(0, local.traceIndex - 1);
    renderTraceStep();
  }
  function stepForward() {
    local.traceIndex = Math.min(local.traceSteps.length - 1, local.traceIndex + 1);
    renderTraceStep();
  }

  return {
    slots,
    panelsWanted,
    run,
    reset,
    stepBack,
    stepForward,
    getLastResult: () => local.lastResult,
    getConsoleLines: () => local.combinedEvents.filter((e) => e.kind === 'log'),
    getNetworkLog: () => local.networkLog,
    getAlerts: () => local.alerts,
    getDomSnapshot: () => local.domSnapshot,
    isRunning: () => local.running,
    destroy: () => sandbox?.reset(),
  };
}

/** The trace-columns + Prev/Next stepper, shared by mission view, lesson walkthroughs, and labs. */
export function renderTraceStepper(controller) {
  return el('div', {}, [
    el('div', { class: 'trace-columns' }, [
      el('div', {}, [el('div', { class: 'trace-col__title' }, 'Call Stack'), controller.slots.stackSlot]),
      el('div', {}, [el('div', { class: 'trace-col__title' }, 'Microtask Queue'), controller.slots.microSlot]),
      el('div', {}, [el('div', { class: 'trace-col__title' }, 'Macrotask Queue'), controller.slots.macroSlot]),
    ]),
    el('div', { class: 'trace-controls' }, [
      controller.slots.traceStepLabel,
      el('div', { class: 'trace-controls__buttons' }, [
        el('button', { class: 'btn btn--sm', onClick: () => controller.stepBack() }, '◀ Prev'),
        el('button', { class: 'btn btn--sm', onClick: () => controller.stepForward() }, 'Next ▶'),
      ]),
    ]),
  ]);
}
