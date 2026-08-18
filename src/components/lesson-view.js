import { el, mount, field } from '../utils/dom.js';
import { renderPanel } from './panel.js';
import { createCodeEditor } from './code-editor.js';
import { renderLabRunner } from './lab-runner.js';
import { createRunController, renderTraceStepper } from './sandbox-run-controller.js';
import { store } from '../state/store.js';
import { registry } from '../game/missionRegistry.js';
import { lessonRegistry } from '../game/lessonRegistry.js';
import { getLessonEntry } from '../state/learning.js';

const SELF_SCORE_OPTIONS = [
  { label: 'Nailed it', value: 92 },
  { label: 'Partially right', value: 55 },
  { label: 'Missed it', value: 15 },
];

export function renderLessonView(lesson, { focusLabId } = {}) {
  store.visitLesson(lesson.id);

  const readinessSlot = el('div', { id: 'lesson-readiness' });
  const bookmarkBtn = el('button', { class: 'btn btn--sm' });
  const noteArea = el('textarea', {
    rows: '4',
    placeholder: 'Notes (saved locally, only visible to you)…',
    onBlur: (e) => store.saveNote(lesson.id, e.target.value),
  });
  noteArea.value = store.getState().notes[lesson.id] ?? '';

  function refreshBookmarkBtn() {
    const bookmarked = store.getState().bookmarks.includes(lesson.id);
    bookmarkBtn.textContent = bookmarked ? '★ Bookmarked' : '☆ Bookmark';
  }
  refreshBookmarkBtn();
  bookmarkBtn.addEventListener('click', () => { store.toggleBookmark(lesson.id); refreshBookmarkBtn(); });

  const prereqLine = renderPrerequisites(lesson);

  const header = el('div', { class: 'mission-header' }, [
    el('div', {}, [
      el('h1', {}, lesson.title),
      el('div', { class: 'mission-header__meta' }, [
        el('span', { class: 'badge badge--accent' }, lesson.difficulty),
        el('span', { class: 'badge' }, `~${lesson.estimatedMinutes} min`),
        el('span', { class: 'badge' }, `${lesson.labs.length} labs`),
      ]),
      prereqLine,
    ]),
    el('div', {}, [
      bookmarkBtn,
      el('button', { class: 'btn btn--sm btn--danger', onClick: () => {
        if (confirm('Reset progress for this lesson only? Your XP, missions, and other lessons are untouched.')) {
          store.resetLesson(lesson.id);
          location.reload();
        }
      } }, 'Reset this lesson'),
    ]),
  ]);

  const jumpNav = el('nav', { class: 'lesson-jump-nav', 'aria-label': 'Jump to section' }, [
    el('a', { href: '#lesson-explanation' }, 'Explanation'),
    el('a', { href: '#lesson-tldr' }, 'TL;DR'),
    el('a', { href: '#lesson-example' }, 'Code example'),
    el('a', { href: '#lesson-practice' }, 'Practice'),
    el('a', { href: '#lesson-knowledge-check' }, 'Knowledge check'),
    el('a', { href: '#lesson-readiness' }, 'Mission readiness'),
  ]);

  const explanationSection = el('div', { class: 'card', id: 'lesson-explanation' }, [
    el('h2', {}, 'Explanation'),
    ...lesson.explanation.map((p) => el('p', {}, p)),
    el('div', { class: 'distinction-list' }, lesson.distinctions.map((d) =>
      el('div', { class: 'distinction' }, [
        el('span', { class: `badge badge--${distinctionTone(d.label)}` }, d.label),
        el('span', {}, d.text),
      ])
    )),
  ]);

  const tldrSection = el('div', { class: 'card', id: 'lesson-tldr' }, [
    el('h2', {}, 'TL;DR'),
    el('ul', {}, lesson.tldr.map((point) => el('li', {}, point))),
  ]);

  const exampleSection = renderExampleSection(lesson);
  exampleSection.id = 'lesson-example';

  const labsSection = el('div', { class: 'card', id: 'lesson-practice' }, [
    el('h2', {}, 'Practice'),
    el('p', {}, 'Each activity is graded on what your code actually does, not on matching a fixed answer string — multiple valid solutions are accepted. Submitting reveals a full explanation.'),
    ...lesson.labs.map((lab) => {
      const { element } = renderLabRunner(lab, {
        draftKey: `lab:${lesson.id}:${lab.id}`,
        onResult: (result) => {
          store.submitLabResult(lesson, lab, result);
          renderReadiness();
        },
      });
      return element;
    }),
  ]);
  if (focusLabId) {
    queueMicrotask(() => document.getElementById(`lab-${focusLabId}`)?.scrollIntoView({ block: 'start' }));
  }

  const knowledgeCheck = renderKnowledgeCheck(lesson);

  function renderReadiness() {
    mount(readinessSlot, buildReadinessSection(lesson));
  }
  renderReadiness();

  const notesPanel = renderPanel('Your Notes', noteArea, { flush: true });

  const view = el('div', { class: 'mission-view' }, [
    header,
    jumpNav,
    explanationSection,
    tldrSection,
    exampleSection,
    labsSection,
    knowledgeCheck,
    readinessSlot,
    notesPanel,
  ]);

  return { element: view };
}

