/**
 * @typedef {Object} ModuleContent
 * @property {number} number - Display order, 1-indexed.
 * @property {string} id - Stable, unique — referenced by every lesson's moduleId.
 * @property {string} title
 * @property {string} summary
 */

/** @type {ModuleContent[]} */
export const MODULES = [
  { number: 1, id: 'scope-execution-closures', title: 'Scope, Execution Contexts, and Closures', summary: 'var/let/const, hoisting, the TDZ, lexical environments, and exactly how closures retain state.' },
  { number: 2, id: 'values-objects-this', title: 'Values, Objects, Functions, and this', summary: 'References vs. copies, the prototype chain, this-binding, and Proxy-based monitoring basics.' },
  { number: 3, id: 'async-event-loop', title: 'Async JavaScript and the Event Loop', summary: 'The call stack, Web APIs, tasks vs. microtasks, and the actual scheduling mechanism behind async code.' },
  { number: 4, id: 'dom-and-events', title: 'DOM and Events', summary: 'Capturing, bubbling, delegation, and the DOM APIs attackers and defenders both rely on.' },
  { number: 5, id: 'browser-architecture-security', title: 'Browser Architecture and Security Boundaries', summary: 'Origins, realms, iframes, and which protections are browser-enforced vs. JavaScript-enforced.' },
  { number: 6, id: 'network-and-script-loading', title: 'Network and Script Loading', summary: 'Fetch, CORS, script execution order, and what a page can see about its own requests.' },
  { number: 7, id: 'client-side-attacks', title: 'Client-Side Attacks', summary: 'DOM XSS, formjacking, and exfiltration channels — traced from source to sink, safely simulated.' },
  { number: 8, id: 'runtime-security-instrumentation', title: 'Runtime Security Instrumentation', summary: 'Wrapping native APIs correctly, and how hostile code defeats naive monitoring.' },
  { number: 9, id: 'performance-and-reliability', title: 'Performance and Reliability', summary: 'Measuring and reducing instrumentation overhead without losing detection.' },
];

/**
 * Fails loudly at load time if a module is missing a field or an id was duplicated by
 * copy-paste — mirrors validateLesson()/validateMission() in the other schema files.
 */
export function validateModules(modules) {
  const errors = [];
  const seenIds = new Set();
  for (const m of modules) {
    const label = m?.id ?? '(missing id)';
    if (typeof m?.number !== 'number') errors.push(`module "${label}" is missing a numeric "number"`);
    for (const field of ['id', 'title', 'summary']) {
      if (typeof m?.[field] !== 'string' || m[field].trim() === '') {
        errors.push(`module "${label}" is missing required string field "${field}"`);
      }
    }
    if (m?.id) {
      if (seenIds.has(m.id)) errors.push(`duplicate module id "${m.id}"`);
      seenIds.add(m.id);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}

validateModules(MODULES);

export function moduleById(id) {
  return MODULES.find((m) => m.id === id);
}
