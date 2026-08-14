// Host-side (main thread) driver for the Worker sandbox. A fresh Worker is spawned
// per run so every execution starts from pristine globals, and `worker.terminate()`
// gives a real, forced stop even against a synchronous infinite loop — the one thing
// the iframe sandbox below cannot guarantee.
import { MESSAGE_TYPES, makeEnvelope, isValidEnvelope } from './protocol.js';

const WORKER_URL = new URL('./worker-runtime.js', import.meta.url);
const DEFAULT_TIMEOUT_MS = 4000;

export function createWorkerSandbox() {
  let worker = null;
  let runId = 0;

  function spawn() {
    worker = new Worker(WORKER_URL, { type: 'module' });
  }

  function terminate() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  function run(code, { testScript, timeoutMs = DEFAULT_TIMEOUT_MS, onLog, onTrace } = {}) {
    return new Promise((resolve) => {
      const thisRun = (runId += 1);
      terminate();
      spawn();

      let settled = false;
      const finish = (result) => {
        if (settled || thisRun !== runId) return;
        settled = true;
        clearTimeout(watchdog);
        resolve(result);
      };

      const watchdog = setTimeout(() => {
        terminate();
        finish({ returnValue: undefined, error: 'Execution timed out (possible infinite loop).', timedOut: true });
      }, timeoutMs);

      worker.addEventListener('message', (event) => {
        if (thisRun !== runId || !isValidEnvelope(event.data)) return;
        const { type, payload } = event.data;
        if (type === MESSAGE_TYPES.READY) {
          worker.postMessage(makeEnvelope(MESSAGE_TYPES.RUN, { code, testScript }));
        } else if (type === MESSAGE_TYPES.LOG) {
          onLog?.(payload);
        } else if (type === MESSAGE_TYPES.TRACE) {
          onTrace?.(payload);
        } else if (type === MESSAGE_TYPES.DONE) {
          finish({ ...payload, timedOut: false });
        }
      });

      worker.addEventListener('error', (err) => {
        finish({ returnValue: undefined, error: err.message ?? 'Unknown worker error', timedOut: false });
      });
    });
  }

  return { run, reset: terminate };
}
