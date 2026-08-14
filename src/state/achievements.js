import { computeStreaks } from './progress.js';

export const ACHIEVEMENTS = [
  {
    id: 'first-blood',
    title: 'First Blood',
    description: 'Completed your first mission.',
    check: (state) => Object.values(state.missions).some((m) => m.completed),
  },
  {
    id: 'perfect-run',
    title: 'Clean Sweep',
    description: 'Scored a perfect composite on any mission.',
    check: (state) => Object.values(state.missions).some((m) => m.bestScore?.composite >= 0.999),
  },
  {
    id: 'realm-walker',
    title: 'Realm Walker',
    description: 'Completed a mission that runs code in an isolated realm with its own globals and prototypes.',
    check: (state) => state.missions['third-party-checkout']?.completed === true,
  },
  {
    id: 'no-false-positives',
    title: 'Zero False Positives',
    description: 'Refined a security policy to catch the attacker without blocking the legitimate script.',
    check: (state) => {
      const m = state.missions['the-false-positive'];
      return !!m?.completed && m.bestScore?.security >= 0.99 && m.bestScore?.compatibility >= 0.99;
    },
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Brought a monitoring hot path under the performance budget without losing detection.',
    check: (state) => {
      const m = state.missions['security-at-200ms'];
      return !!m?.completed && m.bestScore?.performance >= 0.99;
    },
  },
  {
    id: 'streak-3',
    title: 'Consistent',
    description: 'Trained on 3 consecutive days.',
    check: (state) => computeStreaks(state.activityDates).best >= 3,
  },
  {
    id: 'streak-7',
    title: 'Dedicated',
    description: 'Trained on 7 consecutive days.',
    check: (state) => computeStreaks(state.activityDates).best >= 7,
  },
  {
    id: 'full-clear',
    title: 'Runtime Guardian',
    description: 'Completed every mission in the current lab build.',
    check: (state, registry) =>
      registry.allMissions().every((mission) => state.missions[mission.id]?.completed),
  },
];

/** Returns achievement ids newly unlocked by the current state (not already recorded). */
export function checkNewAchievements(state, registry) {
  return ACHIEVEMENTS
    .filter((a) => !state.achievements.includes(a.id))
    .filter((a) => a.check(state, registry))
    .map((a) => a.id);
}
