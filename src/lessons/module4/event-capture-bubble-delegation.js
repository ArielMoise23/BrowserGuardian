const PATH_SITE = `
<div class="card" id="outer">Outer
  <div id="inner">Inner (click me)</div>
</div>
`;
const PATH_SETUP = `['outer', 'inner'].forEach(function (id) {
  var el = document.getElementById(id);
  el.addEventListener('click', function () { console.log(id + ' bubble'); });
  el.addEventListener('click', function () { console.log(id + ' capture'); }, true);
});
`;
const PATH_TEST = `(function () {
  document.getElementById('inner').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  __report({});
})();
`;

const TABS_SITE = `
<div class="card">
  <div id="tabs">
    <button class="tab">Overview</button>
    <button class="tab">Details <span class="tab__badge">3</span></button>
    <button class="tab">History</button>
  </div>
</div>
`;
const TABS_BUGGY = `document.getElementById('tabs').addEventListener('click', function (event) {
  if (event.target.classList.contains('tab')) {
    console.log('Switched to tab:', event.target.textContent.trim());
  }
});
`;
const TABS_TEST = `(function () {
  var badge = document.querySelector('.tab__badge');
  badge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  var switched = __consoleHistory.some(function (e) { return /switched to tab/i.test(e.text); });
  __report({ switched: switched });
})();
`;

const OBSERVE_SITE = `
<div class="card" id="page-root">
  <button id="action-btn">Delete account</button>
</div>
`;
const OBSERVE_SKELETON = `// Add a CAPTURING listener on document that logs exactly:
// "security monitor: intercepted click (capture phase)"
// It must run BEFORE the button's own click handler — added below in the test setup,
// which you don't need to modify — regardless of source order.
`;
const OBSERVE_TEST = `(function () {
  document.getElementById('action-btn').addEventListener('click', function () {
    console.log('button handler ran');
  });
  document.getElementById('action-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  var lines = __consoleHistory.map(function (e) { return e.text; });
  var monitorIndex = lines.indexOf('security monitor: intercepted click (capture phase)');
  var handlerIndex = lines.indexOf('button handler ran');
  __report({ monitorRan: monitorIndex !== -1, handlerRan: handlerIndex !== -1, monitorFirst: monitorIndex !== -1 && handlerIndex !== -1 && monitorIndex < handlerIndex });
})();
`;

const PROPAGATION_SITE = `
<div class="card" id="parent">
  <a href="#" id="link">Delete</a>
</div>
`;
const PROPAGATION_SKELETON = `// Attach ONE click listener to #link that:
//  1. Prevents the link's default navigation
//  2. Stops any OTHER click listener on #link itself from running
//  3. Stops the click from reaching #parent's listener at all
`;
const PROPAGATION_TEST = `(function () {
  var results = {};
  document.getElementById('link').addEventListener('click', function () { results.secondLinkListenerRan = true; });
  document.getElementById('parent').addEventListener('click', function () { results.parentListenerRan = true; });
  var evt = new MouseEvent('click', { bubbles: true, cancelable: true });
  var notPrevented = document.getElementById('link').dispatchEvent(evt);
  results.defaultPrevented = !notPrevented;
  __report(results);
})();
`;

