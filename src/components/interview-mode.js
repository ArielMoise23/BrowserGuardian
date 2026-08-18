import { el, mount, field } from '../utils/dom.js';
import { pickQuestions, categoryLabel } from '../game/interviewBank.js';
import { store } from '../state/store.js';
import { weakestCategories, strongestCategories } from '../state/skills.js';
import { registry } from '../game/missionRegistry.js';

const SELF_SCORE_OPTIONS = [
  { label: 'Nailed it', value: 92 },
  { label: 'Partially right', value: 55 },
  { label: 'Missed it', value: 15 },
];

export function renderInterviewMode(initialState) {
  const container = el('div', { class: 'card', style: 'max-width:760px' });
  const session = {
    questions: pickQuestions(initialState.skills, 6),
    index: 0,
    revealed: false,
    results: [], // { question, selfScore }
  };

  function draw() {
    if (session.index >= session.questions.length) {
      mount(container, renderSummary(session));
      return;
    }
    const q = session.questions[session.index];
    mount(container, [
      el('div', { class: 'mission-header__meta' }, [
        el('span', { class: 'badge badge--accent' }, categoryLabel(q.skillTag)),
        el('span', { class: 'badge' }, `Question ${session.index + 1} / ${session.questions.length}`),
      ]),
      el('h2', {}, 'Interview Mode'),
      el('p', {}, q.prompt),
      field('Answer out loud, or type it here, before revealing the model answer:', el('textarea', { rows: '5' })),
      session.revealed
        ? el('div', {}, [
            el('div', { class: 'debrief__section' }, [el('h3', {}, 'Model answer'), el('p', {}, q.modelAnswer)]),
            el('p', {}, 'Self-assess — this updates your skill rating for this category:'),
            el('div', { class: 'btn-row' }, SELF_SCORE_OPTIONS.map((opt) =>
              el('button', { class: 'btn', onClick: () => submitSelfScore(opt.value) }, opt.label)
            )),
          ])
        : el('button', { class: 'btn btn--primary', onClick: () => { session.revealed = true; draw(); } }, 'Reveal model answer'),
    ]);
  }

  function submitSelfScore(value) {
    const q = session.questions[session.index];
    store.recordInterviewAnswer({ questionId: q.id, skillTag: q.skillTag, selfScore: value, date: new Date().toISOString() });
    store.updateSkillsFromInterview(q.skillTag, value);
    session.results.push({ question: q, selfScore: value });
    session.index += 1;
    session.revealed = false;
    draw();
  }

  draw();
  return container;
}

function renderSummary(session) {
  const state = store.getState();
  const weak = weakestCategories(state.skills, 3);
  const strong = strongestCategories(state.skills, 3);
  const missed = session.results.filter((r) => r.selfScore < 60);

  const weakMissionSuggestions = weak
    .flatMap((tag) => registry.allMissions().filter((m) => m.skillTags.includes(tag) && !state.missions[m.id]?.completed))
    .slice(0, 3);

  return el('div', {}, [
    el('h2', {}, 'Session Summary'),
    el('div', { class: 'debrief__section' }, [el('h3', {}, 'Strong areas'), el('p', {}, strong.map((t) => `${categoryLabel(t)} (${state.skills[t]})`).join(', ') || '—')]),
    el('div', { class: 'debrief__section' }, [el('h3', {}, 'Weak areas'), el('p', {}, weak.map((t) => `${categoryLabel(t)} (${state.skills[t]})`).join(', ') || '—')]),
    missed.length
      ? el('div', { class: 'debrief__section' }, [
          el('h3', {}, 'Questions to revisit'),
          el('ul', {}, missed.map((r) => el('li', {}, r.question.prompt))),
        ])
      : null,
    weakMissionSuggestions.length
      ? el('div', { class: 'debrief__section' }, [
          el('h3', {}, 'Recommended next missions'),
          el('ul', {}, weakMissionSuggestions.map((m) => el('li', {}, el('a', { href: `#/mission/${m.id}` }, m.title)))),
        ])
      : null,
    el('button', { class: 'btn btn--primary', onClick: () => location.reload() }, 'Start a new session'),
  ].filter(Boolean));
}
