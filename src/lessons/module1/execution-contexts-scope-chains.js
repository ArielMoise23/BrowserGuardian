const ENV_SNIPPET = `var globalVar = "global";

function outer() {
  var outerVar = "outer";
  if (true) {
    let blockVar = "block";
    function inner() {
      var innerVar = "inner";
      console.log(globalVar, outerVar, blockVar, innerVar);
    }
    inner();
  }
}
outer();`;

const ENV_OPTIONS = ['Global environment', 'outer() function environment', 'if-block environment', 'inner() function environment'];

const LABELER_BUGGY = `function createLabeler(heavyData) {
  // Closes over the WHOLE heavyData object just to read one field later.
  return function () {
    return "Label: " + heavyData.label;
  };
}
`;

const LABELER_TEST_SCRIPT = `(function () {
  var heavyData = { label: "Original", payload: [] };
  var labelFn = createLabeler(heavyData);
  var first = labelFn();
  heavyData.label = "Mutated";
  var second = labelFn();
  __report({ first: first, second: second });
})();
`;

const SHADOW_SNIPPET = `let value = "global";

function outer() {
  let value = "outer";
  function middle() {
    function inner() {
      console.log(value);
    }
    inner();
  }
  middle();
}

outer();`;

const EXAMPLE_CODE = `let value = "global";

function outer() {
  let value = "outer";
  function inner() {
    console.log("inner sees:", value);
  }
  inner();
  console.log("outer sees:", value);
}

outer();
console.log("global sees:", value);
`;

