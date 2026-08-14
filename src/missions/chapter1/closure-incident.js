const EXPECTED_LINES = [
  'Session warning for tab 0',
  'Session warning for tab 1',
  'Session warning for tab 2',
];

function scoreLines(actual) {
  const len = Math.max(actual.length, EXPECTED_LINES.length);
  if (len === 0) return 1;
  let matches = 0;
  for (let i = 0; i < len; i += 1) {
    if (actual[i] === EXPECTED_LINES[i]) matches += 1;
  }
  return matches / len;
}

export default {
  id: 'closure-incident',
  chapter: 1,
  title: 'The Closure Incident',
  type: 'code-repair',
  difficulty: 'foundational',
  xp: 100,
  estimatedMinutes: 15,
  runner: 'worker',
  submissionMode: 'code',
  panels: ['trace'],

  objective: 'Diagnose and fix a var-in-async-loop closure bug, and explain exactly why it happens in terms of scope — not just "use let".',
  prerequisites: 'Basic familiarity with for loops, function declarations, and setTimeout.',
  scenario: 'A regional bank\'s session-timeout warning widget schedules a staggered warning for every open account tab. QA reports that no matter how many tabs are open, every warning says the same (wrong) tab number — and it\'s always one higher than the last real tab index.',
  task: 'Fix scheduleSessionWarnings so each scheduled warning logs its own tab index (0, 1, 2 — in that order), not a shared, stale value.',
  expectedBehavior: 'Running the code logs exactly: "Session warning for tab 0", then "Session warning for tab 1", then "Session warning for tab 2" — one per scheduled timer, each with its own correct index.',

  initialCode: `function scheduleSessionWarnings(tabCount) {
  for (var i = 0; i < tabCount; i++) {
    setTimeout(function () {
      console.log("Session warning for tab " + i);
    }, i * 10);
  }
}

scheduleSessionWarnings(3);
`,

  validate(runResult) {
    if (runResult.error) {
      return { passed: false, score: { correctness: 0 }, feedback: [`Your code threw an error: ${runResult.error}`] };
    }
    if (runResult.timedOut) {
      return { passed: false, score: { correctness: 0 }, feedback: ['Execution timed out — check for an infinite loop.'] };
    }
    const actual = (runResult.consoleHistory ?? []).map((l) => l.text);
    const fraction = scoreLines(actual);
    const passed = fraction === 1;
    const feedback = [`Console output was: ${actual.length ? actual.join(' | ') : '(nothing logged)'}`];
    if (!passed && actual.every((line) => line === actual[0])) {
      feedback.push('Every callback logged the same value — that\'s the signature of all three closures sharing one `var i` binding.');
    }
    return { passed, score: { correctness: fraction }, feedback };
  },

  hints: [
    'All three timers eventually fire and read `i` — the question is whether they each get their own `i`, or share one.',
    '`var` is function-scoped, not block-scoped. The `for` loop does not create a new `i` per iteration for `var` — there is exactly one `i` for the whole function, and every closure created inside the loop closes over that same one.',
    'Two real fixes: change `var i` to `let i` (this gives each loop iteration its own lexical binding), or pass `i` into the timer callback explicitly via `setTimeout(fn, delay, i)` so each callback gets its own parameter copy.',
  ],

  solution: `function scheduleSessionWarnings(tabCount) {
  for (let i = 0; i < tabCount; i++) {
    setTimeout(function () {
      console.log("Session warning for tab " + i);
    }, i * 10);
  }
}

scheduleSessionWarnings(3);`,

  explanation: '`var` is function-scoped. The `for` loop\'s `var i` is a single binding shared by the whole function body, including every callback created inside the loop — so all three `setTimeout` callbacks close over the exact same `i`. By the time any of them actually runs (after the loop has already finished synchronously), `i` holds its final post-loop value (3, since the loop condition `i < tabCount` fails at i===3), and all three would log "Session warning for tab 3" if left buggy. `let` is block-scoped: the `for` statement creates a fresh lexical binding of `i` for every iteration, so each closure captures its own independent value.',

  commonWrongAnswers: [
    { description: 'Assuming the buggy version prints "tab 2" three times.', why: 'It actually prints "tab 3" three times — the loop runs to completion (incrementing i to 3, where the condition fails) before any timer callback executes, since timers are macrotasks that only run after the synchronous loop finishes.' },
    { description: 'Wrapping only the console.log call in a function without capturing i by value.', why: 'If the wrapping closure doesn\'t take its own copy/parameter of i (or isn\'t re-created per iteration with its own let binding), it still reads the same outer variable and the bug persists.' },
  ],

  securityImpact: 'This exact pattern — a shared loop variable captured by multiple async callbacks — shows up in security-relevant code far more often than it seems: per-request rate-limit counters, per-session token indices, or per-tab/per-frame identifiers scheduled asynchronously. Getting the wrong index can mean applying a security check (or a permission, or a redaction) to the wrong record entirely.',
  runtimeExplanation: '`var` declarations are function-scoped and hoisted to the top of their enclosing function; a `for (var i ...)` loop does not get a new `i` per iteration — there is one `i`, mutated in place. `let`/`const` are block-scoped, and the specification defines `for (let i ...)` as creating a fresh lexical environment (a new binding of `i`) for each iteration, which is what allows each closure to capture a distinct value. This is scope behavior, defined by the ECMAScript spec — not a browser quirk.',
  sourceDefenseConnection: 'Runtime security instrumentation is full of loops that register callbacks per script, per DOM node, or per network request. A scope bug here doesn\'t crash anything — it silently attributes behavior to the wrong entity, which in a security monitor means misattributing a malicious action to an innocent script (or vice versa). This is exactly the kind of correctness bug that\'s invisible until someone asks "why did the alert say script #2 when it was actually script #5?"',
  followUp: 'Rewrite the fix using an IIFE instead of `let` (the classic pre-ES6 technique), and explain in one sentence why it produces the same correct result through a completely different mechanism.',
  skillTags: ['fundamentals', 'runtime'],
};
