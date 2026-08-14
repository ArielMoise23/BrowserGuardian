import { el } from '../utils/dom.js';
import { canRevealMore } from '../game/hints.js';

export function renderHints(hints, revealedCount, onRevealNext) {
  const items = hints.map((hint, i) =>
    el('div', { class: `hint-item${i < revealedCount ? ' hint-item--revealed' : ''}` },
      i < revealedCount ? hint : `Hint ${i + 1} (hidden)`
    )
  );

  const button = el(
    'button',
    { class: 'btn btn--sm', onClick: () => onRevealNext(), disabled: !canRevealMore(revealedCount, hints.length) },
    canRevealMore(revealedCount, hints.length) ? `Reveal hint ${revealedCount + 1} of ${hints.length}` : 'All hints revealed'
  );

  return el('div', { class: 'hint-list' }, [...items, button]);
}
