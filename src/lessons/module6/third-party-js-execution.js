const COLLISION_SITE = `<div class="card"><h3>Account status</h3><div id="output">(not rendered yet)</div></div>`;
const COLLISION_SETUP = `var __appConfig = { isAdmin: false, apiKey: "sk_test_123" };
function renderStatus() {
  document.getElementById('output').textContent = 'isAdmin: ' + __appConfig.isAdmin;
}
renderStatus();
`;
const COLLISION_TEST = `(function () {
  __report({});
})();
`;
const COLLISION_ATTACK = `console.log("Third-party script sees apiKey:", __appConfig.apiKey);
__appConfig.isAdmin = true;
renderStatus();
`;

const ISOLATE_SKELETON = `var __appConfig = { isAdmin: false, apiKey: "sk_test_123" };
function renderStatus() {
  document.getElementById('output').textContent = 'isAdmin: ' + __appConfig.isAdmin;
}
window.renderStatus = renderStatus;
renderStatus();
`;
const ISOLATE_TEST = `(function () {
  var results = {};
  results.apiKeyLeaked = typeof __appConfig !== 'undefined' && !!__appConfig.apiKey;
  try { __appConfig.isAdmin = true; } catch (e) {}
  window.renderStatus();
  results.isAdminFlippedViaGlobal = document.getElementById('output').textContent.indexOf('true') !== -1;
  __report(results);
})();
`;

const EXAMPLE_CODE = `var sharedCounter = 0;

function incrementFromFirstParty() {
  sharedCounter += 1;
  console.log("First-party incremented, sharedCounter =", sharedCounter);
}

function incrementFromThirdParty() {
  // Imagine this was defined by a totally unrelated <script> tag loaded
  // right after the one above — same page, same realm, same globals.
  sharedCounter += 100;
  console.log("Third-party incremented, sharedCounter =", sharedCounter);
}

incrementFromFirstParty();
incrementFromThirdParty();
incrementFromFirstParty();
`;

