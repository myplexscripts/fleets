/* Sound.

   Every cue has a WebAudio synth fallback, so the game is never silent even
   with no audio files present. Drop an mp3 at the path below and it takes over
   automatically. */

import { settings } from '../core/settings.js';

const SND_PATHS = {
  ui_tap: 'audio/ui_tap.mp3', cannon: 'audio/cannon.mp3', impact: 'audio/impact.mp3',
  explosion: 'audio/explosion.mp3', splash: 'audio/splash.mp3', coin: 'audio/coin.mp3',
  sail: 'audio/sail.mp3', victory: 'audio/victory.mp3', defeat: 'audio/defeat.mp3',
  board: 'audio/board.mp3', repair: 'audio/repair.mp3', toast: 'audio/toast.mp3',
  ambience: 'audio/ambience.mp3', boss_horn: 'audio/boss_horn.mp3', upgrade: 'audio/upgrade.mp3',
  telegraph: 'audio/telegraph.mp3', relic: 'audio/relic.mp3', depart: 'audio/depart.mp3',
  arrive: 'audio/arrive.mp3', theme: 'audio/theme.mp3', deny: 'audio/deny.mp3'
};

let ctx = null;
const files = {};
let amb = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

/* Probe for real audio files without blocking startup. */
Object.entries(SND_PATHS).forEach(([k, src]) => {
  const a = new Audio();
  a.addEventListener('canplaythrough', () => { files[k] = src; }, { once: true });
  a.addEventListener('error', () => {}, { once: true });
  a.src = src;
});

function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.001, t + a + d);
}

function osc(type, f0, f1, a, d, v) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, c.currentTime);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + a + d);
  env(g, c.currentTime, a, d, v);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + a + d + 0.05);
}

function noise(d, ft, f, v) {
  const c = ac(), len = c.sampleRate * d;
  const buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const fl = c.createBiquadFilter(); fl.type = ft; fl.frequency.value = f;
  const g = c.createGain(); g.gain.value = v;
  s.connect(fl).connect(g).connect(c.destination);
  s.start();
}

const seq = (freqs, type, gap, a, d, v) =>
  freqs.forEach((f, i) => setTimeout(() => osc(type, f, 0, a, d, v), i * gap));

const synth = {
  ui_tap:   () => osc('square', 880, 660, 0.005, 0.05, 0.06),
  cannon:   () => { noise(0.35, 'lowpass', 420, 0.5); osc('sine', 90, 42, 0.01, 0.3, 0.5); },
  impact:   () => { noise(0.12, 'bandpass', 900, 0.35); osc('sine', 140, 70, 0.005, 0.1, 0.3); },
  explosion:() => { noise(0.5, 'lowpass', 600, 0.6); osc('sine', 70, 30, 0.01, 0.45, 0.55); },
  splash:   () => noise(0.45, 'bandpass', 700, 0.3),
  coin:     () => { osc('sine', 1320, 0, 0.005, 0.09, 0.18); setTimeout(() => osc('sine', 1760, 0, 0.005, 0.12, 0.18), 70); },
  sail:     () => noise(0.6, 'bandpass', 500, 0.22),
  victory:  () => seq([523, 659, 784, 1047], 'square', 110, 0.01, 0.22, 0.14),
  defeat:   () => { osc('sawtooth', 220, 110, 0.02, 0.6, 0.2); setTimeout(() => osc('sawtooth', 165, 82, 0.02, 0.8, 0.2), 250); },
  board:    () => { noise(0.2, 'highpass', 1500, 0.25); osc('square', 330, 220, 0.01, 0.15, 0.12); },
  repair:   () => seq([440, 440, 520], 'triangle', 90, 0.005, 0.08, 0.15),
  toast:    () => osc('triangle', 990, 1180, 0.01, 0.12, 0.1),
  /* "No." Two flat low notes — unmistakably a refusal, and short enough to
     take on every mistap without becoming a nag. */
  deny:     () => { osc('square', 196, 165, 0.005, 0.09, 0.09); setTimeout(() => osc('square', 147, 124, 0.005, 0.13, 0.09), 90); },
  upgrade:  () => seq([440, 554, 659, 880], 'triangle', 80, 0.005, 0.16, 0.13),
  boss_horn:() => { osc('sawtooth', 110, 82, 0.08, 1.1, 0.22); setTimeout(() => osc('sawtooth', 82, 62, 0.08, 1.4, 0.2), 340); },
  telegraph:() => seq([880, 880, 880], 'square', 150, 0.005, 0.1, 0.12),
  relic:    () => seq([660, 880, 1100, 1320, 1760], 'sine', 90, 0.005, 0.25, 0.12),
  depart:   () => { noise(0.7, 'bandpass', 420, 0.24); setTimeout(() => osc('sine', 196, 262, 0.05, 0.5, 0.1), 120); },
  arrive:   () => seq([392, 523, 659], 'triangle', 110, 0.01, 0.2, 0.13),
  /* Title sting — a slow minor arpeggio. */
  theme:    () => seq([196, 233, 294, 349, 294, 233], 'triangle', 260, 0.03, 0.4, 0.09)
};

export function play(k) {
  if (!settings.sfx) return;
  try {
    if (files[k]) { const a = new Audio(files[k]); a.volume = 0.7; a.play().catch(() => {}); }
    else if (synth[k]) { ac(); synth[k](); }
  } catch (e) { /* audio is never load-bearing */ }
}

export function ambience(on) {
  if (on && settings.music && files.ambience && !amb) {
    amb = new Audio(files.ambience);
    amb.loop = true; amb.volume = 0.35;
    amb.play().catch(() => {});
  }
  if ((!on || !settings.music) && amb) { amb.pause(); amb = null; }
}

export function stopAll() { ambience(false); }

/* Browsers need a gesture before audio may start. */
export function initSound() {
  addEventListener('pointerdown', () => { try { ac().resume(); } catch (e) {} }, { once: true });
  document.addEventListener('pointerdown', e => {
    if (e.target.closest('.btn,nav button,.pick,.modetabs button,.iconbtn,.menubtn')) play('ui_tap');
  });
}
