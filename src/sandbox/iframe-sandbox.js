// Host-side (main thread) driver for the iframe sandbox. The iframe carries
// sandbox="allow-scripts" WITHOUT allow-same-origin, so it gets an opaque origin and
// its own realm — the parent cannot reach into its DOM directly, only postMessage.
//
// Known limitation (see README): unlike the Worker sandbox, this cannot forcibly
// terminate a synchronous infinite loop inside the sandboxed document. Missions that
// route through this runner are authored to avoid needing that guarantee.
import { MESSAGE_TYPES, makeEnvelope, isValidEnvelope } from './protocol.js';

const RUNTIME_URL = new URL('./iframe-runtime.html', import.meta.url);
const DEFAULT_TIMEOUT_MS = 6000;

export function createIframeSandbox(hostElement) {
  let iframe = null;
  let runId = 0;

  function spawn() {
    iframe = document.createElement('iframe');
    iframe.className = 'site-preview-frame';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('title', 'Sandboxed mission simulation (isolated realm, no network access)');
    iframe.src = RUNTIME_URL.href;
    hostElement.replaceChildren(iframe);
  }

  function teardown() {
    if (iframe) {
      iframe.remove();
      iframe = null;
    }
  }

  function run(payload, callbacks = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, onLog, onTrace, onNetwork, onSecurityAlert, onDomSnapshot, onEventPath } = callbacks;
    return new Promise((resolve) => {
      const thisRun = (runId += 1);
      teardown();
      spawn();

      let settled = false;
      let watchdog;

      function onMessage(event) {
        if (thisRun !== runId || !iframe || event.source !== iframe.contentWindow) return;
        if (!isValidEnvelope(event.data)) return;
        const { type, payload: msgPayload } = event.data;
        if (type === MESSAGE_TYPES.READY) {
          iframe.contentWindow.postMessage(makeEnvelope(MESSAGE_TYPES.RUN, payload), '*');
        } else if (type === MESSAGE_TYPES.LOG) onLog?.(msgPayload);
        else if (type === MESSAGE_TYPES.TRACE) onTrace?.(msgPayload);
        else if (type === MESSAGE_TYPES.NETWORK) onNetwork?.(msgPayload);
        else if (type === MESSAGE_TYPES.SECURITY_ALERT) onSecurityAlert?.(msgPayload);
        else if (type === MESSAGE_TYPES.DOM_SNAPSHOT) onDomSnapshot?.(msgPayload);
        else if (type === MESSAGE_TYPES.EVENT_PATH) onEventPath?.(msgPayload);
        else if (type === MESSAGE_TYPES.DONE) finish({ ...msgPayload, timedOut: false });
      }

      function finish(result) {
        if (settled || thisRun !== runId) return;
        settled = true;
        clearTimeout(watchdog);
        window.removeEventListener('message', onMessage);
        resolve(result);
      }

      watchdog = setTimeout(() => {
        finish({ returnValue: undefined, error: 'Execution timed out (mission simulation took too long).', timedOut: true });
      }, timeoutMs);

      window.addEventListener('message', onMessage);
    });
  }

  function reset() {
    runId += 1;
    teardown();
  }

  return { run, reset };
}
