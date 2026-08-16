const MEASURE_SKELETON = `function expensiveWork() {
  var sum = 0;
  for (var i = 0; i < 5000000; i++) sum += i;
  return sum;
}

// Measure how long expensiveWork() actually takes using performance.now(), and log
// exactly: "expensiveWork took " + ms + "ms"
`;
const MEASURE_TEST = `(function () {
  var line = __consoleHistory.map(function (e) { return e.text; }).find(function (t) { return /^expensiveWork took [\\d.]+ms$/.test(t); });
  __report({ found: !!line, line: line });
})();
`;

const LEAK_SITE = `<div class="card"><button id="btn">Action</button></div>`;
const LEAK_BUGGY = `function attachHandler(el) {
  el.addEventListener('click', function () {
    console.log('handler fired');
  });
}
`;
const LEAK_TEST = `(function () {
  var btn = document.getElementById('btn');
  attachHandler(btn);
  attachHandler(btn);
  attachHandler(btn);
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  var fires = __consoleHistory.filter(function (e) { return e.text === 'handler fired'; }).length;
  __report({ fires: fires });
})();
`;

const SAFE_SITE = `<div class="card">Checkout</div>`;
const SAFE_SETUP = `window.submitOrder = function (orderData) {
  console.log('Order submitted:', orderData.id);
  return true;
};
`;
const SAFE_BUGGY = `var originalSubmitOrder = window.submitOrder;
window.submitOrder = function (orderData) {
  var parsed = JSON.parse(orderData.metadata);
  console.log('Order metadata:', parsed);
  return originalSubmitOrder(orderData);
};
`;
const SAFE_TEST = `(function () {
  var results = {};
  try {
    var r = window.submitOrder({ id: 'ORDER-1', metadata: 'not-valid-json{{{' });
    results.orderSubmitted = r === true;
  } catch (e) {
    results.orderSubmitted = false;
    results.threw = true;
  }
  __report(results);
})();
`;

const EXAMPLE_CODE = `var start = performance.now();

var sum = 0;
for (var i = 0; i < 2000000; i++) sum += i;

var elapsed = performance.now() - start;
console.log("Loop took " + elapsed.toFixed(2) + "ms, sum =", sum);
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'instrumentation-performance',
  moduleId: 'performance-and-reliability',
  title: 'Measuring and Reducing Instrumentation Overhead',
  estimatedMinutes: 30,
  difficulty: 'advanced',
  prerequisites: ['wrapping-fetch-safely'],
  relatedMissionIds: ['security-at-200ms'],
  skillTags: ['performance', 'productionReliability'],

  whyItMatters: {
    development: 'Any code that runs on every event, every mutation, or every network call has to be cheap — "correct but slow" is not actually correct in a hot path, it\'s a different bug.',
    security: 'A security control that visibly degrades the site it protects gets rolled back, regardless of how good its detection is — performance is a hard requirement for a runtime control to survive contact with production, not a nice-to-have.',
    sourceDefense: 'You will be expected to measure overhead precisely (not guess), reduce it without silently losing detection, and make sure your own instrumentation can never be the thing that breaks the page — this lesson is exactly those three skills.',
  },

  mentalModel: {
    coreIdea: 'A security control that makes the page measurably slower gets rolled back, no matter how good its detection is — which makes "is this fast enough" a survival requirement for a runtime control, not a nice-to-have. Answering it means actually measuring, with a tool built for the job, under realistic conditions — never guessing, and never trusting a synthetic best case.',
    explanation: '`performance.now()` returns a high-resolution timestamp (milliseconds, sub-millisecond precision) that only ever moves forward, unaffected by system clock adjustments — the correct tool for measuring elapsed time, as opposed to `Date.now()`, which is lower-resolution and can jump if the system clock changes. Measuring overhead means timestamping immediately before and after the code in question and taking the difference — deceptively simple, but only meaningful if you\'re measuring the actual hot path under realistic conditions, not a synthetic best case. Reliability, separately, means your instrumentation must never become a new source of site breakage: any exception thrown inside a monitor has to be caught locally and must never prevent the real underlying functionality from still running.',
    distinctions: [
      { label: 'Browser-provided', text: 'The Performance API (`performance.now()`, marks, measures) is a browser-provided Web API, not part of ECMAScript — a plain JS engine embedded outside a browser/Node context has no inherent concept of wall-clock timing at all.' },
      { label: 'Simplified model', text: '"Just wrap it in try/catch" is necessary but not sufficient for reliability — the catch block itself must not swallow the ORIGINAL function\'s own legitimate errors; only the instrumentation\'s own risky work should be shielded, and the real underlying call still needs to happen (or its own errors still need to propagate normally) either way.' },
      { label: 'Implementation detail', text: 'The precision `performance.now()` actually reports can be intentionally reduced by some browsers (timing-attack mitigation, e.g. against Spectre-class attacks) — treat measured values as accurate to the browser\'s stated resolution, not as infinitely precise.' },
    ],
    snippet: `// UNSAFE: an exception here blocks the real function from ever running
function unsafeWrap(real) {
  return function (arg) {
    logSuspiciousActivity(arg); // if this throws, "real" below never executes
    return real(arg);
  };
}

