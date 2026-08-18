export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(root, node) {
  clear(root);
  const nodes = [].concat(node).filter((n) => n != null && n !== false);
  root.append(...nodes);
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

let fieldIdSeq = 0;
/**
 * A labeled form field: gives the control a stable id and points the label's `for`
 * at it, so screen readers announce the label on focus instead of the two just being
 * visually adjacent. Use this instead of hand-building `el('div', {class:'field'}, [...])`.
 */
export function field(labelText, control) {
  control.id = control.id || `field-${++fieldIdSeq}`;
  return el('div', { class: 'field' }, [el('label', { for: control.id }, labelText), control]);
}
