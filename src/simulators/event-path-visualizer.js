import { el } from '../utils/dom.js';

/** Renders the real capture→target→bubble path recorded by a traced dispatch in the iframe sandbox. */
export function renderEventPath(pathEntries) {
  if (!pathEntries || pathEntries.length === 0) {
    return el('p', { class: 'empty-state' }, 'No event dispatched yet.');
  }
  return el(
    'div',
    { class: 'event-path' },
    pathEntries.map((entry) =>
      el('div', { class: `event-path__node${entry.isTarget ? ' is-target' : ''}` }, [
        el('span', {}, entry.node),
        el('span', { class: 'event-path__phase' }, entry.phase),
      ])
    )
  );
}
