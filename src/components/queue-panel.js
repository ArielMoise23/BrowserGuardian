import { el } from '../utils/dom.js';

function renderQueue(queue, className) {
  if (!queue || queue.length === 0) return el('p', { class: 'empty-state' }, 'empty');
  return el('div', { class: 'frame-stack' }, queue.map((label) => el('div', { class: `frame-item ${className}` }, label)));
}

export function renderMacroQueue(queue) {
  return renderQueue(queue, 'frame-item--macro');
}

export function renderMicroQueue(queue) {
  return renderQueue(queue, 'frame-item--micro');
}