export default {
  id: 'third-party-js-execution',
  moduleId: 'network-and-script-loading',
  title: 'What Third-Party JavaScript Can Actually Access',
  estimatedMinutes: 25,
  difficulty: 'core',
  prerequisites: ['var-let-const-closures'],
  relatedMissionIds: ['third-party-checkout'],
  skillTags: ['webSecurity', 'browserArchitecture', 'threatModeling'],

  whyItMatters: {
    development: 'Loading two unrelated scripts on the same page is completely routine — and almost nobody stops to notice that they share one global object by default, with zero isolation, unless something breaks.',
    security: 'This is the mechanical fact underneath every "a third-party script got compromised and stole data" incident: without deliberate isolation, "third-party" is a trust label, not a technical boundary.',
    sourceDefense: 'Before you can design a runtime control for this, you have to be precise about what\'s actually true by default versus what requires extra effort from either side — this lesson is that baseline.',
  },

  mentalModel: {
    coreIdea: 'Load two `<script>` tags on the same page and, unless someone deliberately prevents it, they are not two separate programs running side by side — they are one program, sharing one global object, one DOM, one everything. A top-level variable in either one is just a name on that shared object, visible and writable from the other. "First-party" and "third-party" describe who wrote the code and where it\'s hosted; by default, they say nothing about what the browser actually lets that code reach once it\'s running.',
    explanation: 'Every classic `<script>` tag on a page — inline, external, sync, async, deferred, first-party or third-party — executes in exactly the same realm as every other one, sharing one `window`, one `document`, one set of prototypes. A top-level `var` (or a bare function declaration) in ANY of them becomes a property of that single shared global object, readable and writable BY NAME from any script that runs afterward. There is no default namespacing, no default privacy, and no default isolation between scripts sharing a page — isolation is something you have to deliberately build (a separate realm via iframe/Worker, or at minimum keeping state out of the global object via closures), never something you get by default.',
    distinctions: [
      { label: 'ECMAScript spec', text: 'That a `var` declaration at top level (in non-module, "classic script" code) creates a property on the global object is defined by ECMAScript itself — this isn\'t a browser quirk, it\'s core language behavior for classic scripts.' },
      { label: 'Browser-provided', text: 'That MULTIPLE `<script>` tags on one page all share the SAME global object (rather than each getting its own) is a consequence of how the browser sets up ONE realm per document/browsing context — every classic script loaded into that document executes against that one shared global.' },
      { label: 'Simplified model', text: '"Third-party scripts can steal anything on the page" is directionally true but imprecise. They have the same DOM/global access as first-party code — which is extensive — but specific browser-enforced protections (HttpOnly cookies, cross-origin iframe content) are still off-limits regardless of same-realm co-location.' },
    ],
    snippet: `var trackingId = "abc123"; // written in one <script> tag

console.log(window.trackingId);                 // "abc123" — read from a totally
                                                  // different <script> tag, no API needed
console.log(window.trackingId === trackingId);   // true — same binding, two names for it`,
  },

  nuance: 'Everything above is specific to CLASSIC scripts — a `<script type="module">` behaves differently by design. Top-level declarations inside a module are scoped to that module, never attached to `window`, and never visible by name to any other script, module or classic, on the page. Two `<script type="module">` tags do not automatically share state the way two classic scripts do; a module that wants to expose something has to do so explicitly via `export`, and another module has to explicitly `import` it. This is a real, if partial, isolation mechanism — worth knowing precisely because "just use modules" is sometimes suggested as a fix for the global-collision problem this lesson demonstrates. It genuinely helps with NAME collisions, but it changes nothing about shared DOM access, shared built-ins, or any of the other capabilities covered in the capability-boundaries lab below.',

  securityAngle: 'This shared-realm reality is exactly what makes a supply-chain compromise of a single trusted script so severe: if `https://cdn.example/analytics.js` — a script a site owner explicitly chose to load, unsandboxed, because it\'s "just an analytics library" — gets compromised (a maintainer\'s credentials stolen, a malicious version published, the CDN itself breached), the injected code runs with exactly the same access as the site\'s own first-party JavaScript. It doesn\'t need to exploit anything or escalate any privilege; co-location IS the privilege. It can read form fields, override `window.fetch`, walk the DOM for payment inputs, and exfiltrate whatever it finds, using ordinary, unremarkable JavaScript APIs — from the browser\'s perspective it is simply more code running in the same realm as everything else. "We trust this vendor" is therefore a security decision with real blast radius, not a formality: the trust boundary a site owner draws around a third-party script and the technical boundary the browser actually enforces are two completely different things, and only the second one is real by default.',

  runtimeSecurityAngle: 'A monitoring script that runs in the same realm as the third-party code it\'s watching has the same limitation the isolate-shared-state lab exposed: it can observe and react, but it cannot retroactively take away access a script has already been granted just by being co-located. By the time a same-realm monitor notices a suspicious fetch call or DOM read, the malicious code already had full run of the page from the moment it executed — monitoring from inside the same realm is detection, not containment. Actual containment, preventing a script from ever having that access in the first place, requires loading it into a genuinely separate realm (a sandboxed iframe, a Worker) from the start — a deployment decision made before the script ever runs, not something a same-realm monitor can impose after the fact. The two techniques are complementary, not substitutes: sandboxing limits what a script CAN do; same-realm monitoring limits how long something can go unnoticed if it wasn\'t sandboxed.',

  keyTakeaways: [
    'Every classic <script> on a page — first-party or third-party, sync, async, or deferred — runs in the same realm, sharing one global object with every other classic script on that page.',
    'A top-level var (or bare function declaration) becomes a property of that shared global — any other same-realm script can read or overwrite it by name, with zero special technique.',
    '<script type="module"> does not share top-level state this way — module scope is real, but it changes nothing about shared DOM access, shared built-ins, or other co-location capabilities.',
    'Co-location IS the privilege: a compromised trusted script (a real supply-chain risk) runs with exactly the same access as first-party code — no escalation needed.',
    'Same-realm monitoring can detect and react, but only genuine realm isolation (iframe/Worker), decided before a script ever runs, actually prevents it from having that access at all.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'Two functions, written as if by two completely unrelated <script> tags, both reference `sharedCounter` by name with no special API. Predict the three logged values.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'predict-global-collision',
      title: 'Predict: a co-located script reads and mutates "private" state',
      type: 'predict',
      instructions: 'A first-party script sets up `__appConfig` as a plain global. A simulated third-party script (shown below) runs right after it. Predict what it can do.',
      runner: 'iframe',
      submissionMode: 'answer',
      siteSnapshot: COLLISION_SITE,
      setupScript: COLLISION_SETUP,
      initialCode: '',
      sourceCode: COLLISION_ATTACK,
      testScript: `${COLLISION_ATTACK}\n${COLLISION_TEST}`,
      answerSchema: [
        { id: 'canRead', prompt: 'Can the third-party script read __appConfig.apiKey?', type: 'boolean' },
        { id: 'canWrite', prompt: 'After it runs, what does the page display?', type: 'select', options: ['isAdmin: true', 'isAdmin: false'] },
      ],
      validate(answers, extra) {
        const consoleLines = (extra.consoleLines ?? []).map((l) => l.text);
        const sawApiKey = consoleLines.some((t) => t.includes('sk_test_123'));
        const correctRead = answers.canRead === 'true';
        const correctWrite = answers.canWrite === 'isAdmin: true';
        const fraction = (correctRead ? 0.5 : 0) + (correctWrite ? 0.5 : 0);
        return { passed: fraction === 1, score: { correctness: fraction, security: fraction }, feedback: [sawApiKey ? 'Confirmed in console: the third-party code did read the real apiKey value.' : 'Press Run to see the real console output.'] };
      },
      hints: [
        '`__appConfig` was declared with `var` at the top level — where does that binding actually live?',
        'It\'s a property of the shared global object. Any script running afterward in the same realm can reference it by name, read it, or reassign its properties — no special permission needed.',
      ],
      solution: 'Yes, it can read apiKey — and after it runs, the page displays "isAdmin: true", because the third-party code directly mutated the shared `__appConfig` object.',
      explanation: 'Nothing about this requires any special technique — `__appConfig` is a plain, ordinary global variable, exactly as accessible to the "third-party" code as it is to the code that defined it. This is precisely why formjacking scripts don\'t need to know a page\'s internal structure in advance: co-location alone hands them broad access.',
    },
    {
      id: 'isolate-shared-state',
      title: 'Defend: stop leaking state through the shared global',
      type: 'defend',
      instructions: 'Refactor this code so apiKey and the ability to set isAdmin are no longer reachable by name from other same-page scripts — but window.renderStatus() must keep working exactly as before.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: COLLISION_SITE,
      initialCode: ISOLATE_SKELETON,
      testScript: ISOLATE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0, security: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !r.apiKeyLeaked && !r.isAdminFlippedViaGlobal;
        return {
          passed,
          score: { security: passed ? 1 : 0, compatibility: !r.error ? 1 : 0 },
          feedback: [
            r.apiKeyLeaked ? 'apiKey is still reachable as a global.' : 'apiKey is no longer reachable by name.',
            r.isAdminFlippedViaGlobal ? 'isAdmin could still be flipped from outside.' : 'isAdmin can no longer be flipped from outside.',
          ],
        };
      },
      hints: [
        'Wrap the config and the logic that reads it in an IIFE (an immediately-invoked function expression) — anything declared with `var`/`let`/`const` inside it is local to that function, not global.',
        'You still need `renderStatus` itself to be reachable — assign it to `window.renderStatus` explicitly from inside the IIFE, so only that one function (not the config it closes over) becomes public.',
      ],
      solution: `var renderStatus;
(function () {
  var appConfig = { isAdmin: false, apiKey: "sk_test_123" };
  renderStatus = function () {
    document.getElementById('output').textContent = 'isAdmin: ' + appConfig.isAdmin;
  };
})();
window.renderStatus = renderStatus;
renderStatus();`,
      explanation: 'This is the closure-based module pattern applied to a real security question: `appConfig` now lives only inside the IIFE\'s scope, reachable solely by the `renderStatus` closure — no other same-page script can name it. Worth being precise about the limit here: this stops accidental/opportunistic NAME-based access from co-located scripts, but it does NOT create a real security boundary — a genuinely malicious script can still read the live DOM, monkey-patch built-ins, or attach its own listeners. Real isolation from an actively hostile script requires a separate realm (iframe/Worker), not just hiding a variable.',
    },
    {
      id: 'capability-boundaries',
      title: 'Predict: what co-location does and doesn\'t hand over automatically',
      type: 'predict',
      instructions: 'For each statement about a co-located (same-realm, unsandboxed) third-party script, decide true or false.',
      runner: 'none',
      submissionMode: 'answer',
      initialCode: '',
      answerSchema: [
        { id: 's1', prompt: 'It can read the value the user just typed into a payment field, just by being on the page.', type: 'boolean' },
        { id: 's2', prompt: 'It automatically sees every fetch() call first-party code makes, with zero extra effort on its part.', type: 'boolean' },
        { id: 's3', prompt: 'It can read a cookie marked HttpOnly.', type: 'boolean' },
        { id: 's4', prompt: 'It can navigate the page to a different URL or open a popup.', type: 'boolean' },
      ],
      validate(answers) {
        const correct = { s1: 'true', s2: 'false', s3: 'false', s4: 'true' };
        const keys = Object.keys(correct);
        const matches = keys.filter((k) => answers[k] === correct[k]).length;
        const fraction = matches / keys.length;
        return { passed: fraction === 1, score: { correctness: fraction, security: fraction }, feedback: [`${matches}/${keys.length} correct.`] };
      },
      hints: [
        'Reading DOM field values is passive and automatic — no special access needed, it\'s just `element.value`.',
        'Seeing OTHER code\'s network calls is NOT automatic — the third-party script would have to actively monkey-patch `fetch`/`XMLHttpRequest` itself to observe calls it didn\'t make. Being co-located gives it the ability to do that patching, but doesn\'t hand it visibility for free.',
      ],
      solution: 's1: True. s2: False (requires actively patching fetch/XHR itself). s3: False (browser-enforced, independent of realm). s4: True.',
      explanation: 'The nuance worth holding onto: same-realm co-location is necessary but not sufficient for every capability. Some things (reading DOM state) are trivially free. Others (observing network calls made by different code) require the third-party script to take an additional, deliberate action — which is exactly the kind of ACTION-based signal a behavioral detector can watch for.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-shared-global', question: 'Explain precisely why two unrelated <script> tags on the same page can read each other\'s top-level `var` variables by name.', modelAnswer: 'Every classic script loaded into a document executes in the same realm and against the same global object. A top-level `var` declaration (outside any function) creates a property on that shared global object — since every script sees the same global object, any of them can reference that property by name.', skillTag: 'webSecurity' },
    { id: 'kc-closure-limit', question: 'The closure-based isolation lab hides a variable from name-based access. Does it protect against a genuinely malicious co-located script? Why or why not?', modelAnswer: 'No, not fully. It stops other scripts from referencing that specific variable BY NAME, which defeats accidental collisions and opportunistic/naive attacks. But a malicious script can still read whatever ends up in the DOM, monkey-patch shared built-ins, attach its own event listeners, or intercept anything the closure-protected code itself writes out — real protection against an actively hostile co-located script requires realm isolation (iframe/Worker), not just variable privacy.', skillTag: 'webSecurity' },
  ],

  interviewQuestions: [
    'Why do two unrelated <script> tags on the same page share access to each other\'s top-level variables?',
    'Name one thing a co-located third-party script can access with zero extra effort, and one thing it would need to take an active additional step to gain.',
    'Does hiding sensitive state in a closure protect it from a malicious (not just careless) co-located script? Justify your answer.',
  ],
};
