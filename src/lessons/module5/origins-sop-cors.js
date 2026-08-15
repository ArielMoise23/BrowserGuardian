const ORIGIN_OPTIONS = ['Same origin', 'Different origin, same site', 'Different origin, different site'];

const MESSAGE_SITE = `
<div class="card">
  <h3>Partner status widget</h3>
  <div id="status">(waiting for update)</div>
</div>
`;
const MESSAGE_BUGGY = `window.addEventListener('message', function (event) {
  console.log('Received command:', event.data.command);
  if (event.data.command === 'setStatus') {
    document.getElementById('status').textContent = event.data.value;
  }
});
`;
const MESSAGE_TEST = `(function () {
  var results = {};
  window.dispatchEvent(new MessageEvent('message', { origin: 'https://trusted-partner.example', data: { command: 'setStatus', value: 'Trusted update' } }));
  results.trustedApplied = document.getElementById('status').textContent === 'Trusted update';
  window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { command: 'setStatus', value: 'Attacker update' } }));
  results.untrustedBlocked = document.getElementById('status').textContent === 'Trusted update';
  __report(results);
})();
`;

const REALM_SITE = `<div class="card">This simulation is itself a sandboxed iframe — a real separate browsing context from the page you're reading this lesson in.</div>`;
const REALM_TEST = `(function () {
  var results = {};
  results.isNested = window.parent !== window;
  try {
    var doc = window.parent.document;
    results.accessedParentDocument = true;
  } catch (e) {
    results.accessedParentDocument = false;
    results.errorName = e.name;
  }
  __report(results);
})();
`;

const EXAMPLE_CODE = `// This code runs inside a sandboxed iframe with an opaque origin — a genuinely
// separate browsing context from the Guided Learning page around it.
console.log("window === window.top?", window === window.top);
console.log("window === window.parent?", window === window.parent);
try {
  console.log("Attempting to read window.parent.location.href...");
  console.log(window.parent.location.href);
} catch (e) {
  console.log("Blocked:", e.name, "-", e.message);
}
`;

