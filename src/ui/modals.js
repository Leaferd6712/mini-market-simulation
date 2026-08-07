/** Modal show/hide helpers used by overlays. */
export function showModal(overlay) {
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.querySelector('.modal')?.classList.add('show');
}

export function hideModal(overlay) {
  if (!overlay) return;
  overlay.querySelector('.modal')?.classList.remove('show', 'pos', 'neg');
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
}
