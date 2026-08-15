import { SKILL_CATEGORIES } from '../state/persistence.js';
import { weakestCategories } from '../state/skills.js';

// A bank of interview-style prompts, tagged by the skill category they exercise.
// These deliberately mirror how a Source Defense interview would actually probe —
// "explain why", "how would you detect", "how would you break this" — not trivia.
export const INTERVIEW_QUESTIONS = [
  {
    id: 'q-var-loop',
    skillTag: 'fundamentals',
    prompt: 'A `for (var i = 0; ...) setTimeout(() => console.log(i))` loop logs the same final value every time. Explain exactly why, in terms of scope — not just "use let".',
    modelAnswer: '`var` is function-scoped, so all callbacks close over the same single `i` binding. By the time any timeout callback runs, the synchronous loop has already finished and `i` holds its final value. `let` creates a fresh lexical binding per iteration, so each closure captures its own `i`.',
  },
  {
    id: 'q-microtask-order',
    skillTag: 'asyncEventLoop',
    prompt: 'Given sync code, a `setTimeout(fn, 0)`, and a resolved `Promise.then(fn)` all scheduled in the same tick, what order do they run in and why?',
    modelAnswer: 'Synchronous code always finishes first. Then the microtask queue (the Promise callback) drains completely before the event loop picks the next macrotask, so the promise `.then` runs before the `setTimeout` callback even though both were "scheduled" at the same moment — timers are macrotasks, promise reactions are microtasks, and microtasks have priority between macrotasks.',
  },
  {
    id: 'q-async-await-desugar',
    skillTag: 'asyncEventLoop',
    prompt: 'How does `await` relate to the microtask queue? Walk through what happens at the await point.',
    modelAnswer: 'An `async` function runs synchronously until the first `await`. At that point it suspends, and everything after the `await` is scheduled to resume as a microtask once the awaited value resolves (immediately as a microtask if it\'s already a resolved value/non-promise). Control returns to the caller synchronously at the await point, so code after the call to the async function runs before the resumed continuation.',
  },
  {
    id: 'q-target-vs-current',
    skillTag: 'events',
    prompt: 'What is the difference between `event.target` and `event.currentTarget`, and why does that distinction matter for event delegation?',
    modelAnswer: '`target` is the actual element the event originated on (e.g. the `<button>` clicked inside a delegated container); `currentTarget` is whichever element the listener is currently attached to and executing on. Delegation relies on attaching one listener to an ancestor and using `target` (often with `closest()`) to figure out which descendant was actually interacted with, while `currentTarget` stays fixed at the ancestor.',
  },
  {
    id: 'q-stop-immediate',
    skillTag: 'events',
    prompt: '`stopPropagation()` vs `stopImmediatePropagation()` — what\'s the concrete behavioral difference?',
    modelAnswer: '`stopPropagation()` stops the event from continuing to the next node in the capture/bubble path, but other listeners on the *same* node still run. `stopImmediatePropagation()` does that AND prevents any remaining listeners registered on that same node from running at all.',
  },
  {
    id: 'q-third-party-access',
    skillTag: 'webSecurity',
    prompt: 'A third-party analytics `<script>` loads with no CSP and no sandboxing on a checkout page. What can it access, and why?',
    modelAnswer: 'Once it executes, it runs in the exact same realm, origin, and DOM as the first-party page — same `window`, same `document`, same global scope. It can read and write any DOM node (including form/payment fields), register its own event listeners, override built-in functions on shared prototypes, make network requests as the page\'s origin, and read non-HttpOnly cookies and storage. There is no JavaScript-level isolation between first- and third-party script unless the page explicitly sandboxes it (separate realm/iframe) or restricts it via CSP.',
  },
  {
    id: 'q-detect-exfil',
    skillTag: 'runtimeInstrumentation',
    prompt: 'How would you detect a script exfiltrating a payment field via a 1x1 tracking pixel (`new Image().src = ...`)?',
    modelAnswer: 'Instrument the `src` setter on `HTMLImageElement.prototype` (or observe `Image` construction plus attribute mutation) using a captured pristine reference, and compare the destination against an allowlist of known-legitimate hosts. Correlate the timing with recent reads from sensitive input fields (e.g. hook `value` getters on flagged payment inputs) — a script that reads a card-number field and then, within the same task, sets an `<img src>` to an unfamiliar cross-origin host with encoded query data is a strong behavioral signal, even without knowing the script by name.',
  },
  {
    id: 'q-wrapper-bypass',
    skillTag: 'runtimeInstrumentation',
    prompt: 'You wrap `window.fetch` to log every call. How could a script bypass your wrapper?',
    modelAnswer: 'If it grabs a reference to the native `fetch` *before* your wrapper installs (e.g. it runs earlier in document order, or it cached `window.fetch` at page-load time before your script executed), it can call the pristine function directly. It could also use `fetch.call`/`.apply` with an unexpected receiver, use `XMLHttpRequest` or `navigator.sendBeacon` as alternate channels you didn\'t instrument, construct a request inside a Worker (separate realm, separate globals), or use an iframe with its own realm. This is why instrumentation timing and coverage of every network-capable API matter as much as the wrapper logic itself.',
  },
  {
    id: 'q-what-would-you-break',
    skillTag: 'productionReliability',
    prompt: 'You ship a policy that blocks any script writing to `innerHTML` with a `<script>` or `on*=` attribute in the string. What legitimate site behavior might this break?',
    modelAnswer: 'Any legitimate use of `innerHTML` to render trusted, sanitized markup that happens to contain those substrings even in a safe context (e.g. a code snippet displayed as text, a CMS widget rendering user-authored HTML that already passed through a sanitizer) could be false-flagged. A naive string-match policy can\'t distinguish "dangerous sink fed untrusted data" from "safe sink fed content that merely mentions script-like text" — which is why signature/pattern matching alone produces false positives and real detection needs to reason about data provenance (is the value influenced by an untrusted source?), not just the sink pattern.',
  },
  {
    id: 'q-preserve-this',
    skillTag: 'runtimeInstrumentation',
    prompt: 'Why does a `fetch` wrapper need to preserve `this`, given that `fetch` is usually called as `fetch(url)` with no receiver?',
    modelAnswer: 'Some code calls it as `window.fetch(...)` or stores a reference and calls it through another object, and specs/implementations can require the receiver to be a `Window`/`WorkerGlobalScope` (an "illegal invocation" TypeError is thrown for the wrong receiver in some engines for certain built-ins). A wrapper implemented as `function(...args) { return nativeFetch.apply(this, args); }` (not an arrow function, and explicitly forwarding `this`) avoids silently breaking call sites that depend on the receiver, and forwarding via `apply`/`Reflect.apply` keeps argument handling exact.',
  },
  {
    id: 'q-realm-iframe',
    skillTag: 'browserArchitecture',
    prompt: 'If a script runs inside a cross-origin (or sandboxed, non-same-origin) iframe, does your parent-page instrumentation of `window.fetch` see its network calls?',
    modelAnswer: 'No. A different realm has its own global object, its own `fetch`, its own prototypes entirely — patching `window.fetch` in the parent only affects that parent window\'s `fetch`. Code running in a separate browsing context has to be instrumented separately (which is only possible if you control that context, e.g. it\'s your own same-origin iframe, or the browser exposes a privileged extension-level hook) — this is exactly why "monkey-patch the main page" has a hard ceiling as a security strategy.',
  },
  {
    id: 'q-csp-vs-sanitization',
    skillTag: 'webSecurity',
    prompt: 'How is Content-Security-Policy different from input sanitization as an XSS defense?',
    modelAnswer: 'Sanitization is a data-transformation defense applied at the point untrusted data enters a dangerous sink — it tries to make the *content* safe. CSP is a runtime restriction enforced by the browser on what the *page* is allowed to do at all — e.g. refusing to execute inline scripts or scripts from non-allowlisted origins, regardless of how they got there. CSP is defense-in-depth: it doesn\'t know or care whether a string is "sanitized," it blocks whole categories of execution. A site should use both — sanitization to avoid creating the vulnerability, CSP to limit blast radius if a sanitizer is ever bypassed or missed.',
  },
  {
    id: 'q-cors-vs-sop',
    skillTag: 'network',
    prompt: 'What is the actual relationship between the Same-Origin Policy and CORS? Are they the same protection?',
    modelAnswer: 'No. The Same-Origin Policy is the browser\'s default restriction preventing script on one origin from reading responses/DOM from another origin. CORS is a mechanism for a server to selectively *relax* that restriction by sending headers (`Access-Control-Allow-Origin`, etc.) telling the browser it\'s fine for a specific other origin to read the response. CORS doesn\'t add security — it\'s an opt-in loosening of SOP, enforced by the browser but authorized by the server; a misconfigured (e.g. wildcard/reflect-origin) CORS policy actively weakens SOP\'s protection rather than being a security feature on its own.',
  },
  {
    id: 'q-httponly',
    skillTag: 'webSecurity',
    prompt: 'Why is an HttpOnly cookie meaningfully different from a token stored in localStorage, from a security standpoint?',
    modelAnswer: 'An HttpOnly cookie is inaccessible to JavaScript entirely (`document.cookie` never sees it) — it\'s only sent by the browser on requests to the matching origin, which means an XSS payload running in the page cannot read and exfiltrate it directly. Anything in `localStorage`/`sessionStorage` (or a non-HttpOnly cookie) is fully readable by any script running in that origin\'s realm, so a single XSS bug turns into an immediate token theft. HttpOnly doesn\'t stop CSRF (the cookie still gets attached automatically), but it substantially narrows what a client-side script compromise can steal.',
  },
  {
    id: 'q-attribute-vs-property',
    skillTag: 'dom',
    prompt: 'What\'s the difference between a DOM attribute and a DOM property, with an example where they diverge?',
    modelAnswer: 'Attributes are the string values declared in HTML markup / read via `getAttribute`; properties are the live JS object fields on the DOM node. Many properties reflect their attribute (`id`), but not all: `input.value` reflects the *current* value and can diverge from the `value` attribute (which stays as the initial default), and `checked`/`.checked` similarly diverge from the `checked` attribute after user interaction. This matters for security instrumentation — reading `getAttribute("value")` on a form field will not see what the user actually typed.',
  },
  {
    id: 'q-detection-vs-prevention',
    skillTag: 'threatModeling',
    prompt: 'When designing runtime protection, when would you choose detection-only (alert/telemetry) over active blocking?',
    modelAnswer: 'Blocking is appropriate when a behavior is unambiguous and high-confidence (e.g. a known-malicious exfil destination) and the cost of a false positive is tolerable relative to the cost of the attack succeeding. Detection-only is safer during initial rollout of any new rule, for behaviors with real false-positive risk (a policy you haven\'t validated against production traffic yet), or when blocking could break a business-critical flow like checkout — you\'d rather page a human than silently drop a legitimate payment. Mature programs typically launch new rules in detect/alert mode, measure false-positive rate against real traffic, then promote to blocking once confidence is established — with a kill switch in case of regressions.',
  },
  {
    id: 'q-signature-vs-behavioral',
    skillTag: 'clientSideAttacks',
    prompt: 'Contrast signature-based detection with behavioral detection for malicious third-party scripts.',
    modelAnswer: 'Signature-based detection matches known-bad indicators — a specific script URL, a file hash, a known malicious code pattern — which is precise and low-false-positive but blind to anything novel or slightly modified (trivially evaded by renaming, minifying differently, or hosting on a new domain). Behavioral detection watches *what code does at runtime* — does it read from a payment field then make an unexpected outbound request — which can catch previously-unseen attacks and resists superficial code changes, but is harder to tune and carries more false-positive risk since legitimate code can incidentally look similar.',
  },
  {
    id: 'q-prototype-pollution',
    skillTag: 'clientSideAttacks',
    prompt: 'Explain prototype pollution conceptually: what is being polluted, and why is it dangerous?',
    modelAnswer: 'It\'s when attacker-controlled input (often via unsafe recursive merge/clone of an object, using a key like `__proto__` or `constructor.prototype`) is used to write a property onto `Object.prototype` itself, rather than onto a plain object. Because nearly all plain objects inherit from `Object.prototype`, that injected property becomes visible on every object in the application that doesn\'t already own that property — which can flip security-relevant flags (e.g. an `isAdmin` check reading an inherited property), or, if it lands on a property later used as a sink (like an HTML template variable), lead to XSS.',
  },
  {
    id: 'q-frozen-property',
    skillTag: 'runtimeInstrumentation',
    prompt: 'What happens if you try to monkey-patch a property that\'s been made non-configurable, and what should your instrumentation do about it?',
    modelAnswer: '`Object.defineProperty` on a non-configurable property throws a `TypeError` (in strict mode; silently fails otherwise) — you cannot redefine it. Robust instrumentation should feature-detect this (check the property descriptor\'s `configurable` flag before attempting to patch) and fail safe: skip instrumenting that specific API rather than crashing the page, and emit a diagnostic/telemetry event noting reduced coverage, rather than letting an uncaught exception break the site it\'s meant to protect.',
  },
  {
    id: 'q-pristine-refs',
    skillTag: 'runtimeInstrumentation',
    prompt: 'Why capture "pristine" references to native APIs at the very start of instrumentation, before doing anything else?',
    modelAnswer: 'If your own wrapper (or another script that runs before you) has already replaced the native function, capturing a reference later would capture the *wrapped* version, not the real one — meaning your wrapper would call the tampered version, potentially reintroducing the bug/attack path it was there to catch, or double-wrapping and breaking behavior. Capturing pristine references as early as possible (ideally before any other script gets a chance to run) is the only way to reliably fall back to real native behavior and to detect if something else later replaces the global.',
  },
  {
    id: 'q-reentrancy',
    skillTag: 'runtime',
    prompt: 'What is reentrancy in the context of API instrumentation, and how can it cause infinite recursion?',
    modelAnswer: 'Reentrancy is when your wrapper function, while executing, ends up calling itself again — e.g. your instrumented `fetch` wrapper internally uses `fetch` (or a DOM API you\'ve also patched) to send a telemetry beacon, which re-triggers your own instrumentation, which tries to send telemetry again, recursing until a stack overflow. The fix is to use the captured pristine/native reference for any internal work the instrumentation itself does, and/or a re-entrancy guard flag, so instrumentation logic never routes back through its own wrapped surface.',
  },
  {
    id: 'q-long-task',
    skillTag: 'performance',
    prompt: 'Your MutationObserver-based monitor is functionally correct but adds noticeable input lag. What are your first two levers to reduce overhead without losing detection?',
    modelAnswer: 'First, batch/debounce: MutationObserver callbacks already receive batched mutation records per microtask turn, but if your handler does expensive synchronous work per record, coalesce it (e.g. process the batch once, not per-record) or defer non-urgent analysis to `requestIdleCallback`/a microtask instead of doing it inline on every mutation. Second, narrow scope: only observe the DOM subtrees and mutation types you actually need (avoid `subtree: true` on the whole document if you only care about a few known containers, avoid `attributes: true` if you don\'t need attribute mutations) — over-broad observation multiplies callback volume for no detection benefit.',
  },
  {
    id: 'q-passive-listener',
    skillTag: 'browserApis',
    prompt: 'What does the `passive: true` option do on `addEventListener`, and why does it matter for scroll performance?',
    modelAnswer: 'It\'s a promise from the listener to the browser that it will never call `preventDefault()`. That lets the browser start the default action (like scrolling) immediately on a separate thread/compositor step without waiting to see whether the JS handler cancels it — without `passive`, the browser has to run the handler to completion first (in case it calls `preventDefault()`) before it can scroll, which can visibly stall scrolling on `touchstart`/`wheel` listeners that don\'t actually need to block it.',
  },
  {
    id: 'q-weakmap-leak',
    skillTag: 'fundamentals',
    prompt: 'Why would you use a WeakMap instead of a Map to associate metadata with DOM nodes in a long-running security monitor?',
    modelAnswer: 'A `Map` holds a strong reference to its keys, so if you use DOM nodes as keys, those nodes can never be garbage-collected as long as the Map entry exists — even after the node is removed from the document — which is a classic memory leak in a long-lived page (exactly the kind of thing a runtime security agent that lives for the whole page lifetime must avoid). A `WeakMap` holds its keys weakly: once the DOM node has no other references and is removed, the entry is eligible for garbage collection automatically, without you having to manually track and clean up removed nodes.',
  },
  {
    id: 'q-detached-dom',
    skillTag: 'performance',
    prompt: 'What is a detached DOM node, and how does instrumentation code accidentally cause this kind of leak?',
    modelAnswer: 'A detached DOM node is one that\'s been removed from the document tree but is still referenced from JavaScript (e.g. stored in an array, closure, or event-listener reference), so the garbage collector can\'t reclaim it or its subtree. Instrumentation commonly causes this by keeping its own long-lived registry (e.g. an array of "elements we\'re watching") without removing entries when those elements are removed from the DOM, or by attaching listeners with closures that capture the element and never calling `removeEventListener`.',
  },
  {
    id: 'q-supply-chain',
    skillTag: 'clientSideAttacks',
    prompt: 'A trusted third-party CDN-hosted script gets compromised and starts serving malicious code from the exact same URL your site already references. What client-side control would have prevented execution, and why doesn\'t a CSP allowlist alone stop this?',
    modelAnswer: 'Subresource Integrity (SRI) — a `integrity="sha384-..."` hash on the `<script>` tag — causes the browser to refuse to execute the fetched file if its hash doesn\'t match, so a swapped-out malicious payload at the same URL simply fails to load. A CSP allowlist by *host* (`script-src https://cdn.example.com`) doesn\'t help here because the malicious file is served from the exact same allowed host/URL — CSP restricts *where* scripts can load from, not *whether the content changed*; only SRI (or CSP hashes on inline scripts, which don\'t apply to changing external files) verifies content integrity.',
  },
  {
    id: 'q-clickjacking',
    skillTag: 'clientSideAttacks',
    prompt: 'How does clickjacking work, and what stops it — is it something JavaScript on the page can defend against reliably?',
    modelAnswer: 'An attacker embeds your page in an invisible/transparent iframe layered under attacker-controlled content, tricking the user into clicking something (e.g. "claim prize") that\'s actually a click on your page\'s real button underneath (e.g. "authorize payment"). The reliable defense is a response header — `X-Frame-Options` or, better, CSP `frame-ancestors` — telling the browser to refuse to render your page inside a frame at all. JS-based "frame-busting" scripts (checking `window.top !== window.self`) are a page-level, brittle mitigation that can be defeated in various ways and shouldn\'t be relied on as the primary control; the header-based, browser-enforced restriction is the actual guarantee.',
  },
  {
    id: 'q-trusted-types',
    skillTag: 'webSecurity',
    prompt: 'What problem do Trusted Types solve that a regular CSP `script-src` policy doesn\'t?',
    modelAnswer: 'CSP `script-src` restricts which *scripts* can execute but does nothing about DOM-based XSS via dangerous sinks like `innerHTML`, `document.write`, or `location` assignment fed by untrusted strings — that\'s not "loading a script," it\'s string-to-markup/JS conversion inside code that\'s already allowed to run. Trusted Types locks down those sink APIs so they only accept specially-typed objects produced by a vetted policy function (not raw strings), forcing any conversion from untrusted string to executable markup/URL through code you control and can sanitize — closing the DOM-XSS gap that script-source restrictions can\'t touch.',
  },
  {
    id: 'q-postmessage-origin',
    skillTag: 'browserArchitecture',
    prompt: 'What\'s the single most common mistake when using `postMessage` for cross-origin communication, and why is it dangerous?',
    modelAnswer: 'Not checking `event.origin` (and/or `event.source`) on the receiving end before trusting the message — a listener that acts on any incoming `message` event regardless of origin can be fed forged data from any other page/iframe the user has open, including a malicious one that opens a popup or embeds an iframe targeting your page. Always validate `event.origin` against an explicit allowlist (and ideally `event.source` against the expected window reference) before treating the payload as trusted.',
  },
  {
    id: 'q-what-you-log',
    skillTag: 'runtimeInstrumentation',
    prompt: 'Your instrumentation detects a script reading a credit-card input field. What do you log to telemetry, and what do you deliberately withhold?',
    modelAnswer: 'Log the fact and shape of the event: which field/selector was read, by which script (URL/identity if attributable), timestamp, and the surrounding behavioral context (e.g. was it followed by a network call, to where). Deliberately withhold the actual field *value* — logging the real card number/PII defeats the purpose of protecting it and creates its own data-handling liability; a security monitor should never itself become a new place sensitive data is collected and stored.',
  },
  {
    id: 'q-feature-detection',
    skillTag: 'productionReliability',
    prompt: 'Why is feature detection preferred over browser/UA sniffing when deciding whether to apply a piece of instrumentation?',
    modelAnswer: 'UA strings are spoofable, inconsistent across browsers/versions, and require you to keep a mapping of "which UA supports which API" up to date forever. Feature detection (e.g. `typeof navigator.sendBeacon === "function"`, checking a property descriptor before patching it) asks the actual runtime directly whether the capability exists, which is accurate regardless of how the browser identifies itself, resilient to UA spoofing, and automatically correct for browsers you\'ve never even tested against.',
  },
  {
    id: 'q-kill-switch',
    skillTag: 'productionReliability',
    prompt: 'You roll out a new blocking rule and start seeing a spike in checkout failures. What should already be in place to respond quickly?',
    modelAnswer: 'A remote kill switch / feature flag that can disable the rule (or drop it back to detect-only mode) without a code deploy, ideally within seconds/minutes — plus false-positive monitoring/alerting tied to a real business metric (checkout completion rate, not just "rule fired count") so the regression is caught automatically rather than by customer complaints. Canary/staged rollout (a small traffic percentage first) is what should have caught this before it reached 100% of traffic in the first place.',
  },
  {
    id: 'q-boolean-coercion',
    skillTag: 'fundamentals',
    prompt: 'Name the falsy values in JavaScript, and give an example where relying on truthy/falsy coercion instead of an explicit check causes a real bug.',
    modelAnswer: 'Falsy values: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. A classic bug: `if (count)` intended to mean "count is present" incorrectly treats a legitimate `count = 0` as absent/falsy, e.g. skipping rendering or logic that should run for a zero value. Explicit checks (`count !== undefined`, `Number.isFinite(count)`) avoid coercion swallowing meaningful falsy-but-valid values.',
  },
  {
    id: 'q-this-arrow',
    skillTag: 'fundamentals',
    prompt: 'How does `this` binding differ between a regular function and an arrow function, and why does that matter when writing an event listener as a class method?',
    modelAnswer: 'A regular function\'s `this` is determined by how it\'s *called* (its receiver at the call site — e.g. `element.addEventListener` calls the handler with `this` set to the element, unless bound otherwise). An arrow function has no `this` of its own; it lexically captures `this` from its enclosing scope at definition time. That\'s why arrow-function class fields (`onClick = () => {...}`) are commonly used for listeners — they preserve the class instance as `this` when the browser invokes the callback, whereas a regular method passed as a bare reference would have `this` reset to the element (or `undefined` in strict mode) when the browser calls it.',
  },
  {
    id: 'q-shallow-deep-copy',
    skillTag: 'fundamentals',
    prompt: 'What breaks if you use a shallow copy (`{...obj}` or `Object.assign`) when you actually needed a deep copy, in the context of mutating shared state?',
    modelAnswer: 'A shallow copy creates a new top-level object, but nested objects/arrays are still the *same references* as in the original. Mutating a nested property on the "copy" also mutates the original, since both point at the same inner object — this silently corrupts shared/cached state and is a common source of subtle bugs in code that assumes copying means full isolation (e.g. two policy configs that are supposed to be independent but share a nested rules array).',
  },
  {
    id: 'q-strict-mode',
    skillTag: 'fundamentals',
    prompt: 'What does strict mode actually change at runtime, and why would security-sensitive code want it on deliberately?',
    modelAnswer: 'Strict mode turns several silent failures into thrown errors (assigning to an undeclared variable, assigning to a non-writable/non-configurable property, deleting an undeletable property), disallows some unsafe patterns (like `with`), and changes `this` in a plain function call from the global object to `undefined`. For security-sensitive instrumentation, the "fail loud instead of silently no-op" behavior is valuable — e.g. attempting to patch a frozen property throws immediately rather than silently doing nothing and leaving you with false confidence that instrumentation is active.',
  },
  {
    id: 'q-samesite-cookie',
    skillTag: 'network',
    prompt: 'What does a `SameSite=Lax` (vs `Strict` vs `None`) cookie attribute actually control, and how does it relate to CSRF?',
    modelAnswer: 'SameSite controls whether the browser attaches the cookie on cross-site requests. `Strict` never sends it cross-site (even top-level navigation from an external link); `Lax` sends it on top-level cross-site navigations (like following a link) but not on cross-site subresource/fetch requests (like an auto-submitting form or fetch triggered by another site) — this default in modern browsers blocks the classic CSRF pattern of a malicious page silently firing an authenticated request. `None` (which requires `Secure`) sends the cookie on all cross-site requests, opting back out of that protection when it\'s genuinely needed (e.g. legitimate cross-site embeds).',
  },
  {
    id: 'q-debug-unfamiliar-script',
    skillTag: 'debugging',
    prompt: 'You\'re handed a minified, unfamiliar third-party script suspected of skimming form data, with no source map. Walk through your systematic approach.',
    modelAnswer: 'Start from the sinks, not the source: use DevTools\' DOM breakpoints ("break on attribute modification") on the sensitive fields, and XHR/fetch breakpoints, to catch the script in the act rather than reading minified code top-to-bottom. Prefer logpoints over regular breakpoints when the goal is observing behavior without disrupting timing — a paused debugger can itself change (or hide) timing-dependent attack behavior. Search the source for exfiltration-shaped patterns (`fetch`/`XMLHttpRequest`/`sendBeacon`/`new Image()` calls, `encodeURIComponent`/base64 chains near a network call). Diff the page\'s observable behavior (network requests, DOM state) with and without the script loaded to isolate exactly what it changes, rather than trying to fully understand every line.',
  },
  {
    id: 'q-debug-intermittent',
    skillTag: 'debugging',
    prompt: 'A bug reproduces intermittently in production and never locally. What\'s your systematic approach before touching any code?',
    modelAnswer: 'Treat it as a timing/race problem first: reproduce under realistic conditions (throttled network, realistic latency) rather than instant local responses, since races are often invisible when everything resolves too fast to interleave badly. Add logpoints instead of breakpoints — pausing execution changes timing and can mask a race entirely (a classic "Heisenbug"). Look for shared mutable state read/written by more than one async callback, and check whether the failure correlates with a specific browser, extension, or network condition in the field data before forming a code-level hypothesis.',
  },
  {
    id: 'q-live-vs-static-collections',
    skillTag: 'dom',
    prompt: '`getElementsByClassName` returns a live collection; `querySelectorAll` returns a static one. What does that actually mean, and where does it cause bugs?',
    modelAnswer: 'A live `HTMLCollection` (from `getElementsByClassName`/`getElementsByTagName`, or `.childNodes`) automatically reflects DOM changes made after it was obtained — its `.length` and contents update in real time. That becomes a bug when you iterate it with a forward `for` loop while removing matching elements: removing index 0 shifts everything down, so the loop skips what is now index 0, silently processing only every other element. `querySelectorAll` returns a static `NodeList` — a snapshot taken at call time that later DOM changes don\'t affect — which is why it\'s usually the safer default for iterate-and-mutate code.',
  },
  {
    id: 'q-gc-reachability',
    skillTag: 'runtime',
    prompt: 'How does a JavaScript engine actually decide an object is eligible for garbage collection — is it reference counting?',
    modelAnswer: 'No — modern engines use mark-and-sweep based on REACHABILITY from a set of roots (the global object, the current call stack, and closures still referenced from either). An object becomes collectible once no chain of references from any root reaches it, regardless of how many OTHER unreachable objects still point to it. This is precisely why simple reference counting isn\'t used: it can\'t handle two objects that reference each other but are both unreachable from any root — mark-and-sweep handles that circular case correctly because it starts from the roots outward instead of counting incoming references.',
  },
  {
    id: 'q-trust-boundary',
    skillTag: 'threatModeling',
    prompt: 'In one or two sentences, what is a trust boundary, and where are the trust boundaries on a typical checkout page?',
    modelAnswer: 'A trust boundary is any point where data or control passes from one level of trust to another, and therefore needs to be validated or isolated rather than assumed safe. On a checkout page: first-party code and co-located third-party scripts (same realm, different trust — the mechanical access is identical, the trust is not), the page and a payment provider\'s iframe (a real, browser-enforced boundary), the client and the server (a network boundary — nothing client-side is trustworthy to the server without re-validation), and the page and raw user input (untrusted until validated, regardless of which script reads it first).',
  },
  {
    id: 'q-mutation-observer-timing',
    skillTag: 'browserApis',
    prompt: 'MutationObserver replaced the older (deprecated) Mutation Events. What was wrong with the old approach, and what changed about WHEN callbacks run?',
    modelAnswer: 'Mutation Events fired synchronously, as part of the mutation itself — a single DOM change could trigger a handler that made another DOM change, triggering another event, synchronously, all on the same stack. That caused severe performance problems and reentrancy bugs on any non-trivial page. MutationObserver batches mutations and delivers them asynchronously, as a microtask, after the current synchronous work finishes — the callback sees an array of accumulated MutationRecords instead of firing once per individual change, which avoids the reentrancy hazard while still guaranteeing delivery before the next macrotask or paint.',
  },
];

