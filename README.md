# Browser Guardian: Runtime Defense Lab

A hands-on JavaScript runtime, browser-internals, and browser-security training
game — built to prepare for a JavaScript Security Engineer role (the kind of work
Source Defense does: instrumenting and protecting first-party pages against
malicious/compromised third-party JavaScript).

It is not a quiz app. Every mission runs real, instrumented code in a real sandbox —
a dedicated Web Worker or a sandboxed `<iframe>` — and every panel (console, call
stack, task/microtask queues, DOM inspector, network activity, security alerts) is
populated from that real execution, not scripted text.

Vanilla HTML/CSS/JS throughout. No framework, no build step, no external
dependencies. `localStorage` for all progress.

## Quick start

```bash
node server.js      # or: npm start
```

Then open **http://localhost:8080/**. A dev server is required because the app
uses ES modules and a sandboxed iframe with `srcdoc`-style loading — both need
`http://`, not `file://`.

Requires Node.js ≥ 18 (uses the built-in `node:test` runner and no other
dependencies — `npm install` has nothing to install).

Run the automated tests:

```bash
npm test
```

## What's actually in this build (vertical slice)

This is a complete, working game engine plus **8 fully playable missions**
spanning chapters 1, 2, 3, 6, 7, 8, and 10 of the curriculum below. Chapters 4, 5,
9, and the boss battle are visible on the mission map (so the full intended
curriculum is legible) but marked "content pending" — they are **not** stubbed
with fake content; they simply have no missions yet. See "Adding a mission" below
for how the remaining chapters would be filled in using the same schema.

The 8 missions:

| # | Mission | Chapter | Type | Sandbox |
|---|---|---|---|---|
| 1 | The Closure Incident | 1 — Runtime Reboot | code-repair | Worker |
| 2 | Microtask Mayhem | 2 — Execution Under the Hood | predict-output | Worker |
| 3 | The Disappearing Click | 3 — DOM and Events | debugging | iframe |
| 4 | Third-Party Checkout | 6 — Script Loading | threat-modeling | iframe |
| 5 | The Silent Skimmer | 7 — Client-Side Attacks | attack-investigation | iframe |
| 6 | Wrap Fetch Without Breaking It | 8 — Runtime Security Engineering | runtime-defense | Worker |
| 7 | The False Positive | 8 — Runtime Security Engineering | architecture-decision | iframe |
| 8 | Security at 200ms | 10 — Performance & Reliability | performance | iframe |

