const INITIAL_CODE = `const originalFetch = fetch;

function secureFetch(url, options) {
  console.log("Outbound fetch: " + url);
  originalFetch(url, options);
}

self.fetch = secureFetch;
`;

const TEST_SCRIPT = `(async function () {
  const results = {};

  try {
    const res = await fetch('/api/ok', { method: 'GET' });
    results.resolvesWithResponse = !!res && typeof res.status === 'number' && res.status === 200;
  } catch (e) {
    results.resolvesWithResponse = false;
  }

  const before = __mockFetchCalls.length;
  try {
    await fetch('/api/echo', { method: 'POST', headers: { 'X-Test': '1' } });
  } catch (e) {
    // A broken wrapper might throw or reject here — we only care whether the
    // underlying mock still got invoked with the right arguments below.
  }
  const call = __mockFetchCalls[__mockFetchCalls.length - 1];
  results.calledUnderlyingFetch = __mockFetchCalls.length > before;
  results.forwardedArgs = !!call && call.url === '/api/echo' && !!call.init && call.init.method === 'POST';

  let rejected = false;
  try {
    await fetch('/api/fail');
  } catch (e) {
    rejected = true;
  }
  results.propagatesRejection = rejected;

  results.logged = __consoleHistory.some(function (e) { return /fetch|request|outbound/i.test(e.text); });

  __report(results);
})();
`;

