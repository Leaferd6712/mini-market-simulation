/** Web Audio tone helpers. */
let _ctx = null;
let enabled = true;

function ctx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function setSoundEnabled(on) {
  enabled = !!on;
}

export function isSoundEnabled() {
  return enabled;
}

export function playTone(freq, type, duration, gainVal, startDelay = 0) {
  if (!enabled) return;
  try {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime + startDelay;
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  } catch (_) {
    /* ignore */
  }
}

export function playBuySound() {
  playTone(440, 'sine', 0.08, 0.18, 0);
  playTone(550, 'sine', 0.08, 0.18, 0.07);
}
