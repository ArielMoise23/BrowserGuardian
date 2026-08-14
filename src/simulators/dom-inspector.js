import { el } from '../utils/dom.js';

/**
 * Renders a serialized DOM snapshot (from iframe-runtime's __snapshotDom) as a
 * collapsible-free indented tree. `isSuspicious(nodeSnapshot)` lets a mission flag
 * nodes worth the learner's attention (e.g. a script tag that wasn't in the original
 * page markup) without the inspector needing to know mission-specific semantics.
 */
export function renderDomTree(snapshot, isSuspicious = () => false) {
  if (!snapshot) return el('p', { class: 'empty-state' }, 'No DOM snapshot yet — run the simulation.');
  return el('div', { class: 'dom-tree' }, [renderNode(snapshot, isSuspicious)]);
}

function renderNode(node, isSuspicious) {
  if (node.text !== undefined) {
    return el('li', {}, el('span', { class: 'dom-node__text' }, `"${node.text}"`));
  }

  const attrPairs = Object.entries(node.attrs ?? {});
  const attrsNode = attrPairs.map(([k, v]) =>
    el('span', {}, [' ', el('span', { class: 'dom-node__attr' }, k), '=', el('span', { class: 'dom-node__attr-val' }, `"${v}"`)])
  );

  const flagged = isSuspicious(node);
  const openTag = el('span', { class: 'dom-node__tag' }, `<${node.tag}`);
  const head = el('div', { class: `dom-node${flagged ? ' is-flagged' : ''}` }, [openTag, ...attrsNode, el('span', { class: 'dom-node__tag' }, '>')]);

  const children = (node.children ?? []).map((child) => renderNode(child, isSuspicious));
  const childList = children.length ? el('ul', {}, children) : null;

  return el('li', {}, [head, childList].filter(Boolean));
}
