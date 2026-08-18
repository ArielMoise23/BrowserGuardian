import { el, mount } from '../utils/dom.js';
import { store } from '../state/store.js';
import { MODULES } from '../game/modules.js';
import { lessonRegistry } from '../game/lessonRegistry.js';
import { getLessonEntry, moduleProgress } from '../state/learning.js';

function findContinueLesson(state) {
  for (const mod of MODULES) {
    for (const lesson of lessonRegistry.lessonsByModule(mod.id)) {
      if (!getLessonEntry(state, lesson.id).completed) return lesson;
    }
  }
  return null;
}

function renderContinueButton(state) {
  const next = findContinueLesson(state);
  if (!next) return el('a', { href: '#/review', class: 'btn btn--primary' }, 'All lessons complete — Review weak concepts');
  return el('a', { href: `#/learn/${next.id}`, class: 'btn btn--primary' }, `Continue learning: ${next.title}`);
}

export function renderLearnSidebar({ activeLessonId } = {}) {
  const searchInput = el('input', { type: 'text', class: 'learn-sidebar__search', placeholder: 'Search lessons or concepts…', 'aria-label': 'Search lessons' });
  const listContainer = el('div', {});

  function draw(filterText = '') {
    const state = store.getState();
    const q = filterText.trim().toLowerCase();

    const moduleBlocks = MODULES.map((mod) => {
      const lessons = lessonRegistry.lessonsByModule(mod.id);
      if (lessons.length === 0) return null;
      const filtered = q
        ? lessons.filter((l) => l.title.toLowerCase().includes(q) || l.skillTags.some((t) => t.toLowerCase().includes(q)))
        : lessons;
      if (q && filtered.length === 0) return null;
      const progress = moduleProgress(lessons, state);

      return el('div', { class: 'learn-sidebar__module' }, [
        el('div', { class: 'learn-sidebar__module-head' }, [
          el('span', {}, mod.title),
          el('span', {}, `${progress.completedLessons}/${progress.totalLessons}`),
        ]),
        el('div', { class: 'learn-sidebar__progress-track' }, el('div', { class: 'learn-sidebar__progress-fill', style: `width:${Math.round(progress.fraction * 100)}%` })),
        el('div', { class: 'learn-sidebar__lesson-list' }, filtered.map((lesson) => {
          const entry = getLessonEntry(state, lesson.id);
          const bookmarked = state.bookmarks.includes(lesson.id);
          const icon = entry.completed ? '✓' : bookmarked ? '★' : '›';
          const isActive = lesson.id === activeLessonId;
          return el('a', {
            class: `learn-sidebar__lesson-link${isActive ? ' is-active' : ''}`,
            href: `#/learn/${lesson.id}`,
            'aria-current': isActive ? 'page' : undefined,
          }, `${icon} ${lesson.title}`);
        })),
      ]);
    }).filter(Boolean);

    mount(listContainer, moduleBlocks.length ? moduleBlocks : [el('p', { class: 'empty-state' }, 'No lessons match your search.')]);
  }
  draw();
  searchInput.addEventListener('input', () => draw(searchInput.value));

  return el('div', { class: 'learn-sidebar' }, [
    renderContinueButton(store.getState()),
    el('a', { href: '#/review', class: 'btn btn--sm' }, 'Review weak concepts'),
    searchInput,
    listContainer,
  ]);
}
