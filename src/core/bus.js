/* Minimal event bus.

   Its whole job is to keep the dependency graph acyclic: screens need to
   trigger a re-render, but `shell` is what owns rendering *and* imports every
   screen. So screens emit 'render' and shell listens, instead of importing it
   back. Same story for the resource strip. */

const listeners = new Map();

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}

export function off(evt, fn) {
  const set = listeners.get(evt);
  if (set) set.delete(fn);
}

export function emit(evt, payload) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (e) { console.error('[bus] ' + evt, e); }
  }
}

/* Re-render the active screen. */
export const render = () => emit('render');
/* Repaint the resource strip only — cheap, safe to call often. */
export const refreshRes = () => emit('res');
