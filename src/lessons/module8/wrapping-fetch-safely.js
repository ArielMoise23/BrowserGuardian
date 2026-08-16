const LISTENER_SITE = `<div class="card"><button id="btn">Click</button></div>`;
const LISTENER_SKELETON = `// Wrap EventTarget.prototype.addEventListener so every registration logs:
// "listener registered: " + type + " on " + this.tagName
// while preserving normal behavior — the listener must still actually fire.
`;
const LISTENER_TEST = `(function () {
  var results = {};
  var btn = document.getElementById('btn');
  var fired = false;
  btn.addEventListener('click', function () { fired = true; });
  results.logged = __consoleHistory.some(function (e) { return /listener registered/i.test(e.text); });
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  results.stillFires = fired;
  __report(results);
})();
`;

const BEACON_SITE = `<div class="card">Checkout complete.</div>`;
const BEACON_SKELETON = `// Wrap navigator.sendBeacon so every call logs: "beacon sent to " + url
// while preserving its behavior exactly, including its return value.
`;
const BEACON_TEST = `(function () {
  var results = {};
  var ok = navigator.sendBeacon('https://analytics.mystore.example/complete', 'order=123');
  results.returnedTrue = ok === true;
  results.logged = __consoleHistory.some(function (e) { return /beacon sent to/i.test(e.text); });
  __report(results);
})();
`;

const FIELD_SITE = `<div class="card"><label for="card">Card number</label><input id="card" value="4111111111111111" /></div>`;
const FIELD_SKELETON = `// Instrument #card's "value" property (on the INSTANCE, not the whole prototype)
// so reading it calls __securityAlert('medium', 'card field read', 'field-monitor'),
// but still returns the real value, and setting it still works normally.
var card = document.getElementById('card');
`;
const FIELD_TEST = `(function () {
  var results = {};
  var card = document.getElementById('card');
  var v = card.value;
  results.valueStillCorrect = v === '4111111111111111';
  results.alertFired = __securityAlertsLog.some(function (a) { return /card field read/i.test(a.message); });
  card.value = '4111111111111112';
  results.setStillWorks = card.value === '4111111111111112';
  __report(results);
})();
`;

const RECURSION_BUGGY = `var originalFetch = fetch;
self.fetch = function (url, options) {
  fetch('/telemetry');
  return originalFetch(url, options);
};
`;
const RECURSION_TEST = `(async function () {
  var results = {};
  try {
    await fetch('/api/ok');
    results.threw = false;
  } catch (e) {
    results.threw = true;
    results.errorName = e.name;
  }
  __report(results);
})();
`;

