/* Live battle state, shared by the loop, the scene and the battle HUD. */

import {
  RELOAD_BASE_MS, RELOAD_PER_SPEED, RELOAD_FLOOR_MS, APPROACH_MULT
} from '../core/config.js';

export const BT = {
  b: null,        // the current engagement
  scene: null,    // the Phaser scene, once it has booted
  busy: false     // an action is resolving; input is locked
};

/* Does the current boss have this gimmick? */
export function gim(k) {
  return !!(BT.b && BT.b.boss && BT.b.boss.gimmicks.includes(k));
}

export const aliveE = () => BT.b.enemies.filter(e => !e.disabled);
export const aliveP = () => BT.b.fleet.filter(s => s.hull > 0);

/* ---- reload ----

   Every ship in the water carries her own gun crew, and the crew's speed is the
   ship's speed. That is the whole of the new combat model: a hull's three
   numbers each do exactly one job and none of them overlap.

     speed  how OFTEN she fires
     guns   how HARD each shot lands
     hull   how LONG she stays in the fight

   So a Man o' War is a hammer that swings slowly and a schooner is a knife that
   never stops, and the rating that decides whether a fight is fair — guns times
   two, plus speed, plus a fifth of the hull — already prices both of those in.

   A floor on the reload time keeps a fully worked-up flagship from firing so
   fast that nothing else in the fight matters. */
export function reloadMs(ship) {
  const t = RELOAD_BASE_MS / (1 + (ship.speed || 1) * RELOAD_PER_SPEED);
  return Math.max(RELOAD_FLOOR_MS, Math.round(t));
}

/* How far through her reload a ship is, 0..1. The scene draws this under every
   hull and the fallback prints it, so it lives here rather than in the loop —
   otherwise both of them would have to import the loop back. */
export function reloadOf(ship) {
  const t = BT.b && BT.b.timers && BT.b.timers.get(ship);
  return t ? Math.max(0, Math.min(1, t.at)) : 0;
}

/* Whether the ship you are aimed at can be taken rather than sunk. Needs her
   beaten down, the party ready, and no iron on her sides. */
export function boardable(hasGrapple) {
  const b = BT.b;
  if (!b || b.boardCd > 0 || gim('ironclad')) return null;
  const t = b.enemies[b.target];
  const thr = hasGrapple ? 0.55 : 0.40;
  return (t && !t.disabled && t.hull <= t.max * thr) ? t : null;
}

/* Runtime that belongs to the fight rather than to the save: how far through
   her reload each ship is. Keyed off the ship object so nothing has to be
   written back into the fleet when the battle ends.

   `of` is how long this ship's CURRENT cycle takes, which is the run-in for the
   first one and her plain reload for every one after — see APPROACH_MULT. The
   meter still fills the whole way across during the approach, it just fills
   slower, so the bar reads as a ship closing rather than as a bar that has
   stopped working. */
export function primeTimers(list, stagger) {
  const t = new Map();
  list.forEach((s, i) => {
    /* Nobody starts loaded, and nobody starts together — a line that fired in
       one volley would just be the old turn loop wearing a clock. */
    t.set(s, {
      at: (stagger ? (i * 0.22) : 0) + Math.random() * 0.18,
      of: Math.round(reloadMs(s) * APPROACH_MULT),
      closing: true
    });
  });
  return t;
}

/* Called the moment a ship first fires: she is in the fight now, and reloads at
   her own rate from here on. */
export function closed(t, ship) {
  if (!t.closing) return;
  t.closing = false;
  t.of = reloadMs(ship);
}
