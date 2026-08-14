import { SKILL_CATEGORIES } from './persistence.js';

const EWMA_ALPHA = 0.35; // weight given to the newest observation

/** Nudges a single 0-100 rating toward an observed 0-100 sample. */
export function updateRating(current, observedScore0to100) {
  const clamped = Math.max(0, Math.min(100, observedScore0to100));
  return Math.round(current + EWMA_ALPHA * (clamped - current));
}

/**
 * Applies a mission's composite score (0-1) to every skill tag it covers.
 * Returns a new skills object; unrelated categories are untouched.
 */
export function applySkillUpdate(skills, skillTags, composite0to1) {
  const observed = composite0to1 * 100;
  const next = { ...skills };
  for (const tag of skillTags) {
    if (!(tag in next)) continue;
    next[tag] = updateRating(next[tag], observed);
  }
  return next;
}

export function weakestCategories(skills, count = 3) {
  return Object.entries(skills)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([category]) => category);
}

export function strongestCategories(skills, count = 3) {
  return Object.entries(skills)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([category]) => category);
}

export { SKILL_CATEGORIES };
