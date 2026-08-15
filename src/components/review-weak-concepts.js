import { el } from '../utils/dom.js';
import { store } from '../state/store.js';
import { lessonRegistry } from '../game/lessonRegistry.js';
import { labTypeLabel } from '../game/lessonSchema.js';
import { weakestConcepts, mistakeHistory } from '../state/review.js';

export function renderReviewScreen() {
  const state = store.getState();
  const weak = weakestConcepts(state, lessonRegistry, 8);
  const history = mistakeHistory(state, lessonRegistry).slice(0, 25);

  return el('div', { class: 'chapter-map' }, [
    el('div', { class: 'chapter-map__header' }, [
      el('h1', {}, 'Review'),
      el('p', {}, 'Concepts you\'ve struggled with, ranked by how many attempts it took — each links straight to the exact micro-lab, not a random quiz.'),
    ]),
    el('div', { class: 'card' }, [
      el('h2', {}, 'Weak concepts to retry'),
      weak.length
        ? el('div', { class: 'mission-list' }, weak.map((w) => el('a', { class: 'mission-row', href: `#/learn/${w.lessonId}?lab=${w.labId}` }, [
            el('span', { class: 'mission-row__icon' }, '↻'),
            el('span', { class: 'mission-row__title' }, `${w.labTitle} — ${w.lessonTitle}`),
            el('span', { class: 'badge badge--warning' }, `${w.failedAttempts} failed attempt${w.failedAttempts === 1 ? '' : 's'}`),
          ])))
        : el('p', { class: 'empty-state' }, 'No unresolved mistakes right now.'),
    ]),
    el('div', { class: 'card' }, [
      el('h2', {}, 'Mistake history'),
      history.length
        ? el('table', { class: 'network-table' }, [
            el('thead', {}, el('tr', {}, ['Lesson', 'Lab', 'Type', 'Attempts', 'Status', 'Date'].map((h) => el('th', {}, h)))),
            el('tbody', {}, history.map((m) => el('tr', {}, [
              el('td', {}, m.lessonTitle),
              el('td', {}, m.labTitle),
              el('td', {}, labTypeLabel(m.mistakeType)),
              el('td', {}, String(m.failedAttempts)),
              el('td', {}, m.resolved ? 'Resolved' : 'Unresolved'),
              el('td', {}, new Date(m.date).toLocaleDateString()),
            ]))),
          ])
        : el('p', { class: 'empty-state' }, 'No mistakes recorded yet — they show up here the first time a lab submission doesn\'t pass.'),
    ]),
  ]);
}