export function pickQuestions(skills, count = 6) {
  const weak = new Set(weakestCategories(skills, 5));
  const weighted = INTERVIEW_QUESTIONS.map((q) => ({ q, weight: weak.has(q.skillTag) ? 3 : 1 }));
  const pool = weighted.flatMap(({ q, weight }) => Array(weight).fill(q));

  const picked = [];
  const usedIds = new Set();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const q of shuffled) {
    if (usedIds.has(q.id)) continue;
    picked.push(q);
    usedIds.add(q.id);
    if (picked.length >= count) break;
  }
  return picked;
}

export function categoryLabel(tag) {
  const labels = {
    fundamentals: 'JavaScript Fundamentals',
    runtime: 'JavaScript Runtime',
    asyncEventLoop: 'Async / Event Loop',
    dom: 'DOM',
    events: 'Events',
    browserArchitecture: 'Browser Architecture',
    browserApis: 'Browser APIs',
    network: 'Network',
    webSecurity: 'Web Security',
    clientSideAttacks: 'Client-Side Attacks',
    runtimeInstrumentation: 'Runtime Instrumentation',
    threatModeling: 'Threat Modeling',
    debugging: 'Debugging',
    performance: 'Performance',
    productionReliability: 'Production Reliability',
  };
  return labels[tag] ?? tag;
}

export { SKILL_CATEGORIES };
