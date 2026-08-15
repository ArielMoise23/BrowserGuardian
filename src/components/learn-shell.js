import { el } from '../utils/dom.js';
import { renderLearnSidebar } from './learn-sidebar.js';

/** Wraps any Guided Learning page (module map, lesson view) with the persistent sidebar. */
export function renderLearnShell(content, { activeLessonId } = {}) {
  return el('div', { class: 'learn-shell' }, [
    renderLearnSidebar({ activeLessonId }),
    el('div', { class: 'learn-shell__content' }, content),
  ]);
}
