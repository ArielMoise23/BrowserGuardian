import { el } from '../utils/dom.js';

export function renderPanel(title, bodyNode, { flush = false, actions = [] } = {}) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'panel__head' }, [el('span', { class: 'panel__title' }, title), el('div', { class: 'btn-row' }, actions)]),
    el('div', { class: `panel__body${flush ? ' panel__body--flush' : ''}` }, bodyNode),
  ]);
}
