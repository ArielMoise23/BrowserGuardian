// Shared postMessage envelope used by both sandbox runners (Worker and iframe) and
// their hosts. Keeping this in one file means both sides agree on the exact shape.

export const MESSAGE_TYPES = Object.freeze({
  READY: 'ready',
  RUN: 'run',
  LOG: 'log',
  TRACE: 'trace',
  NETWORK: 'network',
  SECURITY_ALERT: 'security-alert',
  DOM_SNAPSHOT: 'dom-snapshot',
  EVENT_PATH: 'event-path',
  DONE: 'done',
});

let nonceCounter = 0;
export function nextNonce() {
  nonceCounter += 1;
  return `n${Date.now().toString(36)}${nonceCounter}`;
}

export function makeEnvelope(type, payload, nonce) {
  return { channel: 'bg-rdl', type, payload, nonce: nonce ?? nextNonce() };
}

/** Structural validation only — never trust a message just because it parses. */
export function isValidEnvelope(data) {
  return (
    !!data &&
    typeof data === 'object' &&
    data.channel === 'bg-rdl' &&
    typeof data.type === 'string' &&
    Object.values(MESSAGE_TYPES).includes(data.type)
  );
}

/** Best-effort serialization for console.log-style arguments crossing a postMessage boundary. */
export function serializeArg(value) {
  try {
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return `ƒ ${value.name || '(anonymous)'}()`;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === 'object') return JSON.stringify(value, null, 0);
    return String(value);
  } catch {
    return '[unserializable value]';
  }
}
