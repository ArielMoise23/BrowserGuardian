export const CHAPTERS = [
  { number: 1, id: 'runtime-reboot', title: 'JavaScript Runtime Reboot', summary: 'Scope, closures, prototypes, this, and the primitives you\'re expected to already know cold.' },
  { number: 2, id: 'execution-under-the-hood', title: 'Execution Under the Hood', summary: 'Call stack, heap, event loop, tasks vs microtasks — visualized, not just described.' },
  { number: 3, id: 'dom-and-events', title: 'DOM and Browser Events', summary: 'Capturing, bubbling, delegation, and the DOM APIs attackers and defenders both rely on.' },
  { number: 4, id: 'browser-architecture', title: 'Browser Architecture and Isolation', summary: 'Processes, origins, realms, iframes, and the boundaries that actually enforce security.' },
  { number: 5, id: 'network-behavior', title: 'Network Behavior', summary: 'Fetch, CORS, cookies, and what a page can and cannot see about its own requests.' },
  { number: 6, id: 'script-loading', title: 'Script Loading and Third-Party JavaScript', summary: 'How third-party tags execute, and what they can touch once they\'re on your page.' },
  { number: 7, id: 'client-side-attacks', title: 'Client-Side Attacks', summary: 'DOM XSS, formjacking, prototype pollution, and exfiltration — safely simulated.' },
  { number: 8, id: 'runtime-security-engineering', title: 'Runtime Security Engineering', summary: 'Building instrumentation that detects and blocks without breaking the site it protects.' },
  { number: 9, id: 'evasion-and-robustness', title: 'Evasion and Defensive Robustness', summary: 'How hostile code defeats naive monitoring, and how to make instrumentation resist it.' },
  { number: 10, id: 'performance-and-reliability', title: 'Performance and Production Reliability', summary: 'Making security instrumentation fast, safe to roll out, and easy to kill if it misfires.' },
];

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id);
}

export function chapterByNumber(number) {
  return CHAPTERS.find((c) => c.number === number);
}
