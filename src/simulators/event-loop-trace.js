// Turns the ordered stream of trace/log events emitted by the real worker sandbox
// into a sequence of steppable snapshots (call stack / macrotask queue / microtask
// queue / console so far) for the event-loop stepper UI. The ordering is exactly the
// order the events actually arrived from the sandboxed execution — this is a replay
// of real behavior, not a scripted simulation.
export function buildTrace(events) {
  const steps = [];
  let stack = [];
  let macroQueue = [];
  let microQueue = [];
  let consoleLines = [];

  function snapshot(description) {
    steps.push({
      description,
      stack: [...stack],
      macroQueue: [...macroQueue],
      microQueue: [...microQueue],
      consoleLines: [...consoleLines],
    });
  }

  for (const event of events) {
    if (event.kind === 'log') {
      consoleLines = [...consoleLines, { level: event.level, text: event.text }];
      snapshot(`console.${event.level}: ${event.text}`);
      continue;
    }

    const { kind, label } = event;
    if (kind === 'sync-start') {
      stack = [...stack, label];
      snapshot(`${label} starts running`);
    } else if (kind === 'sync-end') {
      stack = stack.filter((f) => f !== label);
      snapshot(`${label} finishes (synchronous run complete)`);
    } else if (kind === 'schedule-macro') {
      macroQueue = [...macroQueue, label];
      snapshot(`${label} scheduled → macrotask queue`);
    } else if (kind === 'schedule-micro') {
      microQueue = [...microQueue, label];
      snapshot(`${label} scheduled → microtask queue`);
    } else if (kind === 'run-macro-start') {
      macroQueue = macroQueue.filter((l) => l !== label);
      stack = [...stack, label];
      snapshot(`${label} starts running (macrotask)`);
    } else if (kind === 'run-macro-end') {
      stack = stack.filter((f) => f !== label);
      snapshot(`${label} finishes`);
    } else if (kind === 'run-micro-start') {
      microQueue = microQueue.filter((l) => l !== label);
      stack = [...stack, label];
      snapshot(`${label} starts running (microtask)`);
    } else if (kind === 'run-micro-end') {
      stack = stack.filter((f) => f !== label);
      snapshot(`${label} finishes`);
    }
  }

  return steps;
}

/** Convenience for missions that only care about final console output ordering. */
export function consoleOrderFromTrace(steps) {
  if (steps.length === 0) return [];
  return steps[steps.length - 1].consoleLines.map((l) => l.text);
}