Each mission includes: objective, prerequisites, scenario, initial code, task,
expected behavior, automated validation, 3+ progressive hints, a full solution and
explanation, common wrong answers (with *why* they're wrong), security impact,
runtime/browser explanation, performance notes where relevant, a "why this matters
at Source Defense" section, and a follow-up challenge.

Also included: a chapter map with XP/levels/streaks/achievements, an Interview
Mode (free-text answer → model answer → self-scored → per-category skill ratings
→ session summary with recommended next missions), and a Settings screen with a
confirmed progress reset.

## Architecture

```
index.html                  Shell + panel/header/footer structure
server.js                   Zero-dependency static file server (dev only)
styles/                     tokens.css (theme), layout, components, panels, motion
src/
  app.js                    Entry point — starts the router, live header status
  router.js                 Hash router: #/map #/mission/:id #/interview #/settings
  state/
    store.js                Observable store; the only place state actually changes
    persistence.js          localStorage read/write, versioned schema, migration stub
    progress.js             Pure functions: XP/level curve, streaks, mission records
    skills.js                Pure functions: per-category EWMA skill ratings
    achievements.js          Declarative achievement rules
  game/
    missionSchema.js        Mission shape + validateMission() — fails loudly, at
                             load time, if a mission is missing required content
    missionRegistry.js       Imports every mission file; the only enumeration point
    scoring.js               correctness/security/compatibility/performance → composite
    hints.js                 Progressive hint reveal state machine
    chapters.js               Chapter metadata for the map
    interviewBank.js          Interview-mode question bank + selection logic
  missions/chapterN/*.js     One file per mission (see schema below)
  sandbox/
    protocol.js              Shared postMessage envelope + validation
    worker-sandbox.js         Host-side driver for the Worker sandbox
    worker-runtime.js         Code that runs INSIDE the Worker
    iframe-sandbox.js         Host-side driver for the sandboxed-iframe sandbox
    iframe-runtime.html       Document loaded INSIDE the sandboxed iframe
  simulators/                Pure rendering/transform logic for each panel
  components/                UI: chapter map, mission view, code editor, all panels
  utils/                     el()/mount() DOM helpers, pubsub, formatting
tests/                       node:test suite (141 tests, zero dependencies)
```

Mission content is entirely data-driven: `missionRegistry.js` is the *only* file
that enumerates missions, and every mission is validated against the schema at
load time.

## The sandbox: how untrusted code execution is actually isolated

The single most important design decision in this codebase: **learner code is
never `eval`'d in the parent page.** Two different real isolation mechanisms are
used, matched to what each mission actually needs — not one mechanism pretending
to cover everything.

### Worker sandbox (`runner: 'worker'`)

Used for missions that don't need a DOM: closures/scope, event-loop ordering,
`fetch` wrapping. A **fresh `Worker` is spawned for every run**, so:

- Its globals are always pristine — nothing can be tampered with across runs.
- `worker.terminate()` gives a genuinely forced stop, even against a synchronous
  infinite loop. This is the one guarantee the iframe sandbox below *cannot* make.
- `fetch`, `setTimeout`, `queueMicrotask`, `console.*`, and `Promise.prototype.then`
  are all replaced inside the worker with instrumented/mocked versions *before* any
  learner code runs, so **no real network request is ever possible** from this
  sandbox, and the event-loop trace panel is built from real scheduling/execution
  events as they actually happen — not a simulated re-creation.

### iframe sandbox (`runner: 'iframe'`)

Used for missions that need a real DOM: events, DOM inspection, third-party
script simulation, formjacking, runtime policy missions. It's an
`<iframe sandbox="allow-scripts">` — deliberately **without** `allow-same-origin`,
so the browser gives it an opaque (`"null"`) origin and its own realm: its own
`window`, its own prototypes, its own everything. (This doubles as the one live
"separate realms have separate globals" demonstration required by the brief —
see the Third-Party Checkout mission.) All communication is `postMessage` only,
validated on both sides (`protocol.js` checks the envelope shape and, on the host
side, that the message actually came from `iframe.contentWindow`).

Inside that realm, `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, and
`HTMLImageElement.prototype.src` (the classic image-beacon exfiltration channel)
are all patched to a **fully mocked network layer** before any site/mission/
learner code executes — nothing ever leaves this sandbox for real, regardless of
what a "malicious" simulated script inside a mission attempts to do.

### Known, real limitation — stated plainly, not glossed over

The iframe sandbox **cannot forcibly terminate a synchronous infinite loop** the
way `Worker.terminate()` can. Removing the iframe from the DOM stops it from
communicating further, but a genuinely hung synchronous script inside it is not
something this (or any purely client-side JavaScript) sandbox can guarantee to
preempt. This is exactly why iframe-runner missions are authored to avoid relying
on that guarantee, and why this README does not claim "arbitrary code execution
is fully safe" — only that no real network access, no cross-realm DOM access, and
no persistent tampering across runs is possible.

## Mission schema

Every file under `src/missions/**` exports one object shaped like:

```js
export default {
  id, chapter, title, type, difficulty, xp, estimatedMinutes,
  objective, prerequisites, scenario, task, expectedBehavior,
  runner: 'worker' | 'iframe' | 'none',
  submissionMode: 'code' | 'answer',   // code editor vs. structured Q&A panel
  initialCode,                         // starter code (or '' for answer-mode)
  siteSnapshot,                        // iframe missions only: the fake site's HTML
  setupScript, testScript,             // trusted mission-authored code that runs
                                        // in-sandbox before/after the learner's code
  answerSchema,                        // answer-mode missions only
  validate(runResultOrAnswers, extra), // returns { passed, score, feedback }
  hints: [ /* 3+ progressive strings */ ],
  solution, explanation,
  commonWrongAnswers: [{ description, why }],
  securityImpact, runtimeExplanation, performanceNotes,
  sourceDefenseConnection, followUp,
  skillTags: [ /* one or more skill categories, see state/persistence.js */ ],
};
```

`missionSchema.js`'s `validateMission()` enforces this shape (required fields,
minimum hint count, etc.) and is run against every mission at registry load time
— a mission missing required content fails immediately and loudly, not silently
at render time.

### Adding a mission

1. Add a new file under `src/missions/chapterN/your-mission.js` exporting an
   object matching the schema above.
2. Import it and add it to the `MISSIONS` array in `src/game/missionRegistry.js`.
3. If it's an iframe mission, write `siteSnapshot` (the fake page's HTML) and, if
   grading needs to run scripted setup/checks, `setupScript`/`testScript` — these
   are plain strings of trusted JS executed inside the sandbox via `new Function`,
   in the *same* function scope as the learner's code (so a function the learner
   defines is callable by name from `testScript` — see `iframe-runtime.html`'s
   RUN handler for why this matters).
4. Add its `panels` array (which of `trace`/`dom`/`network`/`alerts`/`eventPath`
   the mission view should render) if the defaults per-runner aren't right.
5. `npm test` — `mission-schema.test.js` will validate the new mission
   automatically as part of the full registry.

## Learning goals by chapter

The map shows all 10 chapters from the original curriculum design so the full
intended scope stays visible even where content isn't built yet:

1. **JavaScript Runtime Reboot** — scope, closures, `this`, prototypes, coercion
2. **Execution Under the Hood** — call stack, heap, event loop, tasks vs. microtasks
3. **DOM and Browser Events** — capturing/bubbling/delegation, target vs. currentTarget
4. **Browser Architecture and Isolation** *(not yet built)* — processes, origins, realms
5. **Network Behavior** *(not yet built)* — fetch, CORS, cookies
6. **Script Loading and Third-Party JavaScript** — what a third-party script can touch
7. **Client-Side Attacks** — DOM XSS, formjacking, exfiltration (safely simulated)
8. **Runtime Security Engineering** — instrumentation that detects without breaking
9. **Evasion and Defensive Robustness** *(not yet built)* — how naive monitoring gets bypassed
10. **Performance and Production Reliability** — making security code fast and safe to ship

## Testing

```bash
npm test
```

141 tests, zero dependencies, using Node's built-in `node:test` + `node:assert/strict`.
Covers: XP/level math, streak calculation, mission-result recording, localStorage
persistence and forward-compatible loading, skill-rating EWMA updates, achievement
unlocking, every mission's schema validity (dynamically loaded from the real
registry), scoring composite math, the postMessage envelope protocol, the
event-loop trace builder (including a real ordering regression test for the
classic "microtask before macrotask" case), and the `wrap-fetch` mission's grading
logic against both correct and broken wrapper behavior.

The Node test suite does **not** exercise the sandbox/browser layer directly (a
`Worker` and a sandboxed iframe both require an actual browser). That layer was
verified manually end-to-end in a real headless Chrome: all 8 missions load, run,
and — when fed their own reference `solution` — pass validation; buggy starting
code correctly fails; hints, XP/leveling, `localStorage` persistence across
reload, and the confirmed progress-reset control were all exercised directly.
If you have a browser automation tool available, re-running that pass after any
change to `src/sandbox/**` or `src/components/mission-view.js` is the highest-value
manual check in this codebase.

## Design notes / what was deliberately left out

- No code editor dependency (CodeMirror/Monaco/etc.) — a plain `<textarea>` with a
  synced line-number gutter. Pulling in a real editor would hide exactly the kind
  of raw JS/DOM behavior this game exists to teach.
- No charting/animation libraries — skill bars and score meters are plain CSS.
- Dark, DevTools-inspired theme only (no light mode) — this is a deliberate,
  single-committed look, not an oversight.
- `prefers-reduced-motion` is always respected regardless of any in-app setting.
# Browser-Guardian
