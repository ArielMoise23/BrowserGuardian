import { el } from '../utils/dom.js';

export function showToast(message, type = 'info', durationMs = 4500) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = el('div', { class: `toast toast--${type}`, role: 'status' }, message);
  root.append(node);
  setTimeout(() => node.remove(), durationMs);
}
