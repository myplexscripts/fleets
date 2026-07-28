/* Vibration. A no-op wherever the API is missing, which is most desktops. */

import { settings } from '../core/settings.js';

const PATTERNS = {
  tap: 8,
  hit: 18,
  big: [30, 40, 60],
  win: [20, 60, 20, 60],
  lose: [90, 50, 120],
  warn: [12, 40, 12],
  deny: [22, 50, 22]
};

export function buzz(kind) {
  if (!settings.haptics) return;
  if (!navigator.vibrate) return;
  try { navigator.vibrate(PATTERNS[kind] || PATTERNS.tap); } catch (e) { /* ignore */ }
}
