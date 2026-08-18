import { el } from '../utils/dom.js';
import { store } from '../state/store.js';
import { MODULES } from '../game/modules.js';
import { lessonRegistry } from '../game/lessonRegistry.js';
import { getLessonEntry, moduleProgress } from '../state/learning.js';

export function renderLearnMap() {
  const state = store.getState();
  const totalLessons = lessonRegistry.allLessons().length;
  const completedLessons = lessonRegistry.allLessons().filter((l) => getLessonEntry(state, l.id).completed).length;

  const grid = el('div', { class: 'chapter-grid' }, MODULES.map((mod) => renderModuleCard(mod, state)));

  return el('div', { class: 'chapter-map' }, [
    el('div', { class: 'chapter-map__header' }, [
      el('h1', {}, 'Guided Learning'),
      el('p', {}, 'Learn each concept before you\'re tested on it: a mental model, a real executable example, a step-by-step runtime walkthrough, and focused micro-labs — then apply it in the matching Challenge Mode mission.'),
      el('div', { class: 'chapter-map__stats' }, [
        statTile('Lessons complete', `${completedLessons} / ${totalLessons}`),
      ]),
    ]),
    grid,
  ]);
}

function statTile(label, value) {
  return el('div', { class: 'stat-tile' }, [el('div', { class: 'stat-tile__value' }, String(value)), el('div', { class: 'stat-tile__label' }, label)]);
}

function renderModuleCard(mod, state) {
  const lessons = lessonRegistry.lessonsByModule(mod.id);
  const locked = lessons.length === 0;
  const progress = moduleProgress(lessons, state);

  const lessonList = lessons.length
    ? el('div', { class: 'mission-list' }, lessons.map((lesson) => {
        const entry = getLessonEntry(state, lesson.id);
        return el('a', { class: `mission-row${entry.completed ? ' mission-row--complete' : ''}`, href: `#/learn/${lesson.id}` }, [
          el('span', { class: 'mission-row__icon' }, entry.completed ? '✓' : '›'),
          el('span', { class: 'mission-row__title' }, lesson.title),
          el('span', { class: 'badge' }, `~${lesson.estimatedMinutes} min`),
        ]);
      }))
    : el('p', { class: 'empty-state' }, 'Content pending in this lab build.');

  return el('div', { class: `chapter-card${locked ? ' chapter-card--locked' : ''}` }, [
    el('h2', { class: 'chapter-card__title' }, [el('span', { class: 'chapter-card__num' }, `Mod.${mod.number}`), el('span', {}, mod.title)]),
    el('p', { class: 'chapter-card__desc' }, mod.summary),
    lessons.length ? el('div', { class: 'learn-sidebar__progress-track' }, el('div', { class: 'learn-sidebar__progress-fill', style: `width:${Math.round(progress.fraction * 100)}%` })) : null,
    lessonList,
  ].filter(Boolean));
}
