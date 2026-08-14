import { mount } from './utils/dom.js';
import { focusMain } from './utils/a11y.js';
import { renderChapterMap } from './components/chapter-map.js';
import { renderMissionView } from './components/mission-view.js';
import { renderInterviewMode } from './components/interview-mode.js';
import { renderSettings } from './components/settings-view.js';
import { registry } from './game/missionRegistry.js';
import { store } from './state/store.js';

const main = document.getElementById('main');
let activeCleanup = null;
let hasRenderedOnce = false;

function setActiveNav(hash) {
  document.querySelectorAll('.app-header__nav a').forEach((a) => {
    a.classList.toggle('is-active', a.getAttribute('href') === hash || (hash.startsWith('#/mission') && a.getAttribute('href') === '#/map'));
  });
}

function render() {
  activeCleanup?.();
  activeCleanup = null;

  const hash = location.hash || '#/map';
  setActiveNav(hash);
  const missionMatch = hash.match(/^#\/mission\/(.+)$/);

  if (missionMatch) {
    const mission = registry.getMission(decodeURIComponent(missionMatch[1]));
    if (!mission) {
      mount(main, notFound());
    } else {
      const { element, cleanup } = renderMissionView(mission, registry);
      activeCleanup = cleanup;
      mount(main, element);
    }
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

function notFound() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = 'Mission not found.';
  return div;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  store.subscribe(() => {
    // Re-render the map/settings screens live when state changes elsewhere; mission
    // view manages its own live panels and shouldn't be blown away mid-run.
    if (!location.hash.startsWith('#/mission/')) render();
  });
  render();
}
