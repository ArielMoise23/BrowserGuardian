import { startRouter } from './router.js';
import { store } from './state/store.js';
import { xpProgress, computeStreaks } from './state/progress.js';

function renderHeaderStatus(state) {
  const status = document.getElementById('header-status');
  if (!status) return;
  const progress = xpProgress(state.xp);
  const streak = computeStreaks(state.activityDates);
  status.textContent = `Lv.${progress.level} · ${progress.xpIntoLevel}/${progress.xpForNextLevel} XP · 🔥${streak.current}d streak`;
}

renderHeaderStatus(store.getState());
store.subscribe(renderHeaderStatus);

startRouter();