// SAFE: the real function always runs, regardless of monitoring failures
function safeWrap(real) {
  return function (arg) {
    try { logSuspiciousActivity(arg); } catch (e) { /* monitoring failed, not the page */ }
    return real(arg);
  };
}`,
  },

  nuance: 'A single performance.now() before/after measurement can be misleading depending on WHAT you\'re measuring. A function\'s first few calls run before the JS engine\'s JIT compiler has had a chance to optimize it, so a one-shot measurement of a hot-path function — one that will run thousands of times during a real session, like a fetch wrapper or an event listener — can look several times slower than its true steady-state cost, because you measured the cold, unoptimized version. The fix for hot-path code is measuring across many iterations and looking at a representative sample, not the first or best-case run. The opposite applies to code that genuinely only runs once, like a one-time initialization hook: there, the cold-start cost IS the real cost, since there is no steady state to reach. Knowing which kind of code you\'re measuring changes what "representative" even means.',

  securityAngle: 'Overhead isn\'t only a user-experience problem — it can be an attack surface in its own right. If a monitor\'s cost scales with something an attacker influences — say, it re-scans the entire DOM on every mutation, or does an expensive comparison against attacker-controlled input — a script can deliberately trigger the monitor\'s expensive path repeatedly (many rapid DOM mutations, unusually large form inputs, deeply nested structures) to degrade the page\'s responsiveness, or in the worst case get the monitor itself blamed for a slowdown a different, legitimate script is actually causing. This is a real reason to measure instrumentation under adversarial as well as typical conditions: "fast enough for normal usage" and "fast enough when someone is actively trying to make it slow" are different bars, and only the second one holds up against a script that has a reason to make your control look expensive.',

  runtimeSecurityAngle: 'Reducing instrumentation overhead without losing detection usually means choosing a specific, named tradeoff, rather than making the existing check faster in place. Sampling — checking, say, 1 in 20 events instead of every one — cuts cost roughly proportionally but can miss a real incident that happened to fall in the unsampled 19. Debouncing/batching (accumulating events and processing them together every N milliseconds, rather than synchronously on each one) reduces how often the expensive logic runs, at the cost of detection latency — an attack is still caught, just slightly later, which matters if the response is "block this" rather than "log this for later review." Moving expensive analysis off the main thread, into a Worker, doesn\'t reduce total work, but stops it from competing with rendering and user interaction for the same thread, which is often what "feels slow" is actually measuring. Each of these is a legitimate choice with a stated cost — the failure mode to avoid is making one of these tradeoffs implicitly, without anyone deciding it was acceptable to sample, delay, or offload detection.',

  keyTakeaways: [
    'performance.now() is monotonic and high-resolution — the correct tool for measuring elapsed time, unlike Date.now(), which can jump with system clock changes.',
    'A cold, first-call, pre-JIT measurement of hot-path code can overstate its real steady-state cost by several times — measure representative repeated calls, not a single first run, for anything that runs often.',
    'Failing safely means only the monitoring\'s own risky work is wrapped in try/catch — the real underlying function must still run, or its own errors still propagate, regardless of what happens in the monitor.',
    'Overhead can itself be an attack surface: if a monitor\'s cost scales with attacker-influenced input, a script can deliberately trigger its expensive path to degrade the page or get the monitor blamed.',
    'Reducing overhead without losing detection means choosing a named, deliberate tradeoff — sampling, debouncing/batching, or offloading to a Worker — each with an honest, stated cost, never silently doing less work.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'Predict roughly what the logged elapsed time will be — not an exact number, but is it closer to 0ms, a few ms, or hundreds of ms?',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'measure-overhead',
      title: 'Implement: measure real overhead',
      type: 'implement',
      instructions: 'Time expensiveWork() using performance.now() and log the result in the exact format requested.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: MEASURE_SKELETON,
      testScript: MEASURE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        return { passed: !!r.found, score: { correctness: r.found ? 1 : 0 }, feedback: [r.found ? `Logged: "${r.line}"` : 'No matching log line found — check the exact format requested.'] };
      },
      hints: [
        '`performance.now()` called before and after the work gives you two timestamps; subtract them for the elapsed milliseconds.',
        'Template: `var start = performance.now(); expensiveWork(); var ms = performance.now() - start; console.log("expensiveWork took " + ms + "ms");`',
      ],
      solution: `function expensiveWork() {
  var sum = 0;
  for (var i = 0; i < 5000000; i++) sum += i;
  return sum;
}

