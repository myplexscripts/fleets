/* The save game.

   `S` is the single mutable state object. It is exported as a live binding —
   importers read `S.reales` and see current values, but only this module may
   swap the object itself (newGame / load). */

import { SAVE_KEY, TUT_KEY, PATROL_MS } from './config.js';
import { TYPES, NAMES } from '../data/ships.js';
import { FLAGBASE, BOONS } from '../data/flagship.js';
import { makeRoutes } from '../data/routes.js';

export let S = null;
export let routes = [];

let shipSeq = 1, voySeq = 1;

export function newShip(type, hullPct) {
  const t = TYPES[type];
  return {
    id: 's' + (shipSeq++) + '_' + (Date.now() % 100000),
    type,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    hull: Math.max(1, Math.round(t.hull * (hullPct ?? 1))),
    max: t.hull, speed: t.speed, guns: t.guns, cargo: t.cargo
  };
}

export function newFlag() {
  return {
    id: 'FLAG', type: 'flagship', name: 'Wraith',
    tiers: { plate: 0, guns: 0, rig: 0, hold: 0 }, fittings: [],
    hull: FLAGBASE.hull, max: FLAGBASE.hull,
    speed: FLAGBASE.speed, guns: FLAGBASE.guns, cargo: FLAGBASE.cargo
  };
}

/* Recompute flagship stats from its tiers + boons. Call after any change. */
export function syncFlag() {
  const f = S.flag, oldMax = f.max;
  f.max   = FLAGBASE.hull  + f.tiers.plate * 12;
  f.guns  = FLAGBASE.guns  + f.tiers.guns  * 2;
  f.speed = FLAGBASE.speed + f.tiers.rig   * 2;
  f.cargo = FLAGBASE.cargo + f.tiers.hold  * 10;
  (S.flagBoons || []).forEach(b => { if (BOONS[b]) BOONS[b].apply(f); });
  /* Buying hull plating should give you the new hull, not just the headroom. */
  if (f.max > oldMax) f.hull = Math.min(f.max, f.hull + (f.max - oldMax));
  f.hull = Math.min(f.hull, f.max);
}

export function nextVoyId() { return 'v' + (voySeq++); }

export function newGame() {
  S = {
    reales: 500, cargo: 20, parts: 10, gems: 0, barrels: 3, docks: 3,
    ships: [newShip('schooner'), newShip('schooner'), newShip('brig')],
    flag: newFlag(),
    unlocked: ['caribbean'],
    done: {}, patrol: {}, noto: {}, bossBeaten: {}, rt: {}, voyages: [],
    ports: ['staug'], charters: {}, relics: [], flagBoons: [], won: false,
    tut: localStorage.getItem(TUT_KEY) ? 'done' : 0,
    startedAt: Date.now()
  };
  routes = makeRoutes();
  save();
  return S;
}

export function save() {
  if (!S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function load() {
  try {
    const d = localStorage.getItem(SAVE_KEY);
    if (!d) return false;
    S = JSON.parse(d);
    migrate();
    routes = makeRoutes();
    syncFlag();
    S.voyages.forEach(v => {
      const n = parseInt((v.id || 'v0').replace(/\D/g, ''), 10);
      if (n >= voySeq) voySeq = n + 1;
    });
    return true;
  } catch (e) {
    console.warn('[state] save unreadable, starting fresh', e);
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

/* Bring an older save up to the current shape. Runs on every load. */
function migrate() {
  if (S.barrels == null) S.barrels = 3;
  if (S.tut === undefined) S.tut = 'done';
  if (!S.flag) S.flag = newFlag();
  if (!S.flag.tiers) S.flag.tiers = { plate: 0, guns: 0, rig: 0, hold: 0 };
  if (!S.flag.fittings) S.flag.fittings = [];
  S.noto = S.noto || {};
  S.bossBeaten = S.bossBeaten || {};
  S.rt = S.rt || {};
  S.voyages = S.voyages || [];
  S.ports = S.ports || ['staug'];
  S.charters = S.charters || {};
  S.relics = S.relics || [];
  S.flagBoons = S.flagBoons || [];
  S.patrol = S.patrol || {};
  S.done = S.done || {};
  if (!S.startedAt) S.startedAt = Date.now();
  if (!S.ports.includes('staug')) S.ports.push('staug');

  /* Patrols used to be stored as a bare counter that nothing ever decremented,
     so one patrol win suppressed a region's danger forever. They are now an
     expiry timestamp; convert anything that is not plausibly one. */
  for (const k in S.patrol) {
    const v = S.patrol[k];
    if (typeof v !== 'number' || v < 1e12) S.patrol[k] = Date.now() + PATROL_MS;
  }

  delete S.routes; delete S.day; delete S.lastSail;
}
