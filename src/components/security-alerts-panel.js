import { el } from '../utils/dom.js';

export function renderAlerts(alerts) {
  if (!alerts || alerts.length === 0) return el('p', { class: 'empty-state' }, 'No security alerts raised.');
  return el(
    'div',
    { class: 'alert-list' },
    alerts.map((a) =>
      el('div', { class: `alert-item alert-item--${a.level === 'critical' || a.level === 'high' ? 'danger' : a.level === 'medium' ? 'warning' : 'info'}` }, [
        el('div', { class: 'alert-item__head' }, [el('span', {}, a.level), a.source ? el('span', {}, a.source) : null].filter(Boolean)),
        el('div', {}, a.message),
      ])
    )
  );
}
