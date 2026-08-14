// Runs INSIDE the sandboxed Worker. A fresh Worker is created for every run, so this
// realm's globals are always pristine — nothing here can be tampered with across runs.
import { MESSAGE_TYPES, makeEnvelope, serializeArg } from './protocol.js';

const nativeConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
const nativeSetTimeout = setTimeout;
const nativeQueueMicrotask = queueMicrotask;
const nativePromiseThen = Promise.prototype.then;

let pendingCount = 0;
let syncEnded = false;
let doneSent = false;
let timerSeq = 0;

function post(type, payload) {
  self.postMessage(makeEnvelope(type, payload));
}

function sendDone(returnValue, error) {
  if (doneSent) return; // guard against a late auto-settle racing an explicit __report
  doneSent = true;
  post(MESSAGE_TYPES.DONE, { returnValue, error: error ?? null, consoleHistory });
}

// Modern engines optimize `await nativePromise` to skip calling the promise's
// observable `.then()` method entirely (V8's "optimizing await"), so code that only
// ever `await`s — never calls `.then()` directly — is invisible to our pendingCount
// bookkeeping below. That makes auto-detecting "everything has settled" unreliable
// for any run that includes mission-authored async test code. So: whenever a
// testScript is provided, completion is ONLY ever signaled by that script explicitly
// calling __report() — the pendingCount/auto-settle path is only trusted when there's
// no testScript (plain predict-output/code-repair missions using bare setTimeout).
let requireExplicitReport = false;

function sendDoneIfSettled(returnValue) {
  if (doneSent || requireExplicitReport) return;
  if (syncEnded && pendingCount <= 0) sendDone(returnValue);
}

const consoleHistory = [];
self.__consoleHistory = consoleHistory;

// A deterministic, fully mocked `fetch` — this Worker never makes a real network
// call. Missions that ask the learner to wrap `fetch` wrap THIS, and its call log is
// exposed so a mission's testScript can verify arguments were forwarded unchanged.
const mockFetchCalls = [];
self.__mockFetchCalls = mockFetchCalls;
self.fetch = function mockFetch(url, init) {
  mockFetchCalls.push({ url, init, receiver: this });
  if (typeof url === 'string' && url.includes('/api/fail')) {
    return Promise.reject(new Error('Simulated network failure'));
  }
  return Promise.resolve(new Response(JSON.stringify({ mocked: true, url }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
};

for (const level of ['log', 'warn', 'error', 'info']) {
  console[level] = (...args) => {
    nativeConsole[level](...args);
    const text = args.map(serializeArg).join(' ');
    consoleHistory.push({ level, text });
    post(MESSAGE_TYPES.LOG, { level, text });
  };
}

self.setTimeout = function patchedSetTimeout(fn, delay = 0, ...args) {
  timerSeq += 1;
  const label = `setTimeout #${timerSeq} (${delay}ms)`;
  pendingCount += 1;
  post(MESSAGE_TYPES.TRACE, { kind: 'schedule-macro', label, delay });
  return nativeSetTimeout(() => {
    post(MESSAGE_TYPES.TRACE, { kind: 'run-macro-start', label });
    try {
      fn(...args);
    } catch (err) {
      post(MESSAGE_TYPES.LOG, { level: 'error', text: `Uncaught in ${label}: ${err.message}` });
    } finally {
      post(MESSAGE_TYPES.TRACE, { kind: 'run-macro-end', label });
      pendingCount -= 1;
      sendDoneIfSettled(undefined);
    }
  }, delay);
};

self.queueMicrotask = function patchedQueueMicrotask(fn) {
  timerSeq += 1;
  const label = `queueMicrotask #${timerSeq}`;
  pendingCount += 1;
  post(MESSAGE_TYPES.TRACE, { kind: 'schedule-micro', label });
  nativeQueueMicrotask(() => {
    post(MESSAGE_TYPES.TRACE, { kind: 'run-micro-start', label });
    try {
      fn();
    } catch (err) {
      post(MESSAGE_TYPES.LOG, { level: 'error', text: `Uncaught in ${label}: ${err.message}` });
    } finally {
      post(MESSAGE_TYPES.TRACE, { kind: 'run-micro-end', label });
      pendingCount -= 1;
      sendDoneIfSettled(undefined);
    }
  });
};

Promise.prototype.then = function patchedThen(onFulfilled, onRejected) {
  timerSeq += 1;
  const label = `Promise.then #${timerSeq}`;
  const wrap = (handler, tag) => {
    if (typeof handler !== 'function') return handler;
    pendingCount += 1;
    post(MESSAGE_TYPES.TRACE, { kind: 'schedule-micro', label: `${label} (${tag})` });
    return (value) => {
      post(MESSAGE_TYPES.TRACE, { kind: 'run-micro-start', label: `${label} (${tag})` });
      try {
        return handler(value);
      } finally {
        post(MESSAGE_TYPES.TRACE, { kind: 'run-micro-end', label: `${label} (${tag})` });
        pendingCount -= 1;
        sendDoneIfSettled(undefined);
      }
    };
  };
  return nativePromiseThen.call(this, wrap(onFulfilled, 'resolve'), wrap(onRejected, 'reject'));
};

self.__report = (value) => {
  sendDone(value);
};

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  const reason = event.reason;
  const text = `Uncaught (in promise): ${reason instanceof Error ? reason.message : String(reason)}`;
  consoleHistory.push({ level: 'error', text });
  post(MESSAGE_TYPES.LOG, { level: 'error', text });
});

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || data.type !== MESSAGE_TYPES.RUN) return;
  const { code, testScript } = data.payload;
  requireExplicitReport = !!testScript;

  post(MESSAGE_TYPES.TRACE, { kind: 'sync-start', label: 'Global script' });
  try {
    // Learner code and (optionally) mission-authored test code share one realm so the
    // test script can call functions/values the learner defined — same as a real page
    // where a test harness exercises code loaded just before it.
    const combined = `"use strict";\n${code}\n${testScript ?? ''}`;
    new Function(combined)();
  } catch (err) {
    post(MESSAGE_TYPES.LOG, { level: 'error', text: `Uncaught: ${err.message}` });
    post(MESSAGE_TYPES.TRACE, { kind: 'sync-end', label: 'Global script' });
    sendDone(undefined, err.message);
    return;
  }
  post(MESSAGE_TYPES.TRACE, { kind: 'sync-end', label: 'Global script' });
  syncEnded = true;
  sendDoneIfSettled(undefined);
});

post(MESSAGE_TYPES.READY, {});