export default {
  id: 'event-capture-bubble-delegation',
  moduleId: 'dom-and-events',
  title: 'Event Capturing, Bubbling, and Delegation',
  estimatedMinutes: 30,
  difficulty: 'core',
  prerequisites: [],
  relatedMissionIds: ['disappearing-click'],
  skillTags: ['events', 'dom'],

  whyItMatters: {
    development: 'Delegation is how almost every real UI handles dynamically-added elements without re-attaching listeners constantly — but it breaks in exactly the same subtle way over and over if you don\'t know precisely how target/currentTarget work.',
    security: 'This is also exactly how a malicious script skims input: attach one listener high in the tree, and event bubbling hands it every click, keystroke, and form interaction below — no need to know the DOM structure in advance.',
    sourceDefense: 'Runtime instrumentation frequently needs to observe an interaction BEFORE the page\'s own code reacts to it (to make a block/allow decision), which specifically requires capture-phase listeners — not the default bubble phase most developers reach for automatically.',
  },

  mentalModel: {
    explanation: 'When an event is dispatched, the browser first computes its full propagation path — from the document root down to the actual target element. Dispatch then happens in three phases: CAPTURING (from the root down to, but not including, the target — only listeners registered with `{capture: true}` run here), TARGET (listeners on the target itself run in registration order, regardless of their capture flag), then BUBBLING (from the target back up to the root — only listeners registered without `capture: true` run here, unless the event\'s `bubbles` property is false, in which case this phase is skipped entirely). `event.target` is fixed for the whole dispatch — it\'s always the real originating element. `event.currentTarget` changes throughout — it\'s always whichever element the currently-executing listener happens to be attached to.',
    distinctions: [
      { label: 'Browser-provided', text: 'The entire capture/target/bubble event dispatch model is defined by the DOM Standard (a browser/WHATWG specification) — it is NOT part of ECMAScript. JavaScript in a non-browser environment (like a plain Node.js script with no DOM) has no such concept at all.' },
      { label: 'Simplified model', text: '"Bubbling" as a rising-bubble metaphor is a helpful name, not a mechanism — precisely, it\'s a defined traversal of the already-computed ancestor path, back toward the root, calling non-capturing listeners along the way.' },
      { label: 'Implementation detail', text: 'How a browser internally stores and iterates a node\'s listener list is unspecified — the OBSERVABLE guarantee is only that same-element, same-phase listeners run in registration order, and that capture always precedes target which always precedes bubble.' },
    ],
  },

  example: {
    runner: 'iframe',
    code: `document.getElementById('outer').addEventListener('click', function () {
  console.log('outer handler ran');
});
document.getElementById('inner').addEventListener('click', function () {
  console.log('inner handler ran');
});

document.getElementById('inner').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
`,
    siteSnapshot: PATH_SITE,
    predictPrompt: 'Clicking #inner triggers its own handler — will it also trigger #outer\'s handler? Predict, run it, then try modifying one `addEventListener` call to add `, true` as a third argument (making it capturing) and rerun to see how that changes things.',
  },
  panels: ['dom', 'eventPath'],

  labs: [
    {
      id: 'predict-event-path',
      title: 'Predict: capture/target/bubble order',
      type: 'predict',
      instructions: 'Two nested elements each have a capturing AND a bubbling listener. Predict the order of all 4 log lines when the inner element is clicked, THEN press Run to check.',
      runner: 'iframe',
      submissionMode: 'answer',
      panels: ['dom', 'eventPath'],
      siteSnapshot: PATH_SITE,
      setupScript: PATH_SETUP,
      initialCode: '',
      testScript: PATH_TEST,
      answerSchema: [
        { id: 'order', prompt: 'Order (comma-separated, e.g. "outer capture, inner capture, inner bubble, outer bubble")', type: 'text' },
      ],
      validate(answers, extra) {
        const actual = (extra.consoleLines ?? []).map((l) => l.text.trim().toLowerCase());
        const predicted = (answers.order ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const len = Math.max(actual.length, predicted.length, 1);
        let matches = 0;
        for (let i = 0; i < len; i += 1) if (predicted[i] === actual[i]) matches += 1;
        const fraction = matches / len;
        return { passed: fraction === 1 && predicted.length === 4, score: { correctness: fraction }, feedback: [`Actual order: ${actual.join(', ') || '(press Run first)'}`] };
      },
      hints: [
        'Capturing listeners run top-down (outer before inner) on the way IN toward the target; bubbling listeners run bottom-up (inner before outer) on the way back OUT.',
        'The full order is: outer capture, inner capture, inner bubble, outer bubble.',
      ],
      solution: 'outer capture, inner capture, inner bubble, outer bubble',
      explanation: 'Capturing listeners fire during the descent from the root toward the target — outer before inner. Once the target is reached, propagation reverses for the bubble phase — inner (the target itself) fires its bubble listener, then bubbling continues back up through outer.',
    },
    {
      id: 'repair-tab-delegation',
      title: 'Modify: repair broken tab delegation',
      type: 'modify',
      instructions: 'Clicking a tab\'s badge (the small number) should still switch to that tab — right now it silently does nothing.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: TABS_SITE,
      initialCode: TABS_BUGGY,
      testScript: TABS_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const passed = !!runResult.returnValue?.switched;
        return { passed, score: { correctness: passed ? 1 : 0 }, feedback: [passed ? 'Clicking the badge switched tabs.' : 'Clicking the badge still did nothing.'] };
      },
      hints: [
        'Clicking the badge makes `event.target` the `<span class="tab__badge">`, which does NOT have the `tab` class — the exact-match check fails.',
        'Use `event.target.closest(".tab")` to find the nearest ancestor-or-self matching `.tab`, whether the click landed on the button, its text, or the badge.',
      ],
      solution: `document.getElementById('tabs').addEventListener('click', function (event) {
  var tab = event.target.closest('.tab');
  if (tab) {
    console.log('Switched to tab:', tab.textContent.trim());
  }
});`,
      explanation: 'Same underlying issue as any delegation bug: an exact-match check against `event.target` only works when the click lands precisely on the intended element. `closest()` walks up from the actual click target to find the nearest matching ancestor-or-self, which is robust to markup like the badge span nested inside the button.',
    },
    {
      id: 'observe-with-capture',
      title: 'Implement: observe before the page reacts',
      type: 'implement',
      instructions: 'A "Delete account" button has its own click handler. Add a capture-phase listener on document that runs BEFORE it — exactly how runtime security instrumentation gets first look at an interaction.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: OBSERVE_SITE,
      initialCode: OBSERVE_SKELETON,
      testScript: OBSERVE_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.monitorRan && !!r.handlerRan && !!r.monitorFirst;
        return {
          passed,
          score: { correctness: passed ? 1 : 0 },
          feedback: [
            r.monitorRan ? 'Your capture listener ran.' : 'Your capture listener never logged the expected line.',
            r.monitorFirst ? 'It ran before the button\'s own handler.' : 'It did not run before the button\'s own handler — check that you passed `true` for the capture option.',
          ],
        };
      },
      hints: [
        '`addEventListener`\'s third argument (or `{capture: true}`) is what makes a listener run during the capture phase instead of the default bubble phase.',
        'Attach it to `document` (or any ancestor of the button) — capturing listeners on ancestors always run before the target\'s own listeners, regardless of registration order.',
      ],
      solution: `document.addEventListener('click', function (event) {
  console.log('security monitor: intercepted click (capture phase)');
}, true);`,
      explanation: 'Capture-phase listeners on an ancestor run during the descent toward the target, strictly before the target\'s own listeners run in the target phase — this is the mechanism that lets instrumentation observe (and, combined with `preventDefault`/`stopPropagation`, potentially veto) an interaction before the page\'s own code reacts to it.',
    },
    {
      id: 'propagation-controls',
      title: 'Implement: preventDefault vs. stopPropagation vs. stopImmediatePropagation',
      type: 'implement',
      instructions: 'Attach one listener to #link that (1) prevents its default navigation, (2) stops a second listener on the SAME link from running, and (3) stops the click from reaching #parent at all.',
      runner: 'iframe',
      submissionMode: 'code',
      siteSnapshot: PROPAGATION_SITE,
      initialCode: PROPAGATION_SKELETON,
      testScript: PROPAGATION_TEST,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = !!r.defaultPrevented && !r.secondLinkListenerRan && !r.parentListenerRan;
        return {
          passed,
          score: { correctness: passed ? 1 : 0 },
          feedback: [
            r.defaultPrevented ? 'Default navigation was prevented.' : 'Default navigation was NOT prevented.',
            r.secondLinkListenerRan ? 'The second same-element listener still ran (should have been stopped).' : 'The second same-element listener was correctly stopped.',
            r.parentListenerRan ? 'The parent\'s listener still ran (should have been stopped).' : 'The parent\'s listener was correctly stopped.',
          ],
        };
      },
      hints: [
        '`preventDefault()` only stops the browser\'s default action (navigating) — it has no effect on whether other listeners run.',
        '`stopPropagation()` stops the event reaching ancestors, but other listeners already on the SAME element still run. `stopImmediatePropagation()` stops both — it implies `stopPropagation()` AND prevents remaining same-element listeners.',
      ],
      solution: `document.getElementById('link').addEventListener('click', function (e) {
  e.preventDefault();
  e.stopImmediatePropagation();
});`,
      explanation: 'Three genuinely independent controls: `preventDefault()` cancels the browser\'s built-in action for this event (only meaningful if `event.cancelable` is true); `stopPropagation()` stops the event from continuing to the next node in the capture/bubble path, but sibling listeners on the CURRENT node still run; `stopImmediatePropagation()` does everything `stopPropagation()` does, plus skips any remaining listeners on the current node too.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-target-vs-current', question: 'A delegated listener is attached to a container div. Inside its handler, are `event.target` and `event.currentTarget` ever different, and if so, when?', modelAnswer: 'Yes, essentially always in delegation — `event.currentTarget` is fixed at the container the listener is attached to (that\'s the whole point of delegation), while `event.target` is whichever descendant element the click actually landed on. They\'re only equal when the click lands directly on the container itself.', skillTag: 'events' },
    { id: 'kc-trusted-events', question: 'What is the difference between a "trusted" event and a synthetic one dispatched via element.dispatchEvent()? Does trusted mean the DATA in the event is safe to use?', modelAnswer: '`event.isTrusted` is true only for events genuinely generated by the browser in response to real user/system action, and false for anything dispatched programmatically via `dispatchEvent()` — some browser APIs (like actually submitting a form) restrict certain behaviors to trusted-only events as an anti-automation measure. "Trusted" only means the browser itself generated it as a real interaction — it says nothing about whether any DATA carried by the event (like input values) is safe or expected; trust and data safety are unrelated axes.', skillTag: 'events' },
    { id: 'kc-detect-dynamic', question: 'A delegated listener attached at page load should also work for buttons added to the DOM five minutes later by other code. Why does it, without any extra work?', modelAnswer: 'Delegation relies on event bubbling, which is evaluated at dispatch time against whatever the DOM structure actually is at that moment — the listener doesn\'t need to know about specific descendants in advance, so any element matching the delegation\'s target check, even one added long after the listener was attached, will still trigger it when clicked.', skillTag: 'dom' },
  ],

  interviewQuestions: [
    'Walk through all three phases of DOM event dispatch and which listeners run in each.',
    'Explain the concrete difference between stopPropagation() and stopImmediatePropagation(), with an example where it matters.',
    'Why would a runtime security monitor specifically want a capture-phase listener instead of the default bubble phase?',
  ],
};
