const SITE_HTML = `
<div class="card">
  <h3>Cart</h3>
  <ul id="cart-list">
    <li class="cart-item"><span class="cart-item__name">Widget</span> <button class="remove-btn">Remove <span class="icon">&#10005;</span></button></li>
    <li class="cart-item"><span class="cart-item__name">Gadget</span> <button class="remove-btn">Remove <span class="icon">&#10005;</span></button></li>
  </ul>
</div>
`;

const BUGGY_CODE = `document.getElementById('cart-list').addEventListener('click', function (event) {
  if (event.target.className === 'remove-btn') {
    var item = event.target.closest('.cart-item');
    console.log('Removed item: ' + item.querySelector('.cart-item__name').textContent);
    item.remove();
  }
});
`;

const TEST_SCRIPT = `(function () {
  var beforeCount = document.querySelectorAll('.cart-item').length;
  __dispatchTracedEvent('.remove-btn .icon', 'click');
  var afterCount = document.querySelectorAll('.cart-item').length;
  var removed = (beforeCount - afterCount) === 1;
  var loggedRemoval = __consoleHistory.some(function (e) { return /removed/i.test(e.text); });
  __report({ removed: removed, loggedRemoval: loggedRemoval, beforeCount: beforeCount, afterCount: afterCount });
})();
`;

export default {
  id: 'disappearing-click',
  chapter: 3,
  title: 'The Disappearing Click',
  type: 'debugging',
  difficulty: 'core',
  xp: 140,
  estimatedMinutes: 20,
  runner: 'iframe',
  submissionMode: 'code',
  panels: ['dom', 'eventPath'],
  editorLabel: 'Cart delegation handler',

  objective: 'Debug a broken event-delegation handler by understanding the difference between event.target and the element a listener is actually attached to, and fix it so clicks work regardless of exactly which descendant element they land on.',
  prerequisites: 'Chapter 1 fundamentals; basic addEventListener usage.',
  scenario: 'Support tickets are piling up: "Remove doesn\'t work — I have to click the text, not the X icon." The checkout team delegated a single click listener to the cart container instead of one per row (good instinct — fewer listeners, works for dynamically added rows), but the click sometimes just... disappears.',
  task: 'Fix the delegated click handler on #cart-list so clicking anywhere inside a "Remove" button — including its icon — removes that cart row and logs which item was removed.',
  expectedBehavior: 'Clicking the ✕ icon inside a Remove button removes that row from the cart and logs "Removed item: <name>" — not just clicking the button\'s text.',

  siteSnapshot: SITE_HTML,
  initialCode: BUGGY_CODE,
  testScript: TEST_SCRIPT,

  validate(runResult) {
    if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
    const r = runResult.returnValue ?? {};
    const feedback = [`Cart items before: ${r.beforeCount}, after: ${r.afterCount}.`, r.loggedRemoval ? 'A removal was logged.' : 'No removal was logged to the console.'];
    const passed = !!r.removed && !!r.loggedRemoval;
    return { passed, score: { correctness: passed ? 1 : 0 }, feedback };
  },

  hints: [
    'The listener is attached to #cart-list (that\'s `currentTarget`), but `event.target` is whatever element the click actually landed on — which, for a click on the icon, is the `<span class="icon">`, not the `<button class="remove-btn">`.',
    '`event.target.className === "remove-btn"` is an exact-match check on whatever was clicked. It only works when the click lands directly on the button itself, never on a descendant like the icon span.',
    'Use `event.target.closest(".remove-btn")` instead — `closest()` walks up from the actual click target through its ancestors looking for a match, so it finds the button whether the click landed on the button, the icon, or any other descendant.',
  ],

  solution: `document.getElementById('cart-list').addEventListener('click', function (event) {
  var btn = event.target.closest('.remove-btn');
  if (!btn) return;
  var item = btn.closest('.cart-item');
  console.log('Removed item: ' + item.querySelector('.cart-item__name').textContent);
  item.remove();
});`,

  explanation: 'Event delegation relies on one listener attached to an ancestor, using `event.target` (the actual element the event originated on) to figure out which descendant was really interacted with. The bug here does an exact `===` comparison against `event.target.className`, which only matches if the click lands precisely on the button element — any click on a descendant of the button (like the icon span) makes `event.target` that descendant instead, and the check silently fails. `event.currentTarget` stays fixed at `#cart-list` throughout (it\'s whichever element the listener is attached to), which is why relying on `currentTarget` here wouldn\'t help distinguish rows either — the fix is `closest()`, which searches upward from the real target for the nearest matching ancestor.',

  commonWrongAnswers: [
    { description: 'Attaching a separate click listener to every "Remove" button instead of fixing delegation.', why: 'This works, but throws away the reason delegation was chosen — it won\'t auto-attach to rows added later without re-running setup code, and it\'s the "fix" that avoids understanding the actual bug rather than fixing it.' },
    { description: 'Checking `event.target.parentElement.className === "remove-btn"`.', why: 'This only handles exactly one level of nesting. If the icon itself had a nested element (or the button markup changed depth), it would break again — closest() is robust to arbitrary nesting depth by design.' },
  ],

  securityImpact: 'Event delegation is everywhere in real checkout/payment UIs, and it\'s also exactly where formjacking scripts attach their own listeners to skim input — understanding precisely how target/currentTarget/delegation work is a prerequisite for later missions where you need to reason about what a malicious listener can and can\'t see about which element was actually interacted with.',
  runtimeExplanation: '`event.target` is fixed for the lifetime of a given dispatched event — it\'s always the actual originating element, set once at dispatch time, and does not change as the event propagates through capturing, target, and bubbling phases. `event.currentTarget` changes as the event moves through the propagation path — it\'s always whichever element the currently-executing listener is attached to. `closest(selector)` is a DOM traversal method, walking from the element itself up through `parentElement` chain, returning the nearest ancestor (or the element itself) matching the selector, or null.',
  sourceDefenseConnection: 'Runtime instrumentation that hooks `addEventListener` needs this exact distinction to correctly attribute "what was clicked" versus "which listener fired" — get target/currentTarget confused and a behavioral detector will misreport what a script actually interacted with.',
  followUp: 'Extend the fix so clicking the item name (not the remove button at all) does nothing, but add a *second* delegated listener that logs a "viewed item" event when the name span itself is clicked — without either listener interfering with the other.',
  skillTags: ['events', 'dom', 'debugging'],
};
