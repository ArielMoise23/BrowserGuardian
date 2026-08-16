const ORDER_SNIPPET = `console.log("1: sync");
setTimeout(() => console.log("2: macrotask"), 0);
Promise.resolve().then(() => console.log("3: microtask"));
console.log("4: sync");`;

function extractLeadingNumber(text) {
  const m = /^(\d+):/.exec(text);
  return m ? m[1] : null;
}

const PROMISE_CHAIN_REFERENCE = `function loadUserProfile() {
  return fetch('/api/user')
    .then(function (res) { return res.json(); })
    .then(function (user) {
      console.log("Loaded user, mocked:", user.mocked);
      return user;
    });
}`;

const ASYNC_AWAIT_SKELETON = `async function loadUserProfile() {
  // Rewrite the reference Promise-chain version (shown in the Code panel) using
  // async/await instead. Same behavior: fetch '/api/user', parse the JSON body,
  // and log: "Loaded user, mocked: <value>"
}
`;

const ASYNC_AWAIT_TEST_SCRIPT = `(async function () {
  await loadUserProfile();
  __report({ logged: __consoleHistory.some(function (e) { return /loaded user, mocked: true/i.test(e.text); }) });
})();
`;

const RACE_BUGGY = `let latestResult = null;

function search(query, delayMs) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(query);
    }, delayMs);
  }).then(function (result) {
    latestResult = result; // BUG: overwrites even if a newer search already resolved
    console.log("Displaying results for:", latestResult);
  });
}

search("a", 30);   // slow — imagine a slow network response
search("ab", 5);   // fast — the user kept typing, and this is the real latest query
`;

const LONG_TASK_SNIPPET = `console.log("start");
setTimeout(function () {
  console.log("timer fired");
}, 0);

let sum = 0;
for (let i = 0; i < 150000000; i++) {
  sum += i;
}
console.log("loop finished, sum =", sum);`;

