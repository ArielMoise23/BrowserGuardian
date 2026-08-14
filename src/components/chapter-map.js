import { el } from '../utils/dom.js';
import { CHAPTERS } from '../game/chapters.js';
import { xpProgress, computeStreaks } from '../state/progress.js';

export function renderChapterMap(state, registry) {
  const progress = xpProgress(state.xp);
  const streak = computeStreaks(state.activityDates);
  const totalMissions = registry.allMissions().length;
  const completedMissions = registry.allMissions().filter((m) => state.missions[m.id]?.completed).length;

  const stats = el('div', { class: 'chapter-map__stats' }, [
    statTile('Level', progress.level),
    statTile('XP', `${progress.xpIntoLevel} / ${progress.xpForNextLevel}`),
    statTile('Missions complete', `${completedMissions} / ${totalMissions}`),
    statTile('Streak', `${streak.current}d (best ${streak.best}d)`),
    statTile('Achievements', state.achievements.length),
  ]);

  const grid = el(
    'div',
    { class: 'chapter-grid' },
    CHAPTERS.map((chapter) => renderChapterCard(chapter, registry, state))
  );

  return el('div', { class: 'chapter-map' }, [
    el('div', { class: 'chapter-map__header' }, [
      el('h1', {}, 'Mission Map'),
      el('p', {}, 'Browser Guardian: Runtime Defense Lab — work through each chapter\'s missions to build the runtime and browser-security depth a JavaScript Security Engineer role expects.'),
      stats,
    ]),
    grid,
  ]);
}

function statTile(label, value) {
  return el('div', { class: 'stat-tile' }, [el('div', { class: 'stat-tile__value' }, String(value)), el('div', { class: 'stat-tile__label' }, label)]);
}

function renderChapterCard(chapter, registry, state) {
  const missions = registry.missionsByChapter(chapter.number);
  const locked = missions.length === 0;

  const missionList = missions.length
    ? el(
        'div',
        { class: 'mission-list' },
        missions.map((mission) => {
          const record = state.missions[mission.id];
          const icon = record?.completed ? '✓' : '›';
          return el('a', { class: `mission-row${record?.completed ? ' mission-row--complete' : ''}`, href: `#/mission/${mission.id}` }, [
            el('span', { class: 'mission-row__icon' }, icon),
            el('span', { class: 'mission-row__title' }, mission.title),
            el('span', { class: 'badge' }, mission.type),
          ]);
        })
      )
    : el('p', { class: 'empty-state' }, 'Content pending in this lab build.');

  return el('div', { class: `chapter-card${locked ? ' chapter-card--locked' : ''}` }, [
    el('div', { class: 'chapter-card__title' }, [el('span', { class: 'chapter-card__num' }, `Ch.${chapter.number}`), el('span', {}, chapter.title)]),
    el('p', { class: 'chapter-card__desc' }, chapter.summary),
    missionList,
  ]);
}