function distinctionTone(label) {
  if (label === 'ECMAScript spec') return 'accent';
  if (label === 'Browser-provided') return 'success';
  if (label === 'Simplified model') return 'warning';
  return 'danger'; // Implementation detail
}

function renderPrerequisites(lesson) {
  if (!lesson.prerequisites.length) return null;
  const state = store.getState();
  return el('p', { class: 'prereq-line' }, [
    'Prerequisites: ',
    ...lesson.prerequisites.flatMap((id, i) => {
      const prereq = lessonRegistry.getLesson(id);
      if (!prereq) return [];
      const done = getLessonEntry(state, id).completed;
      return [i > 0 ? ', ' : '', el('a', { href: `#/learn/${id}` }, `${done ? '✓ ' : ''}${prereq.title}`)];
    }),
    ' (not required — a nudge, not a gate).',
  ]);
}

function renderExampleSection(lesson) {
  const ex = lesson.example;
  const previewHost = el('div', {});
  const controller = createRunController({ runner: ex.runner, panels: lesson.panels, hostElement: previewHost });
  const panelsWanted = controller.panelsWanted;

  const draftKey = `example:${lesson.id}`;
  const editor = createCodeEditor({
    initialCode: store.getState().drafts[draftKey] ?? ex.code,
    ariaLabel: `${lesson.title} example code`,
    onChange: (code) => store.saveDraft(draftKey, code),
  });
  const predictionArea = el('textarea', { rows: '3', placeholder: 'Type your prediction here before running…' });
  const compareNote = el('p', { class: 'compare-note' }, '');

  async function run() {
    if (ex.runner === 'worker') {
      await controller.run(editor.getValue(), ex.testScript);
    } else if (ex.runner === 'iframe') {
      await controller.run({ siteHtml: ex.siteSnapshot, setupScript: ex.setupScript, code: editor.getValue(), testScript: ex.testScript });
    }
    store.markExampleRun(lesson.id);
    compareNote.textContent = predictionArea.value.trim()
      ? 'Compare your prediction above with the real console/panel output below — did it match?'
      : 'Now that you\'ve seen the real output, scroll up and try predicting it before your next Run.';
  }
  function reset() {
    controller.reset();
    editor.setValue(ex.code);
    store.clearDraft(draftKey);
    compareNote.textContent = '';
  }

  const runBtn = el('button', { class: 'btn btn--sm btn--primary', onClick: run }, 'Run');
  const resetBtn = el('button', { class: 'btn btn--sm', onClick: reset }, 'Reset example');

  const rightColPanels = [];
  if (panelsWanted.includes('trace')) rightColPanels.push(renderPanel('Execution Trace', renderTraceStepper(controller)));
  rightColPanels.push(renderPanel('Console', controller.slots.consoleSlot));
  if (panelsWanted.includes('dom')) rightColPanels.push(renderPanel('DOM Inspector', controller.slots.domSlot));
  if (panelsWanted.includes('network')) rightColPanels.push(renderPanel('Network Activity', controller.slots.networkSlot, { flush: true }));
  if (panelsWanted.includes('alerts')) rightColPanels.push(renderPanel('Security Alerts', controller.slots.alertsSlot));
  if (panelsWanted.includes('eventPath')) rightColPanels.push(renderPanel('Event Path', controller.slots.eventPathSlot));

  return el('div', { class: 'card' }, [
    el('h2', {}, 'Code example: predict, run, observe, modify'),
    el('p', {}, ex.predictPrompt),
    field('Your prediction', predictionArea),
    ex.runner === 'iframe' ? renderPanel('Simulation', previewHost, { flush: true }) : null,
    renderPanel('Example code (editable — modify it and run again)', editor.element, { flush: true }),
    el('div', { class: 'btn-row' }, [runBtn, resetBtn]),
    controller.slots.statusSlot,
    compareNote,
    el('div', { class: 'workspace__col' }, rightColPanels),
  ].filter(Boolean));
}