var start = performance.now();
expensiveWork();
var ms = performance.now() - start;
console.log("expensiveWork took " + ms + "ms");`,
      explanation: 'This is the entire foundation of measurement-driven optimization: you cannot responsibly claim something got "faster" (or decide it needs to) without a real before/after number from the actual code path, taken with a tool built for the job.',
    },
    {
      id: 'fix-listener-leak',
      title: 'Modify: fix an accumulating listener leak',
      type: 'modify',
      instructions: 'attachHandler gets called multiple times on the same element (e.g. on every re-render). Right now each call adds ANOTHER listener instead of replacing the old one — fix it so only one handler ever fires.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: LEAK_SITE,
      initialCode: LEAK_BUGGY,
      testScript: LEAK_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const fires = runResult.returnValue?.fires;
        const passed = fires === 1;
        return { passed, score: { correctness: passed ? 1 : 0, performance: passed ? 1 : 0 }, feedback: [`Handler fired ${fires} time(s) after 3 calls to attachHandler (expected 1).`] };
      },
      hints: [
        'Each call to `attachHandler` creates a brand NEW anonymous function and adds it — `addEventListener` has no way to know it\'s "the same" handler as last time, so nothing gets replaced, only added to.',
        'Store the listener function reference on the element itself (e.g. `el.__clickHandler`), and call `removeEventListener` with that stored reference before adding a new one.',
      ],
      solution: `function attachHandler(el) {
  if (el.__clickHandler) {
    el.removeEventListener('click', el.__clickHandler);
  }
  el.__clickHandler = function () {
    console.log('handler fired');
  };
  el.addEventListener('click', el.__clickHandler);
}`,
      explanation: 'Every accumulated stale listener is both a correctness bug (the same event now triggers duplicate work) and a memory leak (each listener closure, and anything IT references, stays alive as long as the element does) — exactly the kind of gradual degradation that turns into "the page feels slower after being open a while."',
    },
    {
      id: 'fail-safely',
      title: 'Defend: a monitor exception must not break checkout',
      type: 'defend',
      instructions: 'The monitor below tries to parse order metadata as JSON — and throws on malformed input, which currently prevents the REAL submitOrder from ever running. Fix it so a parsing failure inside the monitor never blocks the actual checkout.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: SAFE_SITE,
      setupScript: SAFE_SETUP,
      initialCode: SAFE_BUGGY,
      testScript: SAFE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0, compatibility: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.orderSubmitted;
        return { passed, score: { compatibility: passed ? 1 : 0 }, feedback: [passed ? 'Checkout still completed despite the malformed metadata.' : 'Checkout failed — the monitor\'s own exception broke real functionality.'] };
      },
      hints: [
        'The `JSON.parse` call throws on malformed input, and nothing catches it — the exception propagates out of the wrapper entirely, and `originalSubmitOrder(orderData)` (on the next line) never even executes.',
        'Wrap ONLY the risky monitoring work in try/catch — the call to `originalSubmitOrder` must still happen either way, whether or not the monitoring succeeded.',
      ],
      solution: `var originalSubmitOrder = window.submitOrder;
window.submitOrder = function (orderData) {
  try {
    var parsed = JSON.parse(orderData.metadata);
    console.log('Order metadata:', parsed);
  } catch (e) {
    console.log('Monitor failed to parse metadata, continuing anyway:', e.message);
  }
  return originalSubmitOrder(orderData);
};`,
      explanation: 'The fix isn\'t "never let anything throw" — it\'s that the REAL underlying functionality must be unconditionally preserved regardless of what happens in the monitoring code wrapped around it. A security/observability layer that can take down checkout because of its OWN bug is a worse outcome than not having that layer at all.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-why-performance-now', question: 'Why is performance.now() the right tool for measuring elapsed time instead of Date.now() or new Date()?', modelAnswer: 'performance.now() is high-resolution and monotonic — it only ever increases and is unaffected by system clock changes (NTP adjustments, manual clock changes, DST), which can make Date.now()-based measurements wrong or even negative across a clock adjustment. It exists specifically for measuring elapsed durations, not wall-clock time.', skillTag: 'performance' },
    { id: 'kc-fail-safe', question: 'What specifically distinguishes "failing safely" from just wrapping everything in a blanket try/catch?', modelAnswer: 'Failing safely means the underlying REAL functionality is preserved no matter what happens in the instrumentation/monitoring code — the try/catch has to be scoped around the monitoring\'s own risky work specifically, while the call to the real original function still happens unconditionally (or its own legitimate errors still propagate normally). A blanket try/catch around everything, including the real function call, risks silently swallowing genuine application errors too, which is a different and also-bad outcome.', skillTag: 'productionReliability' },
    { id: 'kc-long-tasks', question: 'Besides manually timestamping with performance.now(), how could you detect that your instrumentation is causing long tasks in PRODUCTION, across real users, without adding your own timing calls everywhere?', modelAnswer: 'The Long Tasks API — `new PerformanceObserver(callback).observe({ entryTypes: ["longtask"] })` — reports any task that occupies the main thread for 50ms or longer, along with attribution data about what triggered it, without needing to manually wrap every code path in timing calls. Manual performance.now() measurement is precise for a single code path you already suspect; a Long Tasks observer is how you catch problems across the whole page, in real user sessions, including paths you didn\'t think to instrument by hand.', skillTag: 'performance' },
  ],

  interviewQuestions: [
    'How would you measure the actual overhead a new security control adds to a real page, and what tool would you use?',
    'A monitoring wrapper throws when it encounters unexpected input. What\'s the correct way to handle that, and what\'s the wrong way?',
    'Explain how repeatedly attaching listeners without removing old ones causes both a correctness bug and a memory leak.',
  ],
};