const EXAMPLE_CODE = `var originalLog = console.log;
console.log = function () {
  var args = Array.prototype.slice.call(arguments);
  originalLog.apply(console, ['[instrumented]'].concat(args));
};

console.log("hello");
console.log("world");
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'wrapping-fetch-safely',
  moduleId: 'runtime-security-instrumentation',
  title: 'Safely Wrapping Native APIs',
  estimatedMinutes: 30,
  difficulty: 'advanced',
  prerequisites: ['execution-contexts-scope-chains'],
  relatedMissionIds: ['wrap-fetch-without-breaking-it'],
  skillTags: ['runtimeInstrumentation', 'productionReliability'],

  explanation: [
    'Wrapping a native function safely is like intercepting a phone call: you pick up first (capture the real implementation before anyone else can), do your own work, then place the same call through with the exact same message, and hand back exactly what came back, unchanged. Nearly every real bug in this pattern comes from skipping one of those four steps, not from anything exotic.',
    'The safe wrapping shape is always the same: capture a reference to the real, native implementation before anything else can tamper with it; define a replacement that does the observation or policy work; call the captured reference, forwarding the exact same arguments and `this`; return, or re-throw for the error path, exactly what the native call produced. Skipping the first step means the wrapper might capture an already-tampered reference; skipping exact forwarding can break callers relying on the receiver or arguments; returning something other than the native result — the single most common mistake — silently breaks a real feature for every caller.',
    'Before patching any property, check whether it can even be patched: `Object.getOwnPropertyDescriptor(target, name).configurable` tells you up front, and reassigning a non-configurable property throws a `TypeError` in strict mode, or silently no-ops in sloppy mode, which is worse — the patch appears to succeed while doing nothing. Some built-ins are non-configurable by spec; others are made non-configurable deliberately by earlier code, including other instrumentation that froze what it patched to stop anyone else from unwrapping it. Production code checks `configurable`/`writable` before patching, with a defined fallback, rather than letting the patch attempt itself crash the page.',
    'The exact four-step pattern taught here for defensive monitoring is indistinguishable, at the code level, from how a malicious script wraps `fetch` to intercept every request a page makes while every caller keeps working exactly as before — "the page still works" is not a security signal, since a well-written malicious wrapper preserves full compatibility by design. Detecting whether an API has already been tampered with needs a different signal: `fetch.toString()` on a pristine native function returns `"function fetch() { [native code] }"`, while an ordinary JavaScript wrapper\'s `.toString()` returns its real source — a real, if gameable, check, since a careful malicious wrapper can override `Function.prototype.toString` itself to fake that marker. Neither side gets a permanent win, which is why realistic runtime security leans on behavioral signals alongside static ones, not any single check.',
  ],

  distinctions: [
    { label: 'ECMAScript spec', text: 'Function.prototype.call/.apply and property reassignment are ordinary language features — nothing about monkey-patching a global function requires anything beyond standard ECMAScript.' },
    { label: 'Simplified model', text: '"Just wrap the function and log before/after" undersells the difficulty — matching the original function\'s argument-forwarding, receiver, return type, and error behavior exactly is where nearly every real bug lives.' },
    { label: 'Implementation detail', text: 'Whether a specific native API\'s properties are configurable can vary by browser and by API — some refuse redefinition entirely, which production instrumentation has to detect and handle rather than assume away.' },
  ],

  tldr: [
    'The safe-wrapping shape is four steps — capture the pristine reference first, observe, forward arguments/this exactly, return the unchanged result — skipping any one breaks something specific.',
    'Check configurable/writable before patching a property — some are non-configurable by spec, others may already be frozen by earlier code, including other instrumentation.',
    'A perfectly behaving wrapper and a malicious one look identical from the outside — "the page still works" is not a security signal.',
    'fn.toString() returning "[native code]" is a real, gameable signal for whether a function is pristine — malicious code can override Function.prototype.toString to fake it.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'console.log itself gets wrapped here. Predict exactly what ends up printed to the real console for the two calls at the bottom.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'wrap-add-event-listener',
      title: 'Implement: wrap addEventListener',
      type: 'implement',
      instructions: 'Log every listener registration without breaking the listener itself.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: LISTENER_SITE,
      initialCode: LISTENER_SKELETON,
      testScript: LISTENER_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.logged && !!r.stillFires;
        return { passed, score: { correctness: r.logged ? 1 : 0, compatibility: r.stillFires ? 1 : 0 }, feedback: [r.logged ? 'Registration was logged.' : 'No log found.', r.stillFires ? 'The listener still fires normally.' : 'The listener no longer fires — compatibility broken.'] };
      },
      hints: [
        '`EventTarget.prototype.addEventListener` is the one function every element inherits — patch it once, on the prototype, to cover every element.',
        'Inside your replacement, call the captured original via `.call(this, type, listener, options)` — `this` matters here, since it\'s whichever element addEventListener was called on.',
      ],
      solution: `var originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, listener, options) {
  console.log('listener registered: ' + type + ' on ' + (this.tagName || 'unknown'));
  return originalAddEventListener.call(this, type, listener, options);
};`,
      explanation: 'Patching `EventTarget.prototype` (rather than individual elements) instruments every current AND future element in one place — exactly the leverage point real instrumentation wants. Forwarding via `.call(this, ...)` preserves which element the listener actually attaches to; without it, every listener would attach to the wrong target.',
    },
    {
      id: 'wrap-send-beacon',
      title: 'Implement: monitor sendBeacon',
      type: 'implement',
      instructions: 'Log every sendBeacon call and its destination, preserving its exact return value.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: BEACON_SITE,
      initialCode: BEACON_SKELETON,
      testScript: BEACON_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.logged && !!r.returnedTrue;
        return { passed, score: { correctness: r.logged ? 1 : 0, compatibility: r.returnedTrue ? 1 : 0 }, feedback: [r.logged ? 'Call was logged.' : 'No log found.', r.returnedTrue ? 'Return value preserved.' : 'Return value was not correctly forwarded.'] };
      },
      hints: [
        'Unlike fetch, sendBeacon is fully synchronous — it returns a boolean immediately, no Promise involved. The wrapper needs to return that same boolean.',
        'Capture `navigator.sendBeacon` before reassigning it, and remember to call it with `navigator` as the receiver (`.call(navigator, url, data)`) — some implementations require the correct receiver.',
      ],
      solution: `var originalSendBeacon = navigator.sendBeacon;
