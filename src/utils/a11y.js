export function focusMain() {
  const main = document.getElementById('main');
  if (main) main.focus();
}

export function announceStatus(text) {
  const status = document.getElementById('header-status');
  if (status) status.textContent = text;
}
