import { el } from '../utils/dom.js';

export function renderConsole(lines) {
  if (!lines || lines.length === 0) return el('p', { class: 'console-empty' }, 'No output yet. Click Run.');
  return el(
    'ul',
    { class: 'console-log-list' },
    lines.map((line) =>
      el('li', { class: `log-${line.level}` }, [
        el('span', { class: 'log-level' }, line.level),
        el('span', {}, line.text),
      ])
    )
  );
}
