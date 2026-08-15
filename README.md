# Browser Guardian: Runtime Defense Lab

A hands-on JavaScript runtime, browser-internals, and browser-security training
game — built to prepare for a JavaScript Security Engineer role (the kind of work
Source Defense does: instrumenting and protecting first-party pages against
malicious/compromised third-party JavaScript).

It is not a quiz app. Every mission and every lesson lab runs real, instrumented
code in a real sandbox — a dedicated Web Worker or a sandboxed `<iframe>` — and
every panel (console, call stack, task/microtask queues, DOM inspector, network
activity, security alerts) is populated from that real execution, not scripted
text.

The app has two entry points: **Guided Learning** (structured lessons that teach a
concept — mental model, live example, runtime walkthrough, micro-labs, knowledge
check — before you're tested on it) and **Challenge Mode** (the original larger
missions and interview-style assessment, fully usable on its own for anyone who
wants to skip straight to being tested).

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

On top of that, **Guided Learning Mode** adds **10 fully-built lessons** (see
below) spanning 6 of the 9 learning modules, each teaching a concept before the
matching Challenge Mode mission tests it.

## Guided Learning Mode

Guided Learning is additive, not a rebuild: it reuses the exact same sandbox,
scoring, hints, and panel-rendering engine the missions already use (see
"Reuse strategy" below), through a parallel content pipeline (`modules` →
`lessons` → `labs`) that mirrors the existing `chapters` → `missions` pipeline
field-for-field.

### The 10 lessons (first milestone)

| Lesson | Module | Related Challenge-Mode mission |
|---|---|---|
| var, let, const, and Closures in Loops | 1 — Scope, Execution Contexts, and Closures | The Closure Incident |
| Execution Contexts and Scope Chains | 1 — Scope, Execution Contexts, and Closures | The Closure Incident |
| Call Stack, Tasks, Microtasks, and the Event Loop | 3 — Async JavaScript and the Event Loop | Microtask Mayhem |
| Event Capturing, Bubbling, and Delegation | 4 — DOM and Events | The Disappearing Click |
| Origins, Same-Origin Policy, and CORS | 5 — Browser Architecture and Security Boundaries | Third-Party Checkout |
| What Third-Party JavaScript Can Actually Access | 6 — Network and Script Loading | Third-Party Checkout |
| Formjacking and Data Exfiltration | 7 — Client-Side Attacks | The Silent Skimmer |
| Safely Wrapping Native APIs | 8 — Runtime Security Instrumentation | Wrap Fetch Without Breaking It |
| How Instrumentation Gets Evaded | 8 — Runtime Security Instrumentation | The False Positive |
| Measuring and Reducing Instrumentation Overhead | 9 — Performance and Reliability | Security at 200ms |

Modules 2 (Values/Objects/this) and the rest of modules 3–9 beyond the lessons
above are visible on the Guided Learning map (`#/learn`) so the full intended
curriculum stays legible, but are honestly marked "content pending" — exactly
the same pattern the mission map already uses for unbuilt chapters, never a fake
clickable card.

### Lesson structure

Every lesson follows the same eight sections, all rendered generically by
`src/components/lesson-view.js` from the lesson's data (nothing is hard-coded per
lesson page): **why this matters** (dev / security / Source-Defense angles) →
**mental model** (with each claim explicitly labeled ECMAScript-spec /
browser-provided / simplified-model / implementation-detail, per the accuracy
requirement — never presenting the event loop as part of the JS language, never
blurring CORS into "SOP but stricter," etc.) → a **live executable example**
(predict → run → observe the real trace/DOM/network panels → modify → rerun) →
**micro-labs** (≥3, types `predict`/`modify`/`implement`/`break`/`defend`,
graded on observed behavior — console output, DOM state, network calls, thrown
errors, property descriptors — never on matching a fixed source string) →
**knowledge check** (2–4 free-text questions, self-scored against a model answer,
same interaction pattern as Interview Mode) → **mission readiness** (mastered /
needs-review labs, the related Challenge Mode mission, 3 interview questions).

### Reuse strategy — the load-bearing design decision

A **lab** is deliberately mission-shaped: same `runner`/`submissionMode`/
`validate(runResult, code) → {passed, score, feedback}` contract as a mission (see
`src/game/lessonSchema.js`, which imports `RUNNERS`/`SUBMISSION_MODES` straight
from `missionSchema.js`). That means labs run through the *exact same*, unmodified
`src/sandbox/**` layer missions already use — zero sandbox-layer changes were
needed to add Guided Learning at all.

