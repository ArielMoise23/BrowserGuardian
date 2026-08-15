const SNIPPET = `console.log("A: script start");

setTimeout(() => {
  console.log("B: setTimeout");
}, 0);

Promise.resolve().then(() => {
  console.log("C: promise 1");
});

queueMicrotask(() => {
  console.log("D: queueMicrotask");
});

Promise.resolve()
  .then(() => {
    console.log("E: promise 2");
  })
  .then(() => {
    console.log("F: promise 2 chained");
  });

console.log("G: script end");
`;

const EXPECTED_ORDER = ['A', 'G', 'C', 'D', 'E', 'F', 'B'];

function extractLetters(consoleLines) {
  return consoleLines
    .map((l) => {
      const match = /^([A-Z]):/.exec(l.text);
      return match ? match[1] : null;
    })
    .filter(Boolean);
}

function parsePrediction(text) {
  return (text ?? '')
    .split(/[,\n]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function scoreOrder(predicted, actual) {
  const len = Math.max(predicted.length, actual.length);
  if (len === 0) return 0;
  let matches = 0;
  for (let i = 0; i < len; i += 1) {
    if (predicted[i] && predicted[i] === actual[i]) matches += 1;
  }
  return matches / len;
}

export default {
  id: 'microtask-mayhem',
  chapter: 2,
  title: 'Microtask Mayhem',
  type: 'predict-output',
  difficulty: 'core',
  xp: 130,
  estimatedMinutes: 15,
  runner: 'worker',
  submissionMode: 'answer',
  panels: ['trace'],

  objective: 'Predict the exact ordering between synchronous code, setTimeout, Promise.then, and queueMicrotask — then see the real event loop prove or disprove your prediction step by step.',
  prerequisites: 'Chapter 1 (scope and closures), plus awareness that setTimeout and Promise callbacks do not run immediately — this mission is precisely about which one runs first and why.',
  scenario: 'A fraud-detection engineer on your team swears a diagnostic script logs in the order it\'s written. It doesn\'t, and a race in the real (much more complex) production version of this script caused a detector to read a flag before it was actually set. Before touching the real code, your lead wants everyone to nail this simplified version first.',
  task: 'Read the fixed snippet below and predict the exact order the seven log lines will print, using their A–G labels.',
  expectedBehavior: 'Type your predicted order (e.g. "A,G,C,D,E,F,B"), then press Run to execute the real snippet in the sandbox and compare against the actual call-stack/queue trace.',

  sourceCode: SNIPPET,
  initialCode: SNIPPET,

  answerSchema: [
    { id: 'order', prompt: 'Predicted console output order (comma-separated labels, e.g. "A,B,C,D,E,F,G"):', type: 'text' },
    { id: 'reasoning', prompt: 'In one or two sentences, why does the setTimeout callback (B) run last even though it was scheduled with a 0ms delay, before some of the promise callbacks were even registered?', type: 'text' },
  ],

  validate(answers, extra) {
    const actual = extractLetters(extra.consoleLines ?? []);
    const predicted = parsePrediction(answers.order);
    const fraction = scoreOrder(predicted, actual);
    const passed = fraction === 1 && predicted.length === EXPECTED_ORDER.length;
    const feedback = [
      `Actual order from this run: ${actual.join(', ') || '(run the snippet first)'}`,
      `Your predicted order: ${predicted.join(', ') || '(nothing submitted)'}`,
    ];
    return { passed, score: { correctness: fraction }, feedback };
  },

  hints: [
    'Split the seven lines into three buckets: runs synchronously (no delay), runs as a microtask (Promise.then / queueMicrotask), or runs as a macrotask (setTimeout).',
    'ALL synchronous code finishes before ANY microtask or macrotask runs — so the two plain console.log calls (A and G) both happen before C, D, E, F, or B, regardless of what order they visually appear relative to the promises.',
    'The full microtask queue drains completely — including microtasks scheduled by other microtasks while it drains — before the event loop even looks at the macrotask (setTimeout) queue. That\'s why the chained .then (F) sneaks in before the "0ms" timeout (B), even though F is scheduled later in wall-clock terms.',
  ],

  solution: 'A, G, C, D, E, F, B — sync code first (A, G), then the microtask queue drains in FIFO scheduling order (C, D, E — with F appended mid-drain once E resolves its chained promise), and only once the microtask queue is fully empty does the event loop run the setTimeout macrotask (B).',

  explanation: 'Two plain `console.log` calls run synchronously, immediately, in source order: A then G. Everything else is scheduled, not executed, during that synchronous pass. `Promise.resolve().then(C)` and `queueMicrotask(D)` both schedule microtasks, in the order they were called: C, then D. The chained promise schedules E as a microtask too (at the same "already resolved" point, right after D), but F is NOT scheduled yet — F only gets scheduled once E\'s handler actually runs and its return value resolves the chained promise. The event loop drains the ENTIRE microtask queue before doing anything else: C runs, D runs, E runs (which appends F to the now-shorter queue), and then F runs too, all before control ever returns to the macrotask queue. Only after the microtask queue is completely empty does the engine pick up the next macrotask: the setTimeout callback, B — last, even though it was "scheduled" with 0ms delay before three of the promise callbacks were even created.',

  commonWrongAnswers: [
    { description: 'Predicting B runs right after A/G because "0ms delay" sounds instant.', why: 'setTimeout, even with a 0ms delay, is still a macrotask. The spec guarantees the entire microtask queue drains before the next macrotask runs, regardless of the requested timer delay — timers are a minimum delay, and microtask priority always wins.' },
    { description: 'Predicting F runs after B because F "was scheduled later".', why: 'F is scheduled DURING the microtask drain (as a consequence of E resolving), and newly-queued microtasks are still processed within the same drain before the loop ever reaches macrotasks — "scheduled later in wall-clock terms" does not mean "runs later" once you\'re inside an active microtask drain.' },
  ],

  securityImpact: 'Ordering assumptions like this are exactly where race conditions in runtime security instrumentation come from. If code that sets a flag is scheduled as a macrotask, but the detector reading that flag is scheduled as a microtask, the detector runs first and reads a stale value — even though the flag-setting code looks like it comes "before" the detector in source order. The result is a false negative or a thrown exception on production traffic, not a visible warning during development.',
  runtimeExplanation: 'This ordering (sync → drain the full microtask queue → run one macrotask → drain the microtask queue again → repeat) is not one single spec\'s doing — it spans two layers. ECMAScript defines Promise reactions and `queueMicrotask` callbacks as "Jobs" on a microtask queue, but the language spec has no concept of an event loop or of `setTimeout`. The HTML Standard defines the event loop itself, including the rule that a full "microtask checkpoint" (draining the ECMAScript job queue completely) happens after every task — that interleaving is the HTML Standard reaching into the ECMAScript-defined microtask mechanism, not something either spec fully owns alone. It is guaranteed behavior either way, not an implementation detail — just not a single-spec one.',
  sourceDefenseConnection: 'A huge amount of runtime instrumentation code is async — awaiting a policy decision, batching telemetry with a microtask, debouncing a MutationObserver callback. Misjudging task vs microtask ordering is one of the most common sources of subtle, hard-to-reproduce bugs in that kind of code, and interviewers use exactly this kind of snippet to check whether a candidate actually understands the event loop or just memorized "microtasks before macrotasks" as a slogan.',
  followUp: 'Add an `async function` that `await`s a resolved promise and logs before/after the await, into the same snippet. Predict where its two log lines land in the full order, then verify.',
  skillTags: ['asyncEventLoop', 'runtime'],
};