const EXAMPLE_CODE = `console.log("A: sync");
setTimeout(() => console.log("B: setTimeout (macrotask)"), 0);
Promise.resolve().then(() => console.log("C: promise.then (microtask)"));
queueMicrotask(() => console.log("D: queueMicrotask (microtask)"));
console.log("E: sync");
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'call-stack-event-loop',
  moduleId: 'async-event-loop',
  title: 'Call Stack, Tasks, Microtasks, and the Event Loop',
  estimatedMinutes: 30,
  difficulty: 'core',
  prerequisites: ['var-let-const-closures'],
  relatedMissionIds: ['microtask-mayhem'],
  skillTags: ['asyncEventLoop', 'runtime'],

  explanation: [
    'JavaScript runs on a single call stack — one thing at a time, always. Async code does not mean the language becomes concurrent; it means the browser (or Node) does the actual waiting outside the language entirely, and hands work back to that same single call stack later, through queues. There are two queues that matter — microtasks (Promise reactions, `queueMicrotask`) and macrotasks (`setTimeout`, DOM events, network callbacks) — and one rule governs their order: the entire microtask queue empties before the next macrotask ever gets a turn.',
    'The ECMAScript language itself defines only synchronous execution, plus Promise reactions as "Jobs" on a microtask queue — it has no concept of `setTimeout`, the DOM, or an event loop. Those come from the host environment: the HTML Standard for browsers, or Node\'s own event loop for Node. In HTML-standard terms a scheduled callback is a "task"; developers almost always say "macrotask" instead, to contrast it with "microtask" — both names refer to the same queue, and this lesson uses "macrotask" throughout for that reason. The event loop repeatedly runs one macrotask, drains the entire microtask queue, then (in a browser) may render, then picks the next macrotask — microtasks always fully drain between macrotasks, which is why they consistently run before the next macrotask even when both look ready at the same moment.',
    'Because the microtask queue must fully drain before the next macrotask runs, code that keeps scheduling new microtasks from within microtasks can starve macrotasks — and rendering — indefinitely: `function loop() { Promise.resolve().then(loop); }` never lets a timer, a click handler, or a repaint happen, because the queue is never empty long enough for control to move past it. This is a different mechanism from a long synchronous loop, which blocks by occupying the call stack continuously; microtask starvation blocks by never letting the draining step finish, even though the stack itself is briefly empty between each microtask. Both produce an unresponsive page, but they are distinct failure modes worth naming separately.',
    'This scheduling model matters for security in two directions. A scanner that loads a page, waits for the load event, and inspects it once is checking a single moment — nesting malicious code several macrotasks deep, or behind a delay, pushes its behavior past that window while looking inert during it, which is why realistic monitoring watches continuously rather than inspecting once. Building that monitoring also means knowing where its own callback lands in the ordering: a MutationObserver callback, for example, is scheduled as a microtask and batched, firing once per checkpoint with every mutation queued since the last one, not once per mutation — before reacting to any browser callback, check whether it is a task or a microtask and whether it batches.',
  ],

  distinctions: [
    { label: 'ECMAScript spec', text: 'Promise reaction callbacks ARE defined at the language level, as "Jobs" on a job queue. setTimeout, the DOM, fetch, and the event loop itself are not — those come entirely from the host.' },
    { label: 'Browser-provided', text: 'The event loop\'s scheduling behavior (task queue, rendering opportunities) is defined by the HTML Standard. Node.js has a different event loop (libuv, with its own phases) — "the event loop" is not one universal thing across every JS environment.' },
    { label: 'Simplified model', text: 'Describing callbacks as "moving from a queue into the call stack" is a useful simplification — more precisely, the event loop calls the associated function, which pushes a new execution context onto what starts as an empty stack; nothing is literally relocated between data structures.' },
    { label: 'Implementation detail', text: 'How many microtasks run before a browser squeezes in a render, and how task sources (timers vs. input vs. network) are prioritized against each other, can differ across engines even though the broad model — drain all microtasks between tasks — is shared.' },
  ],

  tldr: [
    'JavaScript has exactly one call stack; the event loop, tasks (macrotasks), and microtasks come from the host environment, not the ECMAScript language itself.',
    'The entire microtask queue drains — including microtasks scheduled during that drain — before the next macrotask ever runs.',
    'A setTimeout delay is a minimum wait, not a guarantee: the callback still needs an empty call stack and its turn in the queue.',
    'Recursively self-scheduling microtasks can starve macrotasks and rendering indefinitely, even with the call stack empty between each one.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'Predict the order of all five log lines — pay attention to which are synchronous, which are microtasks, and which is a macrotask.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'predict-and-step',
      title: 'Predict, then step through it',
      type: 'predict',
      instructions: 'Predict the order of the four log lines below. After submitting, use the Execution Trace panel\'s Prev/Next buttons to confirm exactly when each one actually moved from a queue onto the call stack.',
      runner: 'worker',
      submissionMode: 'answer',
      panels: ['trace'],
      sourceCode: ORDER_SNIPPET,
      initialCode: ORDER_SNIPPET,
      answerSchema: [
        { id: 'order', prompt: 'Predicted order (comma-separated numbers, e.g. "1,2,3,4")', type: 'text' },
      ],
      validate(answers, extra) {
        const actual = (extra.consoleLines ?? []).map((l) => extractLeadingNumber(l.text)).filter(Boolean);
        const predicted = (answers.order ?? '').split(/[,\s]+/).filter(Boolean);
        const len = Math.max(actual.length, predicted.length, 1);
        let matches = 0;
        for (let i = 0; i < len; i += 1) if (predicted[i] === actual[i]) matches += 1;
        const fraction = matches / len;
        return { passed: fraction === 1 && predicted.length === 4, score: { correctness: fraction }, feedback: [`Actual order: ${actual.join(', ') || '(run it first)'}`] };
      },
      hints: [
        'Both plain console.log calls (1 and 4) run synchronously, before anything scheduled — regardless of their position relative to the async calls in the source.',
        'Between the sync code finishing and the macrotask (2) running, the ENTIRE microtask queue drains — including the Promise.then callback (3).',
      ],
      solution: '1, 4, 3, 2 — sync code first (in source order), then the microtask queue drains completely (3), then the macrotask (2).',
      explanation: 'Lines 1 and 4 execute immediately as part of the synchronous top-level script. Line 3 (a Promise microtask) and line 2 (a setTimeout macrotask) are both merely SCHEDULED during that synchronous run. Once the synchronous script finishes, the event loop drains the entire microtask queue before touching the macrotask queue — so 3 always runs before 2, regardless of the fact that both look "ready immediately."',
    },
    {
      id: 'convert-to-async-await',
      title: 'Implement: convert to async/await',
      type: 'implement',
      instructions: 'The reference implementation (Code panel) uses a .then() chain. Implement the same behavior in loadUserProfile using async/await instead.',
      runner: 'worker',
      submissionMode: 'code',
      sourceCode: PROMISE_CHAIN_REFERENCE,
      initialCode: ASYNC_AWAIT_SKELETON,
      testScript: ASYNC_AWAIT_TEST_SCRIPT,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = !!runResult.returnValue?.logged;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'Logged the expected line.' : 'Expected console output was not found — check you awaited both the fetch and the .json() call.'] };
      },
      hints: [
        '`await` can replace each `.then()` step in turn: `const res = await fetch(...)`, then `const user = await res.json()`.',
        'Don\'t forget the function must still be declared `async` — `await` is only valid inside one.',
      ],
      solution: `async function loadUserProfile() {
  const res = await fetch('/api/user');
  const user = await res.json();
  console.log("Loaded user, mocked:", user.mocked);
  return user;
}`,
      explanation: 'async/await is syntax over the exact same Promise mechanism — `await expr` suspends the async function until `expr` settles, then resumes with its resolved value (or throws its rejection reason). It doesn\'t change WHEN things run relative to microtasks/macrotasks, only how the code reads.',
    },
    {
      id: 'fix-search-race',
      title: 'Modify: fix the stale-response race condition',
      type: 'modify',
      instructions: 'Two searches fire in quick succession. The first ("a") is slow; the second ("ab") is fast and represents what the user actually wants displayed. Right now the slow, stale response overwrites the fast, current one when it finally arrives. Fix it so the most RECENTLY STARTED search always wins, regardless of which resolves first.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: RACE_BUGGY,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const lines = (runResult.consoleHistory ?? []).map((l) => l.text);
        const displays = lines.filter((l) => l.startsWith('Displaying results for:'));
        const lastDisplay = displays[displays.length - 1];
        const passed = lastDisplay === 'Displaying results for: ab';
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [`Console output: ${lines.join(' | ') || '(nothing)'}`] };
      },
      hints: [
        'The bug isn\'t about ordering the promises differently — it\'s that the `.then()` callback has no way to know whether a NEWER search has started since it began.',
        'Give each call to `search` a unique, increasing request id. In the `.then()` callback, only apply the result if its request id still matches the latest one issued.',
      ],
      solution: `let latestResult = null;
