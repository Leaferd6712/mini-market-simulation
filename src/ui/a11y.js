/**
 * Focus trap + Escape handling for modal overlays.
 */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeTrap = null;

export function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function trapFocus(overlay) {
  releaseFocusTrap();
  const modal = overlay.querySelector('.modal') || overlay;
  const focusables = getFocusable(modal);
  const previouslyFocused = document.activeElement;
  if (focusables.length) focusables[0].focus();

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideOverlay(overlay);
      return;
    }
    if (e.key !== 'Tab') return;
    const list = getFocusable(modal);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener('keydown', onKeyDown);
  activeTrap = {
    overlay,
    onKeyDown,
    previouslyFocused,
  };
}

export function releaseFocusTrap() {
  if (!activeTrap) return;
  activeTrap.overlay.removeEventListener('keydown', activeTrap.onKeyDown);
  const prev = activeTrap.previouslyFocused;
  activeTrap = null;
  if (prev && typeof prev.focus === 'function') {
    try {
      prev.focus();
    } catch (_) {
      /* ignore */
    }
  }
}

export function showOverlay(overlay) {
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.querySelector('.modal')?.classList.add('show');
  trapFocus(overlay);
}

export function hideOverlay(overlay) {
  if (!overlay) return;
  overlay.querySelector('.modal')?.classList.remove('show', 'pos', 'neg');
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
  if (activeTrap?.overlay === overlay) releaseFocusTrap();
}

/** Wire Escape to close any visible modal-overlay (global fallback). */
export function wireGlobalEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // still allow Escape to close modals
    }
    document.querySelectorAll('.modal-overlay').forEach((o) => {
      if (o.style.display !== 'none' && o.style.display !== '') {
        hideOverlay(o);
      }
    });
  });
}

/** Set aria-selected on category / tab buttons. */
export function setAriaSelected(buttons, activeEl) {
  buttons.forEach((btn) => {
    const selected = btn === activeEl;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.classList.toggle('active', selected);
  });
}