The one refactor: the sandbox-wiring glue that used to live inline in
`mission-view.js` (spawn a sandbox, wire its callbacks to the console/trace/DOM/
network/alerts panels, track the last run result) was extracted into
`src/components/sandbox-run-controller.js` (`createRunController({runner, panels,
...}) → {slots, run, reset, getLastResult, ...}`). `mission-view.js` was then
refactored to call it — re-verified against the full existing Playwright
regression pass (all 8 missions still load/run/pass with zero console errors)
before being considered done — and `lab-runner.js` plus the lesson example widget
now both use the same controller. `renderAnswerForm` (structured Q&A panels) and
`renderScoreMeter` (debrief score bars) were similarly extracted into their own
small modules and reused rather than duplicated.

### State and spaced review

`persistence.js`'s `defaultState()` gained four additive keys — `lessons`,
`bookmarks`, `notes`, `mistakes` — picked up automatically by old saves through
the existing default-merge in `loadState()` (no schema-version bump, no
mission/XP data at risk). `src/state/learning.js` and `src/state/review.js` are
pure-function siblings of the existing `progress.js`/`skills.js`, and `store.js`
gained matching methods (`submitLabResult`, `submitKnowledgeCheck`,
`toggleBookmark`, `saveNote`, `resetLesson`).

Every failed lab submission records a mistake (`{lessonId, labId, mistakeType,
date, failedAttempts, resolved}` — repeated failures on the same lab increment
one record rather than piling up duplicates); passing it later marks that record
resolved. The **Review** screen (`#/review`) surfaces unresolved mistakes ranked
by failure count, each linking straight to the exact lab
(`#/learn/<lesson>?lab=<lab>`, which the router parses and `lesson-view.js`
scrolls to on load) — deliberately not a streak/engagement mechanic, just "what's
worth retrying."

### Adding a lesson

1. Add `src/lessons/moduleN/your-lesson.js` exporting an object matching the
   shape in `src/game/lessonSchema.js` (`whyItMatters`, `mentalModel` with ≥2
   labeled distinctions, `example`, ≥3 `labs`, 2–4 `knowledgeCheck` questions,
   exactly 3 `interviewQuestions`).
2. Import it and add it to the `LESSONS` array in `src/game/lessonRegistry.js`.
3. Each lab is mission-shaped — reuse the same `siteSnapshot`/`setupScript`/
   `testScript`/`validate()` conventions documented below for missions. If a lab
   uses `async`/`await`, always pair it with an explicit `testScript` that calls
   `__report(...)` itself — see the note in the sandbox section below about why
   relying on auto-detected completion silently breaks for bare `await`.
4. `npm test` — `tests/lesson-schema.test.js` validates the new lesson (and every
   lab in it) automatically as part of the real registry, the same way
   `tests/mission-schema.test.js` already does for missions.

## Architecture

```
index.html                  Shell + panel/header/footer structure
server.js                   Zero-dependency static file server (dev only)
styles/                     tokens.css (theme), layout, components, panels, motion
src/
  app.js                    Entry point — starts the router, live header status
  router.js                 Hash router: #/map #/mission/:id #/learn #/learn/:id
                             (optionally ?lab=id) #/review #/interview #/settings
  state/
    store.js                Observable store; the only place state actually changes
    persistence.js          localStorage read/write, versioned schema, migration stub
    progress.js             Pure functions: XP/level curve, streaks, mission records
    skills.js                Pure functions: per-category EWMA skill ratings
    achievements.js          Declarative achievement rules
    learning.js               Pure functions: lesson/lab progress, completion, module progress
    review.js                 Pure functions: mistake recording/resolution, weak-concept ranking
  game/
    missionSchema.js        Mission shape + validateMission() — fails loudly, at
                             load time, if a mission is missing required content
    missionRegistry.js       Imports every mission file; the only enumeration point
    scoring.js               correctness/security/compatibility/performance → composite
    hints.js                 Progressive hint reveal state machine
    chapters.js               Chapter metadata for the mission map
    interviewBank.js          Interview-mode question bank + selection logic
    lessonSchema.js           Lesson/Lab shape + validateLesson()/validateLab()
    lessonRegistry.js         Imports every lesson file; missionToLessons() reverse index
    modules.js                Guided Learning module metadata for the learn map
  missions/chapterN/*.js     One file per mission (see schema below)
  lessons/moduleN/*.js       One file per lesson (mirrors missions/ exactly)
  sandbox/
    protocol.js              Shared postMessage envelope + validation
    worker-sandbox.js         Host-side driver for the Worker sandbox
    worker-runtime.js         Code that runs INSIDE the Worker
    iframe-sandbox.js         Host-side driver for the sandboxed-iframe sandbox
    iframe-runtime.html       Document loaded INSIDE the sandboxed iframe
  simulators/                Pure rendering/transform logic for each panel
  components/                UI: chapter/learn maps, mission/lesson/lab views, all panels
    sandbox-run-controller.js Shared sandbox-wiring engine (missions, lesson
                               examples, and labs all drive their panels through this)
    lab-runner.js              Embeddable run/reset/submit/hints/feedback card for one lab
    lesson-view.js              The 8-section lesson page
    learn-sidebar.js / learn-shell.js / learn-map.js   Guided Learning nav + module map
    review-weak-concepts.js     Mistake history + weak-concept retry screen (#/review)
    answer-form.js               Shared structured Q&A renderer (missions + labs)
  utils/                     el()/mount() DOM helpers, pubsub, formatting
tests/                       node:test suite (264 tests, zero dependencies)
```