let latestRequestId = 0;

function search(query, delayMs) {
  const requestId = ++latestRequestId;
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve(query);
    }, delayMs);
  }).then(function (result) {
    if (requestId === latestRequestId) {
      latestResult = result;
      console.log("Displaying results for:", latestResult);
    } else {
      console.log("Discarding stale result for:", result);
    }
  });
}

search("a", 30);
search("ab", 5);`,
      explanation: 'This is a classic out-of-order-resolution race: nothing guarantees async operations resolve in the order they started. Tagging each request with a monotonically increasing id, captured at request time and checked at resolution time, is the standard fix — it\'s the same shape as an AbortController-based cancellation, just without actually aborting the in-flight request.',
    },
    {
      id: 'predict-long-task-delay',
      title: 'Predict: does the 0ms timer really fire at 0ms?',
      type: 'predict',
      instructions: 'Run this code and observe which line logs first. Then answer why.',
      runner: 'worker',
      submissionMode: 'answer',
      sourceCode: LONG_TASK_SNIPPET,
      initialCode: LONG_TASK_SNIPPET,
      answerSchema: [
        { id: 'order', prompt: 'Which logs first?', type: 'select', options: ['"timer fired" logs first', '"loop finished, sum = ..." logs first', 'They always log at exactly the same instant'] },
        { id: 'why', prompt: 'Why, precisely?', type: 'text' },
      ],
      validate(answers) {
        const correct = answers.order === '"loop finished, sum = ..." logs first';
        const why = (answers.why ?? '').toLowerCase();
        const explained = ['main thread', 'single thread', 'blocked', 'busy', 'call stack', 'synchronous'].some((k) => why.includes(k));
        const score = (correct ? 0.6 : 0) + (explained ? 0.4 : 0);
        return { passed: correct && explained, score: { correctness: score }, feedback: [] };
      },
      hints: [
        'A timer callback is a macrotask — it can only run once the call stack is completely empty. Is the call stack empty while the for-loop is running?',
        'setTimeout\'s delay is a MINIMUM wait before the callback becomes eligible to run — not a guarantee it runs at exactly that time. If the main thread is busy, the callback simply waits its turn.',
      ],
      solution: '"loop finished, sum = ..." logs first. The synchronous for-loop occupies the single call stack for its entire duration; the timer callback (a macrotask) cannot run until that stack is empty, no matter how long the loop takes or how short the requested delay was.',
      explanation: 'JavaScript has one call stack. A long synchronous operation blocks EVERYTHING else — timers, DOM events, rendering, network callback processing — because none of those can run until the currently-executing synchronous code finishes and the stack empties. This is exactly what "long task" means in browser performance terminology, and exactly why expensive synchronous work in instrumentation code is a user-facing problem, not just a performance nitpick.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-not-js-language', question: 'Is the event loop part of the JavaScript language (ECMAScript)? If not, what defines it?', modelAnswer: 'No — ECMAScript defines synchronous execution and (partially) the microtask/Job queue mechanism behind Promises, but the event loop itself, task scheduling, setTimeout, and the DOM are all defined by the host environment: the HTML Standard for browsers, or Node.js\'s own event loop (built on libuv) outside the browser.', skillTag: 'asyncEventLoop' },
    { id: 'kc-why-micro-first', question: 'Why do microtasks always run before the next macrotask, even if the macrotask was "ready" first?', modelAnswer: 'The event loop\'s model is: run one task, then drain the entire microtask queue completely (including any new microtasks scheduled by microtasks that just ran), and only then move to the next task. This ordering is unconditional — it doesn\'t matter which was "ready" first in wall-clock terms, only that the microtask queue is checked and fully emptied between every single task.', skillTag: 'asyncEventLoop' },
    { id: 'kc-blocking', question: 'Why can a long synchronous loop delay a setTimeout callback that was scheduled with a 0ms delay?', modelAnswer: 'setTimeout\'s delay is a minimum, not a guarantee — the callback only becomes eligible to run once the call stack is empty. JavaScript has a single call stack, so a long synchronous operation (like a big loop) keeps that stack occupied for its entire duration, and the timer callback simply has to wait until it\'s done, regardless of the requested delay.', skillTag: 'performance' },
  ],

  interviewQuestions: [
    'Is the event loop part of the JavaScript language itself? Explain precisely what is and isn\'t defined by ECMAScript here.',
    'Walk through the exact order of execution for a mix of synchronous code, a setTimeout, and a Promise.then, and explain why that order is guaranteed.',
    'How would you detect and fix a race condition where two async operations can resolve out of order and the wrong one wins?',
  ],
};
