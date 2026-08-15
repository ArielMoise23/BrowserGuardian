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

export function moduleById(id) {
  return MODULES.find((m) => m.id === id);
}
