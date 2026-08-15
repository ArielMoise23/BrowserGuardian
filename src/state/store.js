import { loadState, saveState, clearState, defaultState } from './persistence.js';
import { recordMissionResult } from './progress.js';
import { applySkillUpdate } from './skills.js';
import { checkNewAchievements } from './achievements.js';
import { createPubSub } from '../utils/pubsub.js';
import {
  touchLesson, recordExampleRun, recordLabResult, recordKnowledgeCheck,
  computeLessonCompletion, markLessonComplete, resetLessonProgress,
} from './learning.js';
import { recordMistake, resolveMistakesFor } from './review.js';

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

    // --- Guided Learning Mode ---

    visitLesson(lessonId) {
      set(touchLesson(state, lessonId));
    },

    markExampleRun(lessonId) {
      set(recordExampleRun(state, lessonId));
    },

    /** Records a lab attempt: progress, skills, mistake tracking, and lesson completion. */
    submitLabResult(lesson, lab, result) {
      const { state: afterLab, isFirstPass, attemptNumber } = recordLabResult(state, lesson.id, lab.id, result);
      let next = { ...afterLab, skills: applySkillUpdate(afterLab.skills, lesson.skillTags, result.score.composite) };
      next = result.passed
        ? resolveMistakesFor(next, lesson.id, lab.id)
        : recordMistake(next, { lessonId: lesson.id, labId: lab.id, mistakeType: lab.type });
      if (computeLessonCompletion(lesson, next)) next = markLessonComplete(next, lesson.id);
      set(next);
      return { newState: next, isFirstPass, attemptNumber };
    },

    submitKnowledgeCheck(lesson, question, selfScore0to100) {
      let next = recordKnowledgeCheck(state, lesson.id, question.id, selfScore0to100);
      next = { ...next, skills: applySkillUpdate(next.skills, [question.skillTag], selfScore0to100 / 100) };
      if (computeLessonCompletion(lesson, next)) next = markLessonComplete(next, lesson.id);
      set(next);
    },

    toggleBookmark(lessonId) {
      const has = state.bookmarks.includes(lessonId);
      set({ ...state, bookmarks: has ? state.bookmarks.filter((id) => id !== lessonId) : [...state.bookmarks, lessonId] });
    },

    saveNote(lessonId, text) {
      set({ ...state, notes: { ...state.notes, [lessonId]: text } });
    },

    resetLesson(lessonId) {
      set(resetLessonProgress(state, lessonId));
    },
  };
}

export const store = createStore();
