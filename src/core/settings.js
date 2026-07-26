/* Player options. Stored separately from the save so they survive a new game. */

import { SETTINGS_KEY } from './config.js';
import { emit } from './bus.js';

const DEFAULTS = {
  sfx: true,
  music: true,
  haptics: true,
  shake: true,
  motion: true   // false = calm down the ambient animation
};

export const settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  /* Respect the OS-level preference on first run. */
  try {
    if (localStorage.getItem(SETTINGS_KEY) == null &&
        matchMedia('(prefers-reduced-motion: reduce)').matches) settings.motion = false;
  } catch (e) { /* ignore */ }
  applyMotion();
}

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

export function setSetting(key, val) {
  settings[key] = val;
  saveSettings();
  if (key === 'motion') applyMotion();
  emit('settings', { key, val });
}

export function toggleSetting(key) {
  setSetting(key, !settings[key]);
  return settings[key];
}

function applyMotion() {
  document.documentElement.classList.toggle('calm', !settings.motion);
}
