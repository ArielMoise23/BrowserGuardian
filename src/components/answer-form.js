import { el } from '../utils/dom.js';

/**
 * Renders a structured Q&A form from an answerSchema (boolean/select/multiselect/text
 * questions), writing answers directly into the caller-owned `answers` object as the
 * learner interacts — used by both mission investigation panels and labs.
 */
export function renderAnswerForm(answerSchema, answers) {
  const fields = answerSchema.map((q) => {
    if (q.type === 'boolean') {
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('select', { onChange: (e) => { answers[q.id] = e.target.value; } }, [
          el('option', { value: '' }, 'Select…'),
          el('option', { value: 'true' }, 'True'),
          el('option', { value: 'false' }, 'False'),
        ]),
      ]);
    }
    if (q.type === 'select') {
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('select', { onChange: (e) => { answers[q.id] = e.target.value; } }, [
          el('option', { value: '' }, 'Select…'),
          ...q.options.map((opt) => el('option', { value: opt }, opt)),
        ]),
      ]);
    }
    if (q.type === 'multiselect') {
      answers[q.id] = [];
      return el('div', { class: 'field' }, [
        el('label', {}, q.prompt),
        el('div', {}, q.options.map((opt) => {
          const id = `${q.id}-${opt}`;
          return el('div', {}, [
            el('input', { type: 'checkbox', id, onChange: (e) => {
              const set = new Set(answers[q.id]);
              e.target.checked ? set.add(opt) : set.delete(opt);
              answers[q.id] = [...set];
            } }),
            el('label', { for: id }, ` ${opt}`),
          ]);
        })),
      ]);
    }
    return el('div', { class: 'field' }, [
      el('label', {}, q.prompt),
      el('textarea', { rows: '3', onInput: (e) => { answers[q.id] = e.target.value; } }),
    ]);
  });
  return el('form', { onSubmit: (e) => e.preventDefault() }, fields);
}
