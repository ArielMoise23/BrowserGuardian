import { loadState, saveState, clearState, defaultState } from './persistence.js';
import { recordMissionResult } from './progress.js';
import { applySkillUpdate } from './skills.js';
import { checkNewAchievements } from './achievements.js';
import { createPubSub } from '../utils/pubsub.js';

function createStore() {
  let state = loadState();
  const bus = createPubSub();

  function set(nextState) {
    state = nextState;
    saveState(state);
    bus.emit('change', state);
  }

  return {
    getState: () => state,
    subscribe: (fn) => bus.on('change', fn),

    /** Applies a mission attempt result: progress, XP, skills, and achievement checks. */
    submitMissionResult(mission, result, registry) {
      let next = recordMissionResult(state, mission.id, result);
      next = { ...next, skills: applySkillUpdate(next.skills, mission.skillTags, result.score.composite) };
      const unlocked = checkNewAchievements(next, registry);
      if (unlocked.length) {
        next = { ...next, achievements: [...next.achievements, ...unlocked] };
      }
      set(next);
      return { newState: next, unlockedAchievements: unlocked };
    },

    recordInterviewAnswer(entry) {
      set({
        ...state,
        interview: { ...state.interview, history: [...state.interview.history, entry] },
      });
    },

    updateSkillsFromInterview(skillTag, selfScore0to100) {
      const next = { ...state, skills: applySkillUpdate(state.skills, [skillTag], selfScore0to100 / 100) };
      set(next);
    },

    updateSettings(patch) {
      set({ ...state, settings: { ...state.settings, ...patch } });
    },

    resetProgress() {
      set(defaultState());
      clearState();
      saveState(defaultState());
    },
  };
}

export const store = createStore();
