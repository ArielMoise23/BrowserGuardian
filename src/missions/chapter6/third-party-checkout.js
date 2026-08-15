const SITE_HTML = `
<div class="card">
  <h3>Checkout</h3>
  <form id="checkout-form">
    <div class="field"><label for="card-number">Card number</label><input id="card-number" type="text" value="4111 1111 1111 1111" /></div>
    <div class="field"><label for="cvv">CVV</label><input id="cvv" type="text" value="123" /></div>
    <button type="submit">Pay</button>
  </form>
</div>
`;

const SETUP_SCRIPT = `(function () {
  // Simulated third-party "customer support chat widget" — loaded via a normal
  // <script> tag on a real page, this would execute with zero isolation from the
  // first-party checkout code around it.
  var cardField = document.getElementById('card-number');
  console.log('[chat-widget] page loaded, card field currently contains: ' + (cardField ? cardField.value : '(not found)'));

  cardField.addEventListener('input', function (e) {
    console.log('[chat-widget] observed a change in the card field: ' + e.target.value);
  });

  var badge = document.createElement('div');
  badge.className = 'chat-widget-badge';
  badge.textContent = 'Chat support online';
  document.getElementById('site-root').appendChild(badge);

  var originalTrim = String.prototype.trim;
  String.prototype.trim = function () {
    console.log('[chat-widget] String.prototype.trim() intercepted');
    return originalTrim.call(this);
  };

  __securityAlert('info', 'Third-party chat widget executed in the page realm: read a payment field value, registered a listener on it, mutated the DOM, and patched a shared prototype method.', 'chat-widget.js');
})();
`;