export default {
  id: 'wrap-fetch-without-breaking-it',
  chapter: 8,
  title: 'Wrap Fetch Without Breaking It',
  type: 'runtime-defense',
  difficulty: 'advanced',
  xp: 200,
  estimatedMinutes: 25,
  runner: 'worker',
  submissionMode: 'code',
  panels: [],
  editorLabel: 'secureFetch wrapper',

  objective: 'Implement a fetch() instrumentation wrapper that logs every outbound call while remaining perfectly transparent to every caller — same arguments forwarded, same return value, same resolve/reject behavior.',
  prerequisites: 'Comfort with Promises, and the idea that fetch() returns a Promise you must not swallow.',
  scenario: 'Security wants visibility into every outbound network call a page makes, so the plan is to wrap the global `fetch`. The first draft "works" in a quick manual test — but a broken wrapper here would silently break every feature on the site that depends on fetch resolving with real data, which is exactly the kind of regression that gets a security team\'s access revoked.',
  task: 'Fix secureFetch so it logs the call AND still behaves exactly like the original fetch to every caller — correct return value, correct forwarded arguments, and correct rejection behavior on failure.',
  expectedBehavior: 'Calling fetch(url, options) after installing secureFetch: (1) logs the outbound URL, (2) still calls the real fetch underneath with the exact same url/options, (3) returns a Promise that resolves with the real Response, and (4) still rejects when the underlying request fails.',

  initialCode: INITIAL_CODE,
  testScript: TEST_SCRIPT,

  validate(runResult) {
    if (runResult.error) return { passed: false, score: { correctness: 0, compatibility: 0 }, feedback: [`Error: ${runResult.error}`] };
    if (runResult.timedOut) return { passed: false, score: { correctness: 0, compatibility: 0 }, feedback: ['Execution timed out.'] };
    const r = runResult.returnValue ?? {};
    const compatChecks = [r.resolvesWithResponse, r.calledUnderlyingFetch, r.forwardedArgs, r.propagatesRejection];
    const compatibility = compatChecks.filter(Boolean).length / compatChecks.length;
    const correctness = r.logged ? 1 : 0;

    const feedback = [
      r.logged ? 'The call was logged.' : 'No log line matching the fetch call was found — did console.log run?',
      r.resolvesWithResponse ? 'fetch() still resolves with a real Response.' : 'fetch() did not resolve with a usable Response — check whether your wrapper returns the underlying call.',
      r.calledUnderlyingFetch ? 'The underlying fetch was actually invoked.' : 'The underlying fetch was never called.',
      r.forwardedArgs ? 'Arguments (url + options) were forwarded unchanged.' : 'The forwarded url/options didn\'t match what was passed in.',
      r.propagatesRejection ? 'Rejections still propagate correctly.' : 'A failing request did not reject the way the original fetch would have.',
    ];
    const passed = correctness === 1 && compatibility === 1;
    return { passed, score: { correctness, compatibility }, feedback };
  },

  hints: [
    'The wrapper calls `originalFetch(url, options)` but never does anything with the result — what happens to a Promise nobody returns or awaits?',
    'A caller doing `secureFetch(url).then(...)` needs secureFetch itself to return a Promise. If `secureFetch` doesn\'t `return` the call to `originalFetch`, it implicitly returns `undefined`, and `undefined.then` would throw.',
    'The fix is a single missing keyword: `return originalFetch(url, options);` — that one Promise IS the resolve/reject/Response passthrough all in one, because you\'re handing the caller the exact same Promise the real fetch produced.',
  ],

  solution: `const originalFetch = fetch;

function secureFetch(url, options) {
  console.log("Outbound fetch: " + url);
  return originalFetch(url, options);
}

self.fetch = secureFetch;`,

  explanation: 'The broken version calls `originalFetch(url, options)` but discards its result — the function implicitly returns `undefined`. Every caller expecting a Promise (`fetch(url).then(...)`, `await fetch(url)`) breaks immediately, and the failure looks nothing like a network problem — it looks like "fetch is undefined" or "cannot read property \'then\' of undefined," which is confusing to debug precisely because the actual network call DID go out correctly. The fix — `return originalFetch(url, options);` — is not just "add a return statement" incidentally; returning the exact Promise the native call produced is what makes the wrapper transparent: whatever that Promise resolves to, rejects with, or how long it takes, the caller sees the real thing, because it\'s literally the same Promise object, not a re-implementation of one.',

  commonWrongAnswers: [
    { description: 'Wrapping the call in a `new Promise((resolve) => { originalFetch(url, options).then(resolve); })` instead of just returning it.', why: 'This "works" for the success path but silently swallows rejections — a failing request will never call `resolve`, so the returned Promise hangs forever instead of rejecting, which is arguably worse than the original bug because it fails silently instead of loudly.' },
    { description: 'Using an arrow function for secureFetch and referencing `this.originalFetch` inside it.', why: 'Arrow functions don\'t have their own `this`, and even with a regular function, relying on `this` to reach the native reference is fragile — the captured `originalFetch` closure variable is the reliable way to reach the real implementation regardless of how secureFetch itself gets called or with what receiver.' },
  ],

  securityImpact: 'This is the exact bug class that gets a security team\'s runtime protection rolled back in production: a monitoring wrapper that technically "detects" everything but subtly breaks a Promise chain somewhere on the checkout page, causing real revenue-impacting failures that get blamed on "the new security thing," regardless of how good the actual detection logic is.',
  runtimeExplanation: 'Promises are values — returning `fetch(...)` from a function returns that exact pending/fulfilled/rejected Promise object, preserving its entire resolution behavior. There is no way to "manually" reconstruct equivalent behavior (recreating resolve/reject/timing/rejection reason) as reliably as simply returning the original Promise you already have.',
  sourceDefenseConnection: 'Almost every runtime instrumentation technique in this role — wrapping fetch, XHR, sendBeacon, DOM APIs — has this exact shape: capture a pristine reference, call it, observe/log around the call, and return its result untouched. Getting this pattern reflexively right (and knowing why) is foundational to every mission after this one.',
  followUp: 'Extend secureFetch so it also measures and logs how long the underlying fetch took (in milliseconds) — without adding a single millisecond of artificial delay to the returned Promise itself.',
  skillTags: ['runtimeInstrumentation', 'asyncEventLoop', 'productionReliability'],
};
