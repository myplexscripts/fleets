/* Tiny DOM helpers shared by every UI module. */

export const $ = id => document.getElementById(id);
export const qs = (sel, root) => (root || document).querySelector(sel);
export const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* Escape user-supplied text before it goes into an innerHTML template.
   Ship and flagship names are player-authored, so they must go through this. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const now = () => Date.now();

/* Force a style recalculation so a re-added CSS animation class restarts. */
export function reflow(el) { void el.offsetWidth; }
