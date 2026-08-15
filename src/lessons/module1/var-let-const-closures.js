const HANDLERS_CODE = `const handlers = [];
for (var i = 0; i < 3; i++) {
  handlers.push(function () {
    console.log("Handler for item " + i);
  });
}
handlers.forEach(function (fn) { fn(); });`;

const TOAST_BUGGY_CODE = `function queueToasts(messages) {
  for (var i = 0; i < messages.length; i++) {
    setTimeout(function () {
      console.log("Toast: " + messages[i]);
    }, i * 10);
  }
}

queueToasts(["Saved", "Synced", "Done"]);
`;

const TOAST_EXPECTED = ['Toast: Saved', 'Toast: Synced', 'Toast: Done'];

const COUNTER_SKELETON = `function createCounter() {
  // Return an object with increment(), decrement(), and value() methods.
  // The running count must live only inside this closure — there should be no
  // way for outside code to read or overwrite it except through these methods.
}
`;

const COUNTER_TEST_SCRIPT = `(function () {
  var counter = createCounter();
  var results = {};
  results.hasIncrement = typeof counter.increment === 'function';
  results.hasDecrement = typeof counter.decrement === 'function';
  results.hasValue = typeof counter.value === 'function';
  if (results.hasIncrement) { counter.increment(); counter.increment(); counter.increment(); }
  if (results.hasDecrement) counter.decrement();
  results.valueAfterOps = results.hasValue ? counter.value() : undefined;
  __report(results);
})();
`;

const EXAMPLE_CODE = `console.log("--- var loop ---");
for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log("var i =", i);
  }, 0);
}

console.log("--- let loop ---");
for (let j = 0; j < 3; j++) {
  setTimeout(function () {
    console.log("let j =", j);
  }, 0);
}
`;

