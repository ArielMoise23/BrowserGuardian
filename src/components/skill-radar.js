import { el } from '../utils/dom.js';
import { categoryLabel } from '../game/interviewBank.js';

export function renderSkillBars(skills) {
  const entries = Object.entries(skills).sort((a, b) => b[1] - a[1]);
  return el(
    'div',
    { class: 'skill-bars' },
    entries.map(([tag, value]) =>
      el('div', { class: 'skill-bar' }, [
        el('span', {}, categoryLabel(tag)),
        el('div', { class: 'skill-bar__track' }, el('div', { class: 'skill-bar__fill', style: `width:${value}%` })),
        el('span', { class: 'skill-bar__val' }, String(value)),
      ])
    )
  );
}