export default {
  id: 'origins-sop-cors',
  moduleId: 'browser-architecture-security',
  title: 'Origins, Same-Origin Policy, and CORS',
  estimatedMinutes: 30,
  difficulty: 'core',
  prerequisites: [],
  relatedMissionIds: ['third-party-checkout'],
  skillTags: ['browserArchitecture', 'webSecurity'],

  whyItMatters: {
    development: 'CORS errors are one of the most common things developers hit and one of the least understood — most attempts to "fix" one make the actual security posture worse, not just quieter.',
    security: 'The origin is the fundamental unit of web security — nearly every browser-enforced isolation guarantee (what can read what, what can call what) is expressed in terms of same-origin vs. cross-origin, not in terms of anything JavaScript itself controls.',
    sourceDefense: 'Runtime protection has to work WITH these boundaries, not around them — knowing precisely which restrictions the browser itself guarantees (and which it doesn\'t) determines what\'s actually safe to rely on versus what still needs active monitoring.',
  },

  mentalModel: {
    coreIdea: 'Two URLs are either the same origin or they\'re not — scheme, host, and port must ALL match exactly, no exceptions and no partial credit. Almost everything the browser does to keep one website from reading or interfering with another — blocking DOM access, blocking response reads, scoping cookies — comes down to asking "is the accessing code\'s origin the same as the target\'s?" over and over, in different contexts. CORS doesn\'t change that boundary; it\'s a narrow, server-controlled exception a site can opt into for specific cross-origin reads.',
    explanation: 'An origin is exactly the triple {scheme, host, port} — https://shop.example.com and http://shop.example.com are different origins (scheme differs) even though the host is identical; https://shop.example.com and https://shop.example.com:8443 are different origins (port differs). "Site" is a coarser, different concept: the registrable domain (roughly, the part your organization actually owns, like example.com) plus scheme — so https://shop.example.com and https://blog.example.com are DIFFERENT origins but the SAME site. The Same-Origin Policy is the browser\'s default rule that script on one origin cannot read the DOM or most responses belonging to a different origin. CORS is a mechanism for a SERVER to opt back IN to allowing a specific cross-origin request\'s response to be read by script — it relaxes SOP for reads, on the server\'s explicit say-so; it is not a security feature that adds protection on its own.',
    distinctions: [
      { label: 'Browser-provided', text: 'Origins, the Same-Origin Policy, and CORS enforcement are entirely implemented and enforced by the browser at the network/DOM-access layer — no JavaScript code, however clever, can grant itself access SOP would otherwise deny.' },
      { label: 'Simplified model', text: '"CORS blocks cross-origin requests" is a common but inaccurate shorthand. Simple cross-origin requests are usually SENT — the server receives them either way — CORS specifically controls whether the RESPONSE is readable by the requesting page\'s JavaScript. A missing CORS header does not stop the request from happening; it stops the page from reading what came back.' },
      { label: 'Implementation detail', text: 'Exactly which request characteristics trigger a CORS preflight (an OPTIONS request sent first to ask permission) versus which count as "simple" and skip it is defined by the Fetch specification, but how a given browser batches/caches preflight results is an implementation/performance detail on top of that baseline.' },
    ],
    snippet: `// Same-origin fetch — reading the response is always allowed
fetch('/api/profile').then(function (r) { return r.json(); });

// Cross-origin fetch to a server with NO CORS header — the request is still
// SENT and the server still processes it; only reading the response HERE is blocked
fetch('https://other-origin.example/api/data')
  .then(function (r) { return r.json(); })
  .catch(function (e) { console.log('Blocked reading the response:', e.message); });`,
  },

  nuance: 'Not every cross-origin request is "simple." A request only skips the preflight if it uses GET/HEAD/POST, sets only a small allowlisted set of headers, and keeps Content-Type restricted to a few plain values — anything else, like a custom `Authorization` header, a `Content-Type` of `application/json`, or a PUT/DELETE method, makes the browser send an `OPTIONS` preflight FIRST, asking the server to explicitly confirm (via `Access-Control-Allow-Methods`/`-Headers`) that the real request is allowed, before the real request is ever sent. Credentialed requests — cookies, HTTP auth — add another layer: the server must respond with an exact `Access-Control-Allow-Origin` (never a wildcard `*`) AND `Access-Control-Allow-Credentials: true`, or the browser refuses to expose the response. That combination exists specifically to stop a permissive CORS policy from accidentally exposing cookie-authenticated data to any origin that asks for it.',

  securityAngle: 'A surprisingly common real vulnerability: a server that reflects whatever `Origin` header the browser sent back as the value of `Access-Control-Allow-Origin`, instead of checking it against an allowlist — effectively answering "yes" to every origin while still looking, at a glance, like it has a working CORS policy. Combined with `Access-Control-Allow-Credentials: true`, this lets `attacker.example` load a page that fetches `https://victim.example/api/account` with `credentials: "include"`, have the victim\'s session cookie sent automatically, and actually read the authenticated JSON response back — precisely what the Same-Origin Policy exists to prevent. This is why the spec forbids the literal combination of a wildcard `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`: reflecting the Origin header is a way around that restriction that technically satisfies both rules while defeating the point of either.',

  runtimeSecurityAngle: 'A runtime monitor is just JavaScript running on the page — it is bound by the exact same Same-Origin Policy as anything else on that page, including the third-party scripts it might be trying to watch. If a suspicious script runs inside a cross-origin iframe (a common way third- and fourth-party code is actually embedded), a first-party monitor cannot read that iframe\'s DOM, inspect its variables, or see its network calls directly — SOP blocks the monitor exactly as it blocks anyone else, with no special exception for defensive code. The sanctioned way information crosses that boundary is `postMessage`, which is also why the origin-check discipline from the fix-postmessage-listener lab matters symmetrically for monitoring code: a monitor that receives postMessage data from an embedded frame needs to verify `event.origin` just as carefully as the frame\'s own application code should, or it becomes exactly the kind of forgeable listener this lesson just showed how to fix.',

  keyTakeaways: [
    'Origin = scheme + host + port, compared exactly, no partial matches. Site = registrable domain + scheme — a coarser concept used for cookies (SameSite), not for the Same-Origin Policy.',
    'The Same-Origin Policy blocks reading DOM/responses across origins by default; CORS is a server-controlled opt-in that relaxes that for specific reads — it does not stop the request from being sent.',
    'Only some cross-origin requests skip the preflight; custom headers, non-simple content types, or non-GET/HEAD/POST methods all trigger an OPTIONS preflight first.',
    'Credentialed cross-origin responses require an exact Access-Control-Allow-Origin (never a wildcard) plus Access-Control-Allow-Credentials: true — reflecting the Origin header back verbatim is a real vulnerability that defeats this.',
    'A runtime monitor gets no special exemption from SOP — it cannot read a cross-origin iframe\'s contents any more than any other script can, and must origin-check postMessage data exactly as carefully as first-party code should.',
  ],

  example: {
    runner: 'iframe',
    code: EXAMPLE_CODE,
    siteSnapshot: '<div class="card">See console output.</div>',
    predictPrompt: 'Predict: will reading window.parent.location.href succeed or throw? What kind of error, if any?',
  },
  panels: [],

  labs: [
    {
      id: 'compare-origins',
      title: 'Calculate: same origin, same site, or neither?',
      type: 'predict',
      instructions: 'For each pair of URLs, decide the relationship.',
      runner: 'none',
      submissionMode: 'answer',
      initialCode: '',
      answerSchema: [
        { id: 'pair1', prompt: 'https://shop.example.com/cart  vs  https://shop.example.com/checkout', type: 'select', options: ORIGIN_OPTIONS },
        { id: 'pair2', prompt: 'https://shop.example.com  vs  http://shop.example.com', type: 'select', options: ORIGIN_OPTIONS },
        { id: 'pair3', prompt: 'https://shop.example.com  vs  https://shop.example.com:8443', type: 'select', options: ORIGIN_OPTIONS },
        { id: 'pair4', prompt: 'https://shop.example.com  vs  https://blog.example.com', type: 'select', options: ORIGIN_OPTIONS },
        { id: 'pair5', prompt: 'https://shop.example.com  vs  https://shop.evil.com', type: 'select', options: ORIGIN_OPTIONS },
      ],
      validate(answers) {
        const correct = {
          pair1: 'Same origin',
          pair2: 'Different origin, same site',
          pair3: 'Different origin, same site',
          pair4: 'Different origin, same site',
          pair5: 'Different origin, different site',
        };
        const keys = Object.keys(correct);
        const matches = keys.filter((k) => answers[k] === correct[k]).length;
        const fraction = matches / keys.length;
        return { passed: fraction === 1, score: { correctness: fraction }, feedback: [`${matches}/${keys.length} correct.`] };
      },
      hints: [
        'Origin = scheme + host + port, ALL THREE must match exactly. Path never matters for origin.',
        'Site = the registrable domain (roughly, "example.com") + scheme. Two different subdomains (shop. vs blog.) are different origins but usually the same site.',
      ],
      solution: 'pair1: Same origin. pair2: different origin (scheme), same site. pair3: different origin (port), same site. pair4: different origin (host/subdomain), same site. pair5: different origin AND different site (evil.com is a different registrable domain).',
      explanation: 'Origin comparison is strict and mechanical — scheme, host, and port must ALL match. "Site" deliberately ignores subdomain and scheme differences and looks only at the registrable domain, which is why cookies (governed by SameSite) and origins (governed by SOP) can disagree about whether two URLs are "related."',
    },
    {
      id: 'inspect-realm-boundary',
      title: 'Inspect: what can this sandboxed realm actually reach?',
      type: 'predict',
      instructions: 'This lesson\'s live simulation is itself running inside a sandboxed iframe with an opaque origin. Press Run and see what happens when it tries to reach its parent window\'s document.',
      runner: 'iframe',
      submissionMode: 'answer',
      siteSnapshot: REALM_SITE,
      initialCode: '',
      testScript: REALM_TEST,
      answerSchema: [
        { id: 'guess', prompt: 'Before running: will accessing window.parent.document succeed or be blocked?', type: 'select', options: ['It will succeed — same-page iframes can always see their parent', 'It will be blocked by the browser'] },
      ],
      validate(answers, extra) {
        const r = extra.runResult?.returnValue ?? {};
        const guessedBlocked = answers.guess === 'It will be blocked by the browser';
        const actuallyBlocked = r.accessedParentDocument === false;
        return {
          passed: guessedBlocked && actuallyBlocked,
          score: { correctness: guessedBlocked && actuallyBlocked ? 1 : 0.3 },
          feedback: [
            actuallyBlocked ? `Blocked as expected (${r.errorName ?? 'SecurityError'}).` : 'Not blocked — unexpected for this environment.',
            r.isNested ? 'Confirmed: window.parent !== window (this really is a nested browsing context).' : '',
          ],
        };
      },
      hints: [
        'This iframe has `sandbox="allow-scripts"` WITHOUT `allow-same-origin` — that combination deliberately gives it an opaque ("null") origin, which never matches any real origin, including its own parent\'s.',
        'Reading a cross-origin window\'s `.document` (or most of its properties) throws — this restriction is enforced by the browser itself, not by any JavaScript running on either side.',
      ],
      solution: 'Blocked — attempting to read `window.parent.document` throws a SecurityError, because this sandboxed iframe has an opaque origin that can never be same-origin with its parent, regardless of what either side\'s JavaScript tries to do.',
      explanation: 'This is real, observable proof that the restriction is BROWSER-enforced, not JavaScript-enforced: the sandboxed code has full, unrestricted ability to run arbitrary JavaScript (that\'s what `allow-scripts` grants) — and it STILL cannot read its parent\'s DOM, because that specific restriction is implemented by the browser\'s window/document access checks, completely independent of what capabilities the script itself has.',
    },
    {
      id: 'fix-postmessage-listener',
      title: 'Fix: an insecure postMessage listener',
      type: 'defend',
      instructions: 'This widget accepts a "setStatus" command via postMessage from ANY sender. Add an origin check so it only trusts messages from https://trusted-partner.example.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: MESSAGE_SITE,
      initialCode: MESSAGE_BUGGY,
      testScript: MESSAGE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0, security: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.trustedApplied && !!r.untrustedBlocked;
        return {
          passed,
          score: { security: passed ? 1 : 0, compatibility: r.trustedApplied ? 1 : 0 },
          feedback: [
            r.trustedApplied ? 'The trusted-origin message was still applied.' : 'The trusted-origin message was incorrectly blocked too.',
            r.untrustedBlocked ? 'The forged-origin message was correctly rejected.' : 'The forged-origin message was NOT rejected — this listener still trusts anyone.',
          ],
        };
      },
      hints: [
        'Every `message` event carries `event.origin` — the naive version never looks at it at all.',
        'Add a check at the very top of the handler: `if (event.origin !== "https://trusted-partner.example") return;`',
      ],
      solution: `var TRUSTED_ORIGIN = 'https://trusted-partner.example';
window.addEventListener('message', function (event) {
  if (event.origin !== TRUSTED_ORIGIN) return;
  console.log('Received command:', event.data.command);
  if (event.data.command === 'setStatus') {
    document.getElementById('status').textContent = event.data.value;
  }
});`,
      explanation: 'A `message` event handler runs for ANY postMessage sent to that window, from any origin — the browser does not filter these by default. Checking `event.origin` against an explicit allowlist (never a substring/regex match that could be spoofed by a similarly-named domain) is the entire fix; without it, any page that can get a reference to this window (or embed/open it) can forge arbitrary commands.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-origin-vs-site', question: 'Give a concrete pair of URLs that are the same site but different origins, and explain why the distinction matters for cookies specifically.', modelAnswer: 'https://shop.example.com and https://blog.example.com are the same site (same registrable domain, example.com) but different origins (different host). SameSite cookie behavior is defined in terms of SITE, not origin — so a cookie set with SameSite=Strict on shop.example.com is still sent on a request to blog.example.com if that request is otherwise same-site, even though they are different origins for Same-Origin-Policy purposes. Origin and site answer genuinely different questions.', skillTag: 'browserArchitecture' },
    { id: 'kc-cors-not-security', question: 'Does CORS make a cross-origin request more secure? What does it actually control?', modelAnswer: 'No — CORS does not stop a cross-origin request from being sent (the server still receives it) and does not add any protection on its own. It controls only whether the requesting page\'s JavaScript is allowed to READ the response, based on headers the server chooses to send. A missing or misconfigured CORS header can actually weaken security (e.g. a wildcard Access-Control-Allow-Origin combined with credentials) rather than improve it.', skillTag: 'network' },
    { id: 'kc-enforcement', question: 'In the realm-boundary lab, what specifically stopped the sandboxed code from reading its parent\'s document — and could that code have bypassed it with cleverer JavaScript?', modelAnswer: 'The browser itself blocks cross-origin window/document access as part of the Same-Origin Policy — this is enforced at the browser engine level, checking the accessing script\'s origin against the target window\'s origin on every such access, not something implemented in JavaScript that could be reasoned around. No amount of cleverness in the sandboxed script changes this, because the restriction doesn\'t live in script-reachable code at all.', skillTag: 'webSecurity' },
  ],

  interviewQuestions: [
    'Define "origin" precisely, and give an example of two URLs that are the same site but different origins.',
    'Explain what CORS actually controls, and why it is not itself a security mechanism.',
    'A sandboxed iframe has full script execution but still can\'t read its parent\'s DOM. What enforces that, and why can\'t the script itself bypass it?',
  ],
};