export default {
  id: 'third-party-checkout',
  chapter: 6,
  title: 'Third-Party Checkout',
  type: 'threat-modeling',
  difficulty: 'core',
  xp: 150,
  estimatedMinutes: 20,
  runner: 'iframe',
  submissionMode: 'answer',
  panels: ['dom', 'alerts'],
  isSuspiciousNode: (node) => node.attrs?.class === 'chat-widget-badge',

  objective: 'Understand precisely what a third-party script can see and do once it executes on your page — same realm, same DOM, same globals — and identify the trust boundary that would actually stop it.',
  prerequisites: 'Chapter 3 (DOM/events); basic idea of what a <script> tag does.',
  scenario: 'Your checkout page loads a third-party "customer support chat widget" via a normal `<script src="...">` tag, right alongside the first-party payment form. The vendor\'s docs promise it\'s "sandboxed and safe." The simulation below runs that exact script, unmodified, against a real (fake-data) checkout form so you can observe what it actually does — not what its marketing claims.',
  task: 'Watch the console, security alerts, and DOM inspector after the simulation runs, then answer the threat-modeling questions.',
  expectedBehavior: 'You correctly identify that the widget script runs in the same realm as the page (not an isolated one), enumerate everything it demonstrably did, and name a real client-side control that would prevent it from reading the card field.',

  siteSnapshot: SITE_HTML,
  setupScript: SETUP_SCRIPT,
  initialCode: '',

  answerSchema: [
    { id: 'sameRealm', prompt: 'True or False: this third-party script executes in a separate JavaScript realm from the first-party checkout page, with its own globals and prototypes.', type: 'boolean' },
    {
      id: 'capabilities',
      prompt: 'Select every capability this script actually demonstrated in the simulation (check the console and security alerts panel):',
      type: 'multiselect',
      options: [
        "Read the card number field's current value",
        'Register its own event listener on the card number field',
        'Mutate the DOM outside its own widget area',
        'Redefine a shared built-in prototype method (String.prototype.trim)',
        'Read an HttpOnly cookie',
      ],
    },
    { id: 'mitigation', prompt: 'Name one concrete client-side control that would prevent this script from ever being able to read the card-number field\'s value, and briefly explain why it works.', type: 'text' },
  ],

  validate(answers) {
    const feedback = [];
    let score = 0;
    let total = 0;

    total += 1;
    if (answers.sameRealm === 'false') { score += 1; feedback.push('Correct: no isolation was applied, so it shares the page\'s realm.'); }
    else feedback.push('Not quite — with no iframe/sandbox involved, the widget script runs in the exact same realm, same window, same globals as the first-party code.');

    const correctCaps = new Set([
      "Read the card number field's current value",
      'Register its own event listener on the card number field',
      'Mutate the DOM outside its own widget area',
      'Redefine a shared built-in prototype method (String.prototype.trim)',
    ]);
    const selected = new Set(answers.capabilities ?? []);
    const allOptions = [...correctCaps, 'Read an HttpOnly cookie'];
    let capMatches = 0;
    for (const opt of allOptions) {
      const shouldBeSelected = correctCaps.has(opt);
      if (selected.has(opt) === shouldBeSelected) capMatches += 1;
    }
    const capFraction = capMatches / allOptions.length;
    score += capFraction;
    total += 1;
    feedback.push(`Capability checklist: ${capMatches}/${allOptions.length} correct. Note this simulation never touched cookies at all — HttpOnly cookies are inaccessible to any JavaScript regardless of realm.`);

    total += 1;
    const mitigationText = (answers.mitigation ?? '').toLowerCase();
    const keywords = ['iframe', 'sandbox', 'isolate', 'separate realm', 'separate origin', 'cross-origin'];
    const mitigationOk = keywords.some((k) => mitigationText.includes(k));
    if (mitigationOk) { score += 1; feedback.push('Good — isolating the field into its own (cross-origin or sandboxed) iframe is the actual boundary that stops same-realm DOM access.'); }
    else feedback.push('Consider: the only thing that actually stops a script from reading a DOM field is putting that field in a genuinely separate realm (e.g. a cross-origin iframe, the way real payment processors isolate card fields) — CSP and sanitization don\'t prevent DOM reads by code that\'s already allowed to run.');

    const fraction = score / total;
    return { passed: fraction >= 0.66, score: { correctness: fraction, security: fraction }, feedback };
  },

  hints: [
    'Look at what actually appeared in the console and the security alerts panel — don\'t reason about what the widget "should" be able to do, read what it did.',
    'There is no <iframe> anywhere in this simulation — the widget script was concatenated straight into the page\'s own execution, exactly like a real `<script src="...">` tag with no sandbox attribute.',
    'Within this same-realm, same-origin scenario, the only thing the browser itself withholds from JavaScript is an HttpOnly cookie — everything DOM-related (fields, listeners, prototypes) is fully open to any script running in that realm, regardless of whether a vendor calls itself "trusted."',
  ],

  solution: 'sameRealm: False. Capabilities: all four same-realm actions are true, "Read an HttpOnly cookie" is false. Mitigation: isolate the sensitive field in a separate realm (cross-origin/sandboxed iframe) — same-realm JavaScript restrictions (naming conventions, "internal" variables, even CSP) do not stop a co-located script from reading the DOM, because it has full, unrestricted access to any element in the shared document.',

  explanation: 'A `<script>` tag with no `sandbox`, no separate `<iframe>`, and no realm boundary executes with exactly the same privileges as the first-party code around it: same `window`, same `document`, same prototypes, same everything. It can read any form field, register any listener, mutate any part of the DOM outside "its own" widget container, and even redefine built-in methods that the rest of the page\'s code depends on (`String.prototype.trim` here) — because there is only one shared global environment, JS has no concept of "this variable belongs to script A" once both scripts are loaded into the same page. The one thing genuinely outside its reach is anything the *browser* — not JavaScript — restricts by design: an HttpOnly cookie is invisible to `document.cookie` regardless of which script asks, because the browser withholds it from the JS layer entirely.',

  commonWrongAnswers: [
    { description: 'Assuming a script tag is somehow "sandboxed" because a vendor\'s documentation says so.', why: 'Nothing about a plain `<script src>` tag creates any isolation. "Sandboxed" as a real technical guarantee requires an actual mechanism — a `sandbox` attribute on an iframe, a Worker, or a genuinely separate origin — not a marketing claim.' },
    { description: 'Believing CSP would have stopped the field read.', why: 'CSP restricts which script SOURCES are allowed to load and execute at all — once a script is permitted to run, CSP does nothing to restrict what DOM it can read or write. That requires actual realm isolation, not a content policy.' },
  ],

  securityImpact: 'This is the foundational fact every later mission in this lab builds on: without deliberate isolation, a third-party script is not "a guest" on your page — it\'s a co-owner of the entire execution environment. Every subsequent formjacking, skimming, and instrumentation-bypass mission relies on this same-realm access being real.',
  runtimeExplanation: 'A JavaScript realm is the complete set of intrinsics — the global object, built-in constructors, prototypes — associated with one global execution context. Loading a script via a normal `<script>` tag (inline, external, sync, async, or deferred — none of that matters) always executes it in the existing realm of the page that loaded it. Only genuinely separate global contexts — a same- or cross-origin iframe\'s window, or a Worker\'s global scope — create a new realm with its own independent set of intrinsics.',
  sourceDefenseConnection: 'This is the exact problem statement of the role: understanding precisely what unmodified, unmonitored third-party JavaScript can reach on a customer-facing page is the starting point for every runtime protection decision that follows — what to isolate, what to monitor, and what a policy can and can\'t actually stop.',
  followUp: 'Redesign this checkout so the card-number field itself lives inside a same-origin iframe the first-party page controls, but the third-party chat widget still loads on the outer page. Explain in a sentence why that specific arrangement neutralizes exactly the capability chain you saw here.',
  skillTags: ['browserArchitecture', 'webSecurity', 'threatModeling'],
};