function renderKnowledgeCheck(lesson) {
  const cards = lesson.knowledgeCheck.map((q) => {
    const state = { revealed: false };
    const answerArea = el('textarea', { rows: '3' });
    const bodySlot = el('div', {});

    function draw() {
      mount(bodySlot, [
        el('p', {}, q.question),
        field('Your answer', answerArea),
        state.revealed
          ? el('div', {}, [
              el('div', { class: 'debrief__section' }, [el('h4', {}, 'Model answer'), el('p', {}, q.modelAnswer)]),
              el('p', {}, 'How did you do?'),
              el('div', { class: 'btn-row' }, SELF_SCORE_OPTIONS.map((opt) =>
                el('button', { class: 'btn btn--sm', onClick: () => {
                  store.submitKnowledgeCheck(lesson, q, opt.value);
                  bodySlot.querySelectorAll('button').forEach((b) => { b.disabled = true; });
                } }, opt.label)
              )),
            ])
          : el('button', { class: 'btn btn--sm btn--primary', onClick: () => { state.revealed = true; draw(); } }, 'Reveal model answer'),
      ]);
    }
    draw();
    return el('div', { class: 'card' }, bodySlot);
  });

  return el('div', { id: 'lesson-knowledge-check' }, [el('h2', {}, 'Knowledge check'), ...cards]);
}

function buildReadinessSection(lesson) {
  const state = store.getState();
  const entry = getLessonEntry(state, lesson.id);
  const mastered = lesson.labs.filter((lab) => entry.completedLabs.includes(lab.id));
  const needsReview = lesson.labs.filter((lab) => !entry.completedLabs.includes(lab.id) && entry.labAttempts[lab.id]?.attempts > 0);
  const notStarted = lesson.labs.filter((lab) => !entry.completedLabs.includes(lab.id) && !entry.labAttempts[lab.id]);
  const relatedMissions = lesson.relatedMissionIds.map((id) => registry.getMission(id)).filter(Boolean);

  const section = (title, content) => el('div', { class: 'debrief__section' }, [el('h3', {}, title), content]);

  return el('div', { class: 'card' }, [
    el('h2', {}, 'Mission readiness'),
    section('Mastered', mastered.length ? el('ul', {}, mastered.map((l) => el('li', {}, l.title))) : el('p', {}, 'Nothing yet — work through the labs above.')),
    needsReview.length ? section('Needs review', el('ul', {}, needsReview.map((l) => el('li', {}, l.title)))) : null,
    notStarted.length ? section('Still to try', el('ul', {}, notStarted.map((l) => el('li', {}, l.title)))) : null,
    relatedMissions.length
      ? section(relatedMissions.length > 1 ? 'Recommended missions' : 'Recommended mission', el('ul', {}, relatedMissions.map((m) => el('li', {}, el('a', { href: `#/mission/${m.id}` }, m.title)))))
      : null,
    section('Possible interview questions on this lesson', el('ol', {}, lesson.interviewQuestions.map((q) => el('li', {}, q)))),
  ].filter(Boolean));
}
