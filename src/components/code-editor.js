import { el } from '../utils/dom.js';

/**
 * A minimal textarea-based code editor with a synced line-number gutter. Deliberately
 * not a "real" editor (no syntax highlighting engine, no language server) — this is a
 * training tool, and pulling in a code-editor dependency would hide exactly the kind
 * of raw JS behavior the game is trying to teach.
 */
export function createCodeEditor({ initialCode = '', readOnly = false, ariaLabel = 'Code editor' } = {}) {
  const lines = el('div', { class: 'code-editor__lines', 'aria-hidden': 'true' }, '1');
  const textarea = el('textarea', {
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': ariaLabel,
    readonly: readOnly || undefined,
  });
  textarea.value = initialCode;

  function syncLines() {
    const count = textarea.value.split('\n').length;
    lines.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  }
  function syncScroll() {
    lines.scrollTop = textarea.scrollTop;
  }

  textarea.addEventListener('input', syncLines);
  textarea.addEventListener('scroll', syncScroll);
  syncLines();

  const element = el('div', { class: `code-editor${readOnly ? ' is-readonly' : ''}` }, [lines, textarea]);

  return {
    element,
    getValue: () => textarea.value,
    setValue: (value) => {
      textarea.value = value;
      syncLines();
    },
    focus: () => textarea.focus(),
  };
}
