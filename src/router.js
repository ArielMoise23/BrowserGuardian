import { mount } from './utils/dom.js';
import { focusMain } from './utils/a11y.js';
import { renderChapterMap } from './components/chapter-map.js';
import { renderMissionView } from './components/mission-view.js';
import { renderInterviewMode } from './components/interview-mode.js';
import { renderSettings } from './components/settings-view.js';
import { renderLearnMap } from './components/learn-map.js';
import { renderLessonView } from './components/lesson-view.js';
import { renderReviewScreen } from './components/review-weak-concepts.js';
import { renderLearnShell } from './components/learn-shell.js';
import { registry } from './game/missionRegistry.js';
import { lessonRegistry } from './game/lessonRegistry.js';
import { store } from './state/store.js';

const main = document.getElementById('main');
let activeCleanup = null;
let hasRenderedOnce = false;

// Detail screens that manage their own live state (a running sandbox, revealed
// hints, in-progress typing) must not be blown away by unrelated store changes
// elsewhere in the app — only the hash actually changing should replace them.
const OWNS_ITS_OWN_RENDER = /^#\/(mission|learn)\/.+/;

function setActiveNav(hash) {
  document.querySelectorAll('.app-header__nav a').forEach((a) => {
    const href = a.getAttribute('href');
    const active = href === hash
      || (hash.startsWith('#/mission') && href === '#/map')
      || (hash.startsWith('#/learn') && href === '#/learn');
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function render() {
  activeCleanup?.();
  activeCleanup = null;

  const hash = location.hash || '#/map';
  setActiveNav(hash);
  const missionMatch = hash.match(/^#\/mission\/(.+)$/);
  const lessonMatch = hash.match(/^#\/learn\/([^?]+)(?:\?lab=(.+))?$/);

  if (missionMatch) {
    const mission = registry.getMission(decodeURIComponent(missionMatch[1]));
    if (!mission) {
      mount(main, notFound('Mission not found.'));
    } else {
      const { element, cleanup } = renderMissionView(mission, registry);
      activeCleanup = cleanup;
      mount(main, element);
    }
  } else if (lessonMatch) {
    const lesson = lessonRegistry.getLesson(decodeURIComponent(lessonMatch[1]));
    if (!lesson) {
      mount(main, notFound('Lesson not found.'));
    } else {
      const focusLabId = lessonMatch[2] ? decodeURIComponent(lessonMatch[2]) : undefined;
      const { element } = renderLessonView(lesson, { focusLabId });
      mount(main, renderLearnShell(element, { activeLessonId: lesson.id }));
    }
  } else if (hash === '#/learn') {
    mount(main, renderLearnShell(renderLearnMap()));
  } else if (hash === '#/review') {
    mount(main, renderReviewScreen());
  } else if (hash === '#/interview') {
    mount(main, renderInterviewMode(store.getState()));
  } else if (hash === '#/settings') {
    mount(main, renderSettings(store.getState()));
  } else {
    mount(main, renderChapterMap(store.getState(), registry));
  }
  // Move focus into the new content on in-app navigation (standard SPA pattern), but
  // not on the very first render — that would steal focus from the skip-link before a
  // keyboard user ever gets a chance to tab to it on initial page load.
  if (hasRenderedOnce) focusMain();
  hasRenderedOnce = true;
}

function notFound(message) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  return div;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  store.subscribe(() => {
    if (!OWNS_ITS_OWN_RENDER.test(location.hash)) render();
  });
  render();
}
