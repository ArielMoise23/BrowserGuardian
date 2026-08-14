export function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function truncate(str, max = 60) {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}
