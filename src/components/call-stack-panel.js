import { el } from '../utils/dom.js';

export function renderCallStack(stack) {
  if (!stack || stack.length === 0) return el('p', { class: 'empty-state' }, 'Call stack empty.');
  return el('div', { class: 'frame-stack' }, stack.map((frame) => el('div', { class: 'frame-item' }, frame)));
}
