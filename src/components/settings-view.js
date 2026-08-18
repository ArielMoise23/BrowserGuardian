import { el, mount, field } from '../utils/dom.js';
import { store } from '../state/store.js';
import { showToast } from './toast.js';
import { renderSkillBars } from './skill-radar.js';

export function renderSettings(state) {
  const container = el('div', { class: 'card', style: 'max-width:640px' });

  function draw() {
    const current = store.getState();
    mount(container, [
      el('h1', {}, 'Settings'),
      field('Reduced motion', el('select', {
        onChange: (e) => store.updateSettings({ reducedMotion: e.target.value }),
      }, ['system', 'on', 'off'].map((opt) =>
        el('option', { value: opt, selected: current.settings.reducedMotion === opt || undefined }, opt)
      ))),
      el('p', {}, 'Your OS-level "prefers reduced motion" setting is always respected regardless of this option.'),
      el('hr', {}),
      el('h2', {}, 'Skill ratings'),
      el('p', {}, 'Updated by mission and lab results and by self-scored Interview Mode answers. 50 is the untested starting point for every category, not a passing grade.'),
      renderSkillBars(current.skills),
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
