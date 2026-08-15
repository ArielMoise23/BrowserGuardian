import { el } from '../utils/dom.js';

function renderQueue(queue, className, emptyLabel) {
  if (!queue || queue.length === 0) return el('p', { class: 'empty-state' }, emptyLabel);
  return el('div', { class: 'frame-stack' }, queue.map((label) => el('div', { class: `frame-item ${className}` }, label)));
}

export function renderMacroQueue(queue) {
  return renderQueue(queue, 'frame-item--macro', 'Macrotask queue empty.');
}

export function renderMicroQueue(queue) {
  return renderQueue(queue, 'frame-item--micro', 'Microtask queue empty.');
}