Mission content is entirely data-driven: `missionRegistry.js` is the *only* file
that enumerates missions, and every mission is validated against the schema at
load time. Lesson content follows the identical pattern one level up, through
`lessonRegistry.js`.

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

  **A real gotcha worth knowing before adding content:** the worker's "auto-detect
  when everything has settled" completion path is driven by that
  `Promise.prototype.then` patch — but modern engines optimize `await
  nativePromise` to skip calling the observable `.then()` entirely, so code that
  only ever uses bare `await` (never explicit `.then()`/`setTimeout`) is invisible
  to that bookkeeping and can report "done" before the awaited work finishes. The
  fix already built in: whenever a `testScript` is present, completion is decided
  *only* by that script's own explicit `__report(...)` call, never by
  auto-detection — so any lab/mission using `await` should always pair it with a
  `testScript` that awaits the real work and reports itself (see
  `wrap-fetch-without-breaking-it` or the async/await lab in `call-stack-event-loop.js`
  for the pattern).

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

264 tests, zero dependencies, using Node's built-in `node:test` + `node:assert/strict`.
Covers everything the original suite did (XP/level math, streak calculation,
mission-result recording, localStorage persistence and forward-compatible loading,
skill-rating EWMA updates, achievement unlocking, every mission's schema validity,
scoring composite math, the postMessage envelope protocol, the event-loop trace
builder, and the `wrap-fetch` mission's grading logic), plus, for Guided Learning:
`tests/lesson-schema.test.js` (validates every real lesson and lab dynamically
from the registry, the same way mission-schema.test.js does for missions),
`tests/learning.test.js` (lab/knowledge-check recording, lesson completion,
module progress, single-lesson reset without touching other progress), and
`tests/review.test.js` (mistake recording/de-duplication, resolution, and
weak-concept ranking).

The Node test suite does **not** exercise the sandbox/browser layer directly (a
`Worker` and a sandboxed iframe both require an actual browser). That layer was
verified manually end-to-end in a real headless Chrome, repeatedly through the
build: every mission and every lesson lab loads, runs, and — when fed its own
reference `solution` — passes validation; buggy starting code correctly fails;
hints, XP/leveling, bookmarks/notes, the Review screen's deep links, `localStorage`
persistence across reload, and the confirmed progress-reset controls were all
exercised directly, alongside keyboard-navigation and mobile-viewport passes (the
latter caught and fixed a real horizontal-overflow bug in the Guided Learning
sidebar — a CSS Grid item's default `min-width: auto` refusing to shrink below its
longest button's text). If you have a browser automation tool available,
re-running a pass like this after any change to `src/sandbox/**`,
`src/components/mission-view.js`, or `src/components/sandbox-run-controller.js`
is the highest-value manual check in this codebase.

## Design notes / what was deliberately left out

- No code editor dependency (CodeMirror/Monaco/etc.) — a plain `<textarea>` with a
  synced line-number gutter. Pulling in a real editor would hide exactly the kind
  of raw JS/DOM behavior this game exists to teach.
- No charting/animation libraries — skill bars and score meters are plain CSS.
- Dark, DevTools-inspired theme only (no light mode) — this is a deliberate,
  single-committed look, not an oversight.
- `prefers-reduced-motion` is always respected regardless of any in-app setting.
# Browser-Guardian
