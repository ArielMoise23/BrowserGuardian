import { el } from '../utils/dom.js';
import { formatPercent } from '../utils/format.js';

const DIMENSION_LABELS = { correctness: 'Correctness', security: 'Security', compatibility: 'Compatibility', performance: 'Performance' };

// Fraction is always shown as a number too — color is reinforcement, not the only signal.
function scoreTone(fraction) {
  if (fraction >= 0.7) return 'success';
  if (fraction >= 0.4) return 'warning';
  return 'danger';
}

export function renderScoreMeter(label, fraction) {
  return el('div', { class: 'score-meter' }, [
    el('div', { class: 'score-meter__label' }, [el('span', {}, label), el('span', {}, formatPercent(fraction))]),
    el('div', { class: 'score-meter__bar' }, el('div', { class: `score-meter__fill score-meter__fill--${scoreTone(fraction)}`, style: `width:${Math.round(fraction * 100)}%` })),
  ]);
}

export function renderDebrief(mission, result, relatedLessons = []) {
  const meters = Object.entries(DIMENSION_LABELS)
    .filter(([key]) => typeof result.score[key] === 'number')
    .map(([key, label]) => renderScoreMeter(label, result.score[key]));

  const section = (title, content) => el('div', { class: 'debrief__section' }, [el('h3', {}, title), typeof content === 'string' ? el('p', {}, content) : content]);

  const reviewLink = !result.passed && relatedLessons.length
    ? el('div', { class: 'debrief__section' }, [
        el('h3', {}, 'Review the concept'),
        el('p', {}, [
          'If something here didn\'t click, work through ',
          ...relatedLessons.flatMap((lesson, i) => [i > 0 ? ', ' : '', el('a', { href: `#/learn/${lesson.id}` }, lesson.title)]),
          ' in Guided Learning before trying again.',
        ]),
      ])
    : null;

  return el('div', { class: 'debrief' }, [
    el('div', {}, [
      el('h2', { class: `debrief__verdict debrief__verdict--${result.passed ? 'success' : 'danger'}` }, [
        el('span', { 'aria-hidden': 'true' }, result.passed ? '✓ ' : '✕ '),
        result.passed ? 'Mission passed' : 'Not yet — review the debrief below',
      ]),
      el('p', {}, `+${result.xpAward} XP toward this mission's ${mission.xp} XP total.`),
    ]),
    reviewLink,
    el('div', { class: 'debrief__score-grid' }, meters),
    result.feedback.length ? section('What we observed', el('ul', {}, result.feedback.map((f) => el('li', {}, f)))) : null,
    section('Explanation', mission.explanation),
    section('Common wrong answers', el('div', {}, mission.commonWrongAnswers.map((w) => el('div', { class: 'wrong-answer' }, [el('strong', {}, w.description), ' — ', w.why])))),
    section('Security impact', mission.securityImpact),
    section('Runtime / browser explanation', mission.runtimeExplanation),
    mission.performanceNotes ? section('Performance considerations', mission.performanceNotes) : null,
    section('Why this matters at Source Defense', mission.sourceDefenseConnection),
    section('Follow-up challenge', mission.followUp),
  ].filter(Boolean));
}
