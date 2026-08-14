const SITE_HTML = `
<div class="card">
  <h3>Product Feed</h3>
  <div id="product-list"></div>
</div>
`;

const INITIAL_CODE = `function installMonitor() {
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        // Runs the full integrity scan for EVERY single added node, no matter what it is.
        __expensiveScan();
        if (node.tagName === 'SCRIPT') {
          __securityAlert('critical', 'Injected <script> tag detected', 'dom-monitor');
        }
      });
    });
  });
  observer.observe(document.getElementById('product-list'), { childList: true, subtree: true });
}
`;

const TEST_SCRIPT = `(function () {
  window.__expensiveScanCalls = 0;
  var container = document.getElementById('product-list');
  installMonitor();

  var start = performance.now();
  for (var i = 0; i < 150; i++) {
    var div = document.createElement('div');
    div.className = 'product-card';
    div.textContent = 'Product ' + i;
    container.appendChild(div);
  }
  var evil = document.createElement('script');
  evil.setAttribute('data-injected', 'true');
  container.appendChild(evil);

  Promise.resolve().then(function () {
    var elapsedMs = performance.now() - start;
    var detected = __securityAlertsLog.some(function (a) { return /script/i.test(a.message); });
    var scanCalls = window.__expensiveScanCalls;
    __report({ elapsedMs: elapsedMs, detected: detected, scanCalls: scanCalls, mutatedNodeCount: 151 });
  });
})();
`;

export default {
  id: 'security-at-200ms',
  chapter: 10,
  title: 'Security at 200ms',
  type: 'performance',
  difficulty: 'advanced',
  xp: 220,
  estimatedMinutes: 25,
  runner: 'iframe',
  submissionMode: 'code',
  panels: ['alerts'],
  editorLabel: 'installMonitor()',

  objective: 'Reduce a DOM-monitoring hot path\'s overhead by narrowing what triggers expensive work, without losing detection of the thing that actually matters.',
  prerequisites: 'Chapter 8 (MutationObserver-based detection); basic idea of what "expensive per-callback work" means for perceived performance.',
  scenario: 'The skimmer-detection monitor from Chapter 8 correctly catches injected `<script>` tags — but product managers are complaining the product feed page feels laggy whenever new items load. Profiling shows the monitor\'s callback runs a full integrity scan on every single added DOM node, and a normal feed refresh adds 150 nodes at once.',
  task: 'Rewrite installMonitor() so the expensive scan only runs for nodes that could actually be dangerous (script elements) — not for every node that gets added — while still detecting the injected script.',
  expectedBehavior: 'After a burst of 150 legitimate product cards plus 1 injected script tag, the monitor still raises a security alert for the script, but the expensive scan runs only a handful of times instead of once per added node.',

  siteSnapshot: SITE_HTML,
  initialCode: INITIAL_CODE,
  testScript: TEST_SCRIPT,

  validate(runResult) {
    if (runResult.error) return { passed: false, score: { correctness: 0, performance: 0 }, feedback: [`Error: ${runResult.error}`] };
    const r = runResult.returnValue ?? {};
    const correctness = r.detected ? 1 : 0;
    const performance_ = Math.max(0, Math.min(1, 1 - Math.max(0, r.scanCalls - 3) / (r.mutatedNodeCount - 3)));
    const passed = r.detected === true && r.scanCalls <= 10;
    const feedback = [
      r.detected ? 'The injected script was still detected.' : 'Detection was lost — the monitor no longer flags the injected script at all.',
      `Expensive scan ran ${r.scanCalls} time(s) for ${r.mutatedNodeCount} added nodes (measured ${r.elapsedMs.toFixed(2)}ms wall-clock for this run — informational, not graded, since timing varies by machine).`,
      r.scanCalls <= 10 ? 'Scan call count is well within budget.' : 'Still scanning far too many nodes — narrow the condition further.',
    ];
    return { passed, score: { correctness, performance: performance_ }, feedback };
  },

  hints: [
    'Right now `__expensiveScan()` is called for every node in `mutation.addedNodes`, regardless of what that node actually is — 150 harmless `<div>`s each trigger the full expensive scan.',
    'You only actually need the expensive scan for nodes that could plausibly BE the threat. What condition already exists in the code that identifies exactly the dangerous node?',
    'Move the `__expensiveScan()` call inside the `if (node.tagName === "SCRIPT")` block instead of calling it unconditionally for every node — the scan and the alert should both be gated on the same condition.',
  ],

  solution: `function installMonitor() {
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.tagName === 'SCRIPT') {
          __expensiveScan();
          __securityAlert('critical', 'Injected <script> tag detected', 'dom-monitor');
        }
      });
    });
  });
  observer.observe(document.getElementById('product-list'), { childList: true, subtree: true });
}`,

  explanation: 'The naive version treats "run the expensive check" and "this node might be dangerous" as unrelated decisions — it runs the check unconditionally, then separately decides whether to alert. But the check\'s entire purpose is to examine nodes that might be a threat, and the codebase already has a cheap, synchronous way to identify exactly those nodes (`node.tagName === "SCRIPT"`). Gating the expensive work behind that same cheap check means 150 ordinary `<div>` nodes cost almost nothing (a tagName comparison), and the expensive scan only runs for the 1 node it can actually matter for — full detection coverage, a fraction of the cost.',

  commonWrongAnswers: [
    { description: 'Debouncing the whole observer callback with setTimeout to run less often.', why: 'This reduces callback frequency but not per-call cost — when it does run, it still scans every accumulated node just as expensively, and worse, it delays detection of a real attack by the debounce interval.' },
    { description: 'Removing `subtree: true` to reduce the mutations observed.', why: 'This might miss real injected nodes added deeper in the tree (e.g. inside a product card rather than as a direct child of the container) — it trades detection coverage for performance rather than actually making the expensive path cheaper for the cases that matter.' },
  ],

  securityImpact: 'A security monitor with a bad performance profile doesn\'t just annoy users — teams disable or narrow controls that visibly hurt UX metrics, which is a worse outcome than the control never having existed with clear expectations. Making detection cheap enough to run unconditionally on real traffic is what makes it survivable in production.',
  runtimeExplanation: 'MutationObserver callbacks already batch multiple DOM changes into one callback invocation with an array of MutationRecords, which limits how often the callback itself fires — but that batching says nothing about how expensive the code INSIDE the callback is per node it iterates. The optimization here isn\'t about batching (already provided) or debouncing (which trades latency for throughput) — it\'s about doing less conditional work per unit of already-batched input.',
  performanceNotes: 'The `elapsedMs` figure reported is real, measured via `performance.now()` around the mutation burst and its microtask settle — useful for intuition, but not what this mission grades on, because raw wall-clock timing is not reproducible across machines/CI. Grading instead counts how many times the expensive operation actually ran, which is a deterministic, machine-independent measure of the same underlying optimization.',
  sourceDefenseConnection: 'This is close to a daily reality of the role: a detection rule that is functionally correct but operationally too expensive to ship as-is. Being able to say precisely WHERE the cost comes from (per-node work multiplied by mutation volume) and fix the multiplier rather than cutting detection coverage is exactly the skill being assessed.',
  followUp: 'Add a second, cheap heuristic (checking `node.nodeType === Node.ELEMENT_NODE` before even reading `.tagName`) and explain whether it meaningfully changes the cost profile here, or whether it\'s optimizing something that was already cheap.',
  skillTags: ['performance', 'runtimeInstrumentation', 'productionReliability'],
};
