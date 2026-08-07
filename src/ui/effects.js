/** Visual effects: floating P&L and confetti. */
export function showFloat(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'float-profit';
  el.style.cssText = `left:${x}px;top:${y}px;color:${color};`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

export function showConfetti(duration = 3000) {
  const colors = ['#00d4ff', '#00ff88', '#ffa500', '#ff6b9d', '#a78bfa', '#ffb020', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const size = 6 + Math.random() * 9;
      const fallDur = 1.8 + Math.random() * 1.8;
      el.style.cssText = `left:${Math.random() * 100}vw;top:-14px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${fallDur}s;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (fallDur + 0.5) * 1000);
    }, Math.random() * Math.min(duration * 0.55, 1200));
  }
}

export function shakeCrash() {
  document.body.classList.add('market-crash');
  setTimeout(() => document.body.classList.remove('market-crash'), 700);
}