navigator.sendBeacon = function (url, data) {
  console.log('beacon sent to ' + url);
  return originalSendBeacon.call(navigator, url, data);
};`,
      explanation: 'sendBeacon\'s synchronous boolean return is a meaningfully different shape from fetch\'s Promise — code elsewhere may check that return value to decide whether to fall back to another method, so silently dropping it (not returning anything from the wrapper) would be a real, if easy-to-miss, compatibility break.',
    },
    {
      id: 'detect-sensitive-read',
      title: 'Implement: detect a sensitive-field read',
      type: 'implement',
      instructions: 'Instrument the card field so reading its value raises a security alert, without changing what any code that reads or writes it observes.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: FIELD_SITE,
      initialCode: FIELD_SKELETON,
      testScript: FIELD_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.valueStillCorrect && !!r.alertFired && !!r.setStillWorks;
        return {
          passed,
          score: { correctness: r.alertFired ? 1 : 0, compatibility: (r.valueStillCorrect && r.setStillWorks) ? 1 : 0 },
          feedback: [
            r.alertFired ? 'Alert raised on read.' : 'No alert raised.',
            r.valueStillCorrect ? 'Read value still correct.' : 'Read value was wrong or missing.',
            r.setStillWorks ? 'Writing the field still works.' : 'Writing the field broke.',
          ],
        };
      },
      hints: [
        '`value` on an `<input>` is an accessor property defined on `HTMLInputElement.prototype`. Capture its descriptor with `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")` before overriding anything.',
        'Define your own getter/setter on the ELEMENT ITSELF (not the prototype) via `Object.defineProperty(card, "value", {...})` — this shadows the prototype\'s accessor for just this one input, calling through to the original descriptor\'s get/set via `.call(this)` to preserve real behavior.',
      ],
      solution: `var card = document.getElementById('card');
var original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
Object.defineProperty(card, 'value', {
  configurable: true,
  get: function () {
    __securityAlert('medium', 'card field read', 'field-monitor');
    return original.get.call(this);
  },
  set: function (v) {
    return original.set.call(this, v);
  },
});`,
      explanation: 'Overriding the property on the specific ELEMENT (an "own property" that shadows the prototype\'s accessor via the prototype chain) means only this one field is monitored, not every input on the page — a meaningfully different, more targeted technique than patching a shared prototype method, appropriate when you only care about specific, known-sensitive fields.',
    },
    {
      id: 'fix-telemetry-recursion',
      title: 'Modify: fix infinite recursion in telemetry',
      type: 'modify',
      instructions: 'This wrapper sends its own telemetry via a nested fetch call — which re-triggers the SAME wrapper, forever. Fix the infinite recursion without losing the telemetry.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: RECURSION_BUGGY,
      testScript: RECURSION_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = r.threw === false;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'No longer recurses.' : `Still throws${r.errorName ? ` (${r.errorName})` : ''} — likely still recursing.`] };
      },
      hints: [
        'The wrapper calls plain `fetch(...)` for its own telemetry — but `fetch` now refers to the WRAPPER itself (that\'s what `self.fetch = ...` just did), so this call re-enters the wrapper, which calls `fetch` again, forever.',
        'Use the captured `originalFetch` reference for the telemetry call too — not the global `fetch` name, which now points at your own wrapper.',
      ],
      solution: `var originalFetch = fetch;
self.fetch = function (url, options) {
  originalFetch('/telemetry?url=' + encodeURIComponent(url));
  return originalFetch(url, options);
};`,
      explanation: 'Any internal work instrumentation does for ITSELF — logging, telemetry, policy checks — has to go through the pristine native reference, never through the (now-wrapped) global name. This is the exact same discipline as forwarding a caller\'s request, just applied to calls the instrumentation code makes on its own behalf.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-four-steps', question: 'List the four steps of the safe-wrapping pattern this lesson used repeatedly, and name what breaks if you skip each one.', modelAnswer: '(1) Capture a pristine reference before anything else runs — skip this and you might wrap an already-tampered function. (2) Define a replacement that does your observation work. (3) Call the captured original, forwarding arguments and `this` exactly — skip this and callers relying on the receiver or exact arguments break. (4) Return (or rethrow) the original\'s result unchanged — skip this and you silently change the function\'s contract for every caller.', skillTag: 'runtimeInstrumentation' },
    { id: 'kc-instance-vs-prototype', question: 'When would you instrument a single DOM element\'s property directly instead of patching the shared prototype method?', modelAnswer: 'When you only care about a specific, known element (like one particular sensitive input) and want to avoid the overhead and blast radius of instrumenting every element of that type on the page. Instance-level overriding is narrower and cheaper but has to be applied to each element individually (including ones added later), whereas a prototype patch automatically covers every current and future instance with one change.', skillTag: 'runtimeInstrumentation' },
    { id: 'kc-proxy-vs-patch', question: 'Every lab in this lesson used direct property/prototype reassignment. When would you reach for a `Proxy` instead, and what does it cost you?', modelAnswer: 'A `Proxy` wraps an entire object behind traps (get/set/has/deleteProperty/apply, etc.), so it can intercept access to properties you don\'t know about in advance — useful for a generic "watch everything on this object" monitor, where enumerating and patching each property individually would be impractical or incomplete. The cost: `new Proxy(target, handler)` produces a genuinely different object — `proxy !== target` — so any code that does identity checks, or that received a reference to the original object before the proxy was substituted in, silently bypasses it. Direct patching (reassigning `obj.method = wrapper`) keeps the original object\'s identity intact, which is why it was the right tool for the single, known, named functions this lesson\'s labs targeted (fetch, sendBeacon, addEventListener) — a Proxy earns its cost when the surface you need to cover is broad or not fully known ahead of time.', skillTag: 'runtimeInstrumentation' },
  ],

  interviewQuestions: [
    'Walk through the four-step pattern for safely wrapping a native function, and what specifically breaks if you skip each step.',
    'Why must instrumentation code use a captured native reference for its OWN internal work, not just for forwarding caller requests?',
    'When would you reach for a Proxy instead of directly reassigning a method, and what identity problem does a Proxy introduce?',
  ],
};
