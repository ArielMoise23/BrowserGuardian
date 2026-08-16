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

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'third-party-js-execution',
  moduleId: 'network-and-script-loading',
  title: 'What Third-Party JavaScript Can Actually Access',
  estimatedMinutes: 25,
  difficulty: 'core',
  prerequisites: ['var-let-const-closures'],
  relatedMissionIds: ['third-party-checkout'],
  skillTags: ['webSecurity', 'browserArchitecture', 'threatModeling'],

  explanation: [
    'Load two `<script>` tags on the same page and, unless someone deliberately prevents it, they are not two separate programs — they are one program, sharing one global object, one DOM, one everything. A top-level variable in either one is just a name on that shared object, visible and writable from the other. "First-party" and "third-party" describe who wrote the code and where it is hosted; by default, they say nothing about what the browser lets that code reach once it is running.',
    'Every classic `<script>` tag — inline, external, sync, async, deferred, first- or third-party — executes in the same realm, sharing one `window`, one `document`, one set of prototypes. A top-level `var` (or bare function declaration) in any of them becomes a property of that shared global object, readable and writable by name from any script that runs afterward — there is no default namespacing or isolation between scripts sharing a page. `<script type="module">` is the exception: top-level declarations there are scoped to the module, never attached to `window`, so two modules do not automatically share state the way two classic scripts do. This genuinely stops NAME collisions, but changes nothing about shared DOM access or shared built-ins.',
    'This shared-realm reality is what makes a supply-chain compromise of a single trusted script so severe: if an analytics library a site owner chose to load gets compromised — stolen maintainer credentials, a malicious version published, the CDN itself breached — the injected code runs with exactly the same access as first-party JavaScript. It does not need to exploit anything or escalate privilege; co-location IS the privilege. It can read form fields, override `window.fetch`, and exfiltrate whatever it finds using ordinary, unremarkable APIs — the trust boundary a site owner draws around a vendor and the technical boundary the browser actually enforces are two completely different things, and only the second one is real by default.',
    'A monitoring script running in that same realm can observe and react, but cannot retroactively take away access a script was already granted by being co-located — by the time it notices a suspicious call, the malicious code already had full run of the page. That is detection, not containment. Actual containment, preventing a script from ever having that access, requires loading it into a genuinely separate realm (a sandboxed iframe, a Worker) from the start — a deployment decision made before the script runs, not something a same-realm monitor can impose afterward.',
  ],

  distinctions: [
    { label: 'ECMAScript spec', text: 'That a var declaration at top level (in classic script code) creates a property on the global object is defined by ECMAScript itself — core language behavior, not a browser quirk.' },
    { label: 'Browser-provided', text: 'That multiple script tags share the same global object is a consequence of the browser setting up one realm per document — every classic script loaded into that document executes against that one shared global.' },
    { label: 'Simplified model', text: '"Third-party scripts can steal anything on the page" is directionally true but imprecise — they have the same extensive DOM/global access as first-party code, but specific browser-enforced protections (HttpOnly cookies, cross-origin iframe content) are still off-limits regardless of co-location.' },
  ],

  tldr: [
    'Every classic <script> on a page runs in the same realm, sharing one global object — a top-level var becomes a property any other same-realm script can read or overwrite by name.',
    '<script type="module"> does not share top-level state this way, but that changes nothing about shared DOM access or shared built-ins.',
    'Co-location IS the privilege: a compromised trusted script runs with exactly the same access as first-party code — no escalation needed.',
    'Same-realm monitoring can detect and react, but only genuine realm isolation (iframe/Worker), decided before a script runs, actually prevents it from having that access.',
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