export default {
  id: 'var-let-const-closures',
  moduleId: 'scope-execution-closures',
  title: 'var, let, const, and Closures in Loops',
  estimatedMinutes: 25,
  difficulty: 'foundational',
  prerequisites: [],
  relatedMissionIds: ['closure-incident'],
  skillTags: ['fundamentals', 'runtime'],

  whyItMatters: {
    development: 'This is the single most common source of "impossible" bugs in loop-heavy async code — event handlers, timers, and callbacks that all somehow report the same wrong value. You will hit this constantly once you\'re reading code with loops that register callbacks.',
    security: 'Runtime security instrumentation is full of exactly this pattern: registering one callback per script, per DOM node, or per request inside a loop. A scope bug here doesn\'t crash — it silently misattributes behavior to the wrong entity, which in a security monitor means blaming the wrong script for an action.',
    sourceDefense: 'You will be reading and writing instrumentation code full of loops that register listeners and callbacks. Getting var/let/closure semantics automatic — not something you have to reason through slowly — is table stakes for that work.',
  },

  mentalModel: {
    explanation: 'Every variable binding lives in a lexical environment — a record of names-to-values tied to a specific scope. `var` declarations are attached to the nearest FUNCTION (or global) environment, no matter how deeply nested inside blocks (if/for/while) they appear — a `for` loop does not create a new environment for `var`. `let`/`const` are attached to the nearest BLOCK environment, and critically, the specification defines `for (let ...)` as creating a genuinely fresh lexical environment for EACH iteration of the loop — a new binding, initialized by copying the previous iteration\'s value, not the same binding mutated in place. That\'s the entire mechanism behind "each closure gets its own let, but they all share one var" — it\'s not a special-case rule for closures, it\'s a direct consequence of how many environments exist.',
    distinctions: [
      { label: 'ECMAScript spec', text: 'The per-iteration environment for `for (let ...)` is explicitly defined in the ECMAScript spec (CreatePerIterationEnvironment) — this is guaranteed language behavior, identical across every conforming engine, not a browser feature.' },
      { label: 'Simplified model', text: '"Hoisting moves declarations to the top of the function" is the common shorthand. More precisely: during a creation phase, before any code runs, the whole scope is scanned for declarations — `var` bindings are created and initialized to `undefined` immediately; `let`/`const` bindings are created but left uninitialized (the Temporal Dead Zone) until their declaration statement actually executes.' },
      { label: 'Implementation detail', text: 'Whether an engine literally allocates a new heap-backed environment object per loop iteration, or optimizes it away when no closure actually captures the variable, is up to the engine (V8 does optimize this when it can prove no closure escapes). The OBSERVABLE behavior — each iteration\'s closures see their own value — is guaranteed regardless; how the engine achieves it is not something the spec mandates.' },
    ],
  },

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'Predict all six log lines, in order — both which loop\'s messages come first (given both loops schedule 0ms timers) and what the i/j values will be for each.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'predict-var-handlers',
      title: 'Predict: var-scoped handlers',
      type: 'predict',
      instructions: 'Read the code below (don\'t run it yet) and predict what the three handler calls will log.',
      runner: 'worker',
      submissionMode: 'answer',
      sourceCode: HANDLERS_CODE,
      initialCode: HANDLERS_CODE,
      answerSchema: [
        { id: 'prediction', prompt: 'What do the three console.log calls print?', type: 'select', options: ['0, 1, 2', '1, 1, 1', '2, 2, 2', '3, 3, 3', 'undefined, undefined, undefined'] },
        { id: 'why', prompt: 'In one sentence, why?', type: 'text' },
      ],
      validate(answers) {
        const correct = answers.prediction === '3, 3, 3';
        const why = (answers.why ?? '').toLowerCase();
        const explainedWhy = ['shared', 'same binding', 'one binding', 'closure', 'function-scoped', 'single'].some((k) => why.includes(k));
        const score = (correct ? 0.7 : 0) + (explainedWhy ? 0.3 : 0);
        return {
          passed: correct && explainedWhy,
          score: { correctness: score },
          feedback: [
            correct ? 'Correct value.' : 'Not quite — run it and check the console panel.',
            explainedWhy ? 'Good explanation of why.' : 'Try mentioning what all three closures actually share.',
          ],
        };
      },
      hints: [
        'All three functions pushed into `handlers` are created inside the same loop — do they each get their own `i`, or share one?',
        '`var i` is function-scoped (really: scoped to the whole top-level script here), not scoped to the loop body — there is exactly one `i` for the entire loop.',
      ],
      solution: '3, 3, 3 — because all three closures share the single `var i` binding, and by the time `handlers.forEach` actually calls them, the loop (and the loop\'s final increment) has already finished, leaving `i` at 3.',
      explanation: 'Each `function () { console.log(...) }` is a closure over the SAME `i` — not a snapshot of its value at creation time, but a live reference to the one binding. Every closure prints whatever `i` holds at the moment it\'s CALLED, which is after the whole loop has already run to completion.',
    },
    {
      id: 'repair-toast-queue',
      title: 'Modify: repair the toast queue',
      type: 'modify',
      instructions: 'queueToasts is supposed to log each message in order, staggered by a short delay. Right now it logs "Toast: undefined" three times. Fix it.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: TOAST_BUGGY_CODE,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const actual = (runResult.consoleHistory ?? []).map((l) => l.text);
        const matches = actual.length === TOAST_EXPECTED.length && TOAST_EXPECTED.every((line, i) => actual[i] === line);
        return { passed: matches, score: { correctness: matches ? 1 : 0 }, feedback: [`Actual output: ${actual.join(' | ') || '(nothing)'}`] };
      },
      hints: [
        'Same root cause as the prediction lab above — `messages[i]` is read inside a callback that only runs after the loop has already finished.',
        'The fix is the same shape too: give each iteration its own binding (change `var i` to `let i`), or pass `i` (or `messages[i]`) into the timer callback explicitly.',
      ],
      solution: `function queueToasts(messages) {
  for (let i = 0; i < messages.length; i++) {
    setTimeout(function () {
      console.log("Toast: " + messages[i]);
    }, i * 10);
  }
}

queueToasts(["Saved", "Synced", "Done"]);`,
      explanation: 'Switching `var i` to `let i` gives each loop iteration its own lexical binding, so each scheduled timer callback closes over a different `i` — and therefore reads a different, correct element of `messages`.',
    },
    {
      id: 'implement-private-counter',
      title: 'Implement: private counter via closure',
      type: 'implement',
      instructions: 'Implement createCounter() so it returns an object with increment(), decrement(), and value() methods, sharing one private running count that cannot be reached any other way.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: COUNTER_SKELETON,
      testScript: COUNTER_TEST_SCRIPT,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const checks = [r.hasIncrement, r.hasDecrement, r.hasValue, r.valueAfterOps === 2];
        const fraction = checks.filter(Boolean).length / checks.length;
        return {
          passed: fraction === 1,
          score: { correctness: fraction },
          feedback: [
            r.hasIncrement ? 'increment() exists.' : 'Missing increment().',
            r.hasDecrement ? 'decrement() exists.' : 'Missing decrement().',
            r.hasValue ? 'value() exists.' : 'Missing value().',
            `After 3 increments and 1 decrement, value() returned ${JSON.stringify(r.valueAfterOps)} (expected 2).`,
          ],
        };
      },
      hints: [
        'Declare the count as a local variable inside createCounter, not as a property on the returned object — a property would be directly readable/writable from outside.',
        'Return an object literal whose three methods all close over that same local variable.',
      ],
      solution: `function createCounter() {
  let count = 0;
  return {
    increment: function () { count += 1; return count; },
    decrement: function () { count -= 1; return count; },
    value: function () { return count; },
  };
}`,
      explanation: 'The three returned methods all close over the same `count` variable, so calls through any of them observe and mutate the same private state — but nothing outside `createCounter` has any way to name `count` directly. This is the closure-based equivalent of a private class field, and predates private fields in the language by well over a decade.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-hoisting', question: 'Explain the difference between how `var`, `let`, and function declarations behave when accessed before their declaration line runs.', modelAnswer: '`var` is hoisted and initialized to `undefined` immediately, so accessing it early gives `undefined`, not an error. `let`/`const` are also hoisted in the sense that the engine knows about the binding from the start of the block, but they\'re left uninitialized — in the "Temporal Dead Zone" — until their declaration statement actually executes; accessing them before that point throws a `ReferenceError`, not just `undefined`. Function declarations (`function foo() {}`, not expressions assigned to a variable) are hoisted differently again: the ENTIRE function — name and implementation — is available from the top of the enclosing scope, so calling `foo()` before its declaration line works normally. That\'s a third, distinct behavior, not a variant of `var` hoisting.', skillTag: 'fundamentals' },
    { id: 'kc-why-shared', question: 'In your own words: why does a `var`-based for-loop with a closure inside it end up with every closure seeing the same final value?', modelAnswer: '`var` is function-scoped, so there is exactly one binding for the whole function, no matter how many loop iterations create closures over it. All those closures are closing over that single shared binding, not a snapshot — so by the time any of them actually run (usually after the loop is fully done), they all see whatever value is currently in that one binding.', skillTag: 'fundamentals' },
    { id: 'kc-private-counter', question: 'In the private-counter lab, why can\'t code outside createCounter read or overwrite `count` directly?', modelAnswer: '`count` is a local variable inside `createCounter`\'s function scope, not a property of any object. The only things that can reference it are the functions defined inside that same scope (the closures) — since it was never assigned as a property of the returned object, there is no path from outside code to that binding at all.', skillTag: 'runtime' },
  ],

  interviewQuestions: [
    'Explain the difference in hoisting behavior between var, let, const, and function declarations.',
    'Walk through exactly why all three timers in a var-based loop log the same final value, step by step.',
    'How would you implement a private counter using closures instead of a class with a private field — and what\'s the actual tradeoff between the two approaches?',
  ],
};
