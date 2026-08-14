import { el, mount } from '../utils/dom.js';
import { store } from '../state/store.js';
import { showToast } from './toast.js';

export function renderSettings(state) {
  const container = el('div', { class: 'card', style: 'max-width:520px' });

  function draw() {
    const current = store.getState();
    mount(container, [
      el('h1', {}, 'Settings'),
      el('div', { class: 'field' }, [
        el('label', {}, 'Reduced motion'),
        el('select', {
          onChange: (e) => store.updateSettings({ reducedMotion: e.target.value }),
        }, ['system', 'on', 'off'].map((opt) =>
          el('option', { value: opt, selected: current.settings.reducedMotion === opt || undefined }, opt)
        )),
      ]),
      el('p', {}, 'Your OS-level "prefers reduced motion" setting is always respected regardless of this option.'),
      el('hr', {}),
      el('h2', {}, 'Reset progress'),
      el('p', {}, 'Clears all XP, mission completions, skill ratings, and achievements from this browser. This cannot be undone.'),
      el('button', {
        class: 'btn btn--danger',
        onClick: () => {
          if (confirm('Reset all progress? This clears XP, missions, skills, and achievements and cannot be undone.')) {
            store.resetProgress();
            showToast('Progress reset.', 'info');
            draw();
          }
        },
      }, 'Reset all progress'),
    ]);
  }

  draw();
  return container;
}