/** @type {import('../../game/lessonSchema.js').LessonContent} */
export default {
  id: 'execution-contexts-scope-chains',
  moduleId: 'scope-execution-closures',
  title: 'Execution Contexts and Scope Chains',
  estimatedMinutes: 20,
  difficulty: 'foundational',
  prerequisites: ['var-let-const-closures'],
  relatedMissionIds: ['closure-incident'],
  skillTags: ['fundamentals', 'runtime'],

  explanation: [
    'Every time a function runs, JavaScript creates an execution context — a runtime record of which names exist and what they refer to — with a pointer back to whichever scope it is physically nested inside in the source code. Looking up a variable means following that chain of pointers outward until something matches; which function called the current one never enters into it, only where the code was written. Scope and execution context are related but distinct: scope is a static property of the source, fixed before anything runs, while an execution context is created fresh on every call — calling the same function three times produces three separate execution contexts that all still share exactly the same scope.',
    'An execution context bundles a LexicalEnvironment (where `let`/`const`/function declarations live, plus a reference to the parent environment), a VariableEnvironment (where `var` and function declarations live), and a `this` binding. The "scope chain" is just that outward walk: start at the current environment, and if a name is not found, follow the parent reference outward until reaching the global environment or finding a match. This is lexical (static) scoping — it never depends on who called the function, only on where the code was written.',
    'A closure retains a reference to the variable it closes over, not a copy of its value — so if that variable holds a large object, the closure keeps the entire object reachable for as long as it exists, even if its code only reads one field. Extracting just the value you need into its own local variable, instead of closing over the object that contains it, fixes this: it changes what gets captured from a reference to the whole object into a copy of one primitive value.',
    'This has a real security angle: a value assigned only to a local variable inside a closure — an API key fetched once and used only by an inner submit handler — is unreachable by any other script on the page, however it inspects globals or the DOM, because scope-chain lookup only grants access lexically. The same retention mechanism is why instrumentation code (a wrapped fetch, a MutationObserver callback) that closes over more than it needs is a common source of unbounded memory growth in a monitor running for an entire page session.',
  ],

  distinctions: [
    { label: 'ECMAScript spec', text: 'Execution contexts, Environment Records, and the outer-environment-reference chain are precisely defined in the spec. "Scope chain" is just the informal name developers use for this reference chain.' },
    { label: 'Simplified model', text: 'Thinking of scope as nested boxes, each linked to the box outside it, is accurate and useful — just remember the boxes are created per function CALL, not per function definition. Calling the same function twice creates two separate boxes.' },
    { label: 'Implementation detail', text: 'Whether an engine physically allocates a heap object per environment, or optimizes it away when no closure escapes, is up to the engine — the observable behavior is guaranteed regardless of how it is implemented.' },
  ],

  tldr: [
    'An execution context is created fresh on every function call; scope itself is static, fixed by where code is written in the source.',
    'Scope-chain lookup is lexical: it walks outward through enclosing scopes based on source structure, never based on which function called the current one.',
    'A closure retains a reference to the variable it closes over, not a snapshot — closing over a big object keeps the whole object alive even if only one field is read.',
    'A value never assigned to anything reachable outside its closure cannot be read by other scripts on the page, no matter how they inspect globals or the DOM.',
  ],

  example: {
    runner: 'worker',
    code: EXAMPLE_CODE,
    predictPrompt: 'Three console.log calls reference `value` from three different execution contexts. Predict what each one prints.',
  },
  panels: ['trace'],

  labs: [
    {
      id: 'identify-environments',
      title: 'Identify: which environment holds each binding',
      type: 'predict',
      instructions: 'Match each variable to the environment it actually lives in.',
      runner: 'worker',
      submissionMode: 'answer',
      sourceCode: ENV_SNIPPET,
      initialCode: ENV_SNIPPET,
      answerSchema: [
        { id: 'globalVar', prompt: 'globalVar lives in:', type: 'select', options: ENV_OPTIONS },
        { id: 'outerVar', prompt: 'outerVar lives in:', type: 'select', options: ENV_OPTIONS },
        { id: 'blockVar', prompt: 'blockVar lives in:', type: 'select', options: ENV_OPTIONS },
        { id: 'innerVar', prompt: 'innerVar lives in:', type: 'select', options: ENV_OPTIONS },
      ],
      validate(answers) {
        const correct = {
          globalVar: 'Global environment',
          outerVar: 'outer() function environment',
          blockVar: 'if-block environment',
          innerVar: 'inner() function environment',
        };
        const keys = Object.keys(correct);
        const matches = keys.filter((k) => answers[k] === correct[k]).length;
        const fraction = matches / keys.length;
        return { passed: fraction === 1, score: { correctness: fraction }, feedback: [`${matches}/${keys.length} correct.`] };
      },
      hints: [
        '`var` and function declarations attach to the nearest FUNCTION environment, regardless of how many blocks (if/for/while) they\'re nested inside.',
        '`let` attaches to the nearest BLOCK environment — the `if (true) { ... }` block genuinely creates its own environment for `blockVar`.',
      ],
      solution: 'globalVar → Global; outerVar → outer() function environment (var ignores the if-block); blockVar → the if-block environment (let respects it); innerVar → inner() function environment.',
      explanation: '`var outerVar` is declared inside an `if` block, but `var` doesn\'t care about blocks — it attaches to the nearest function (or global) environment, so it lives in `outer()`\'s environment. `let blockVar` DOES respect the block, so it genuinely lives in the if-block\'s own environment, inaccessible outside it.',
    },
    {
      id: 'fix-retained-reference',
      title: 'Fix: closure retaining a live reference it doesn\'t need',
      type: 'modify',
      instructions: 'createLabeler only ever needs heavyData.label, but its returned closure holds onto the entire heavyData object — so later mutations to heavyData leak into results that should have been fixed at creation time. Fix it so the returned function is unaffected by later mutation of heavyData.',
      runner: 'worker',
      submissionMode: 'code',
      initialCode: LABELER_BUGGY,
      testScript: LABELER_TEST_SCRIPT,
      validate(runResult) {
        if (runResult.error) return { passed: false, score: { correctness: 0 }, feedback: [`Error: ${runResult.error}`] };
        const r = runResult.returnValue ?? {};
        const passed = r.first === 'Label: Original' && r.second === 'Label: Original';
        return {
          passed,
          score: { correctness: passed ? 1 : 0 },
          feedback: [`Before mutation: ${r.first}`, `After mutating heavyData.label: ${r.second}`],
        };
      },
      hints: [
        'Right now the returned function reads `heavyData.label` every time it\'s called — that\'s a live reference to the whole object, not a snapshot of the value.',
        'Read `heavyData.label` into a local variable ONCE, inside createLabeler, before returning the function — then have the returned function reference that local variable instead of `heavyData` itself.',
      ],
      solution: `function createLabeler(heavyData) {
  var label = heavyData.label;
  return function () {
    return "Label: " + label;
  };
}`,
      explanation: 'The fixed version closes over a small, independent local variable (`label`, a string) instead of the entire `heavyData` object. That one change is the difference between a closure that retains only the primitive value it actually needs and one that keeps the whole (possibly large, possibly still-mutating) object alive for as long as the closure exists — exactly the pattern behind real closure-based memory retention.',
    },
    {
      id: 'predict-shadowing',
      title: 'Predict: scope-chain lookup through shadowing',
      type: 'predict',
      instructions: 'inner() references `value`, but never declares it. Predict which `value` it resolves to.',
      runner: 'worker',
      submissionMode: 'answer',
      sourceCode: SHADOW_SNIPPET,
      initialCode: SHADOW_SNIPPET,
      answerSchema: [
        { id: 'prediction', prompt: 'What does console.log(value) print?', type: 'select', options: ['global', 'outer', 'undefined', 'ReferenceError'] },
        { id: 'why', prompt: 'Why — in terms of the scope chain?', type: 'text' },
      ],
      validate(answers) {
        const correct = answers.prediction === 'outer';
        const why = (answers.why ?? '').toLowerCase();
        const explained = ['scope chain', 'nearest', 'walks up', 'outward', 'enclosing'].some((k) => why.includes(k));
        const score = (correct ? 0.7 : 0) + (explained ? 0.3 : 0);
        return { passed: correct && explained, score: { correctness: score }, feedback: [`Actual answer: "outer".`] };
      },
      hints: [
        '`inner` and `middle` don\'t declare their own `value` — the lookup has to walk outward through the scope chain to find one that does.',
        'The nearest ENCLOSING function that actually declares `value` is `outer`, not the global scope — lookup stops at the first match it finds, however far out that is.',
      ],
      solution: '"outer" — `inner` and `middle` have no `value` binding of their own, so the lookup walks outward through the scope chain and stops at the first environment that declares one, which is `outer`\'s.',
      explanation: 'The scope chain lookup is purely lexical (based on where the code is written, not who called it) and stops at the FIRST match found while walking outward — it never continues past a match to check for another one further out, and it never considers the call stack.',
    },
  ],

  knowledgeCheck: [
    { id: 'kc-exec-context', question: 'What three things does an execution context bundle together?', modelAnswer: 'A LexicalEnvironment (where let/const/class and function declarations in this scope live, plus a reference to the parent environment), a VariableEnvironment (where var and function declarations live), and a this binding.', skillTag: 'runtime' },
    { id: 'kc-lookup-direction', question: 'Does scope-chain lookup ever depend on which function called the current one? Why or why not?', modelAnswer: 'No — JavaScript uses lexical (static) scoping, so lookup only follows the chain of environments based on where the code was physically written, walking outward through enclosing function/block scopes. It never looks at the call stack or which function happened to invoke the current one (that would be dynamic scoping, which JS does not use for variable lookup).', skillTag: 'runtime' },
    { id: 'kc-retention', question: 'Why does a closure that references a large object, but only actually uses one of its fields, still keep the ENTIRE object alive?', modelAnswer: 'A closure retains a reference to the variable it closes over, not a copy of whatever value that variable currently holds — so if the closed-over variable holds a reference to a large object, the closure keeps that whole object reachable (and therefore un-collectible) for as long as the closure itself exists, regardless of how much of the object the closure\'s code actually reads. Extracting just the needed field into its own local variable before returning the closure changes what\'s captured from "a reference to the object" to "a copy of one primitive value," which breaks that retention.', skillTag: 'runtime' },
  ],

  interviewQuestions: [
    'What is the difference between an execution context and a scope? Are they the same thing?',
    'Explain, step by step, how a variable reference is resolved through the scope chain when it\'s not declared in the current function.',
    'Give a concrete example of a closure that accidentally retains more memory than it needs to, and explain the fix.',
  ],
};
