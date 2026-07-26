/* The save game.

   `S` is the single mutable state object. It is exported as a live binding —
   importers read `S.gold` and see current values, but only this module may
   swap the object itself (newGame / load). */

import { SAVE_KEY, TUT_KEY, PATROL_MS, GEM_TO_GOLD } from './config.js';
import { TYPES, NAMES } from '../data/ships.js';
import { FLAGBASE, BOONS } from '../data/flagship.js';
import { makeRoutes } from '../data/routes.js';
import { GOOD_KEYS } from '../data/goods.js';
import { MAT_KEYS } from '../data/materials.js';
import { PIECE_SET } from '../data/collectibles.js';

export let S = null;
export let routes = [];

let shipSeq = 1, voySeq = 1;

const zeroed = keys => keys.reduce((o, k) => { o[k] = 0; return o; }, {});

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
    gold: 500, barrels: 3, docks: 3,
    goods: { ...zeroed(GOOD_KEYS), sugar: 10, rum: 6 },
    mats: { ...zeroed(MAT_KEYS), wood: 8, metal: 6, cloth: 4 },
    bell: 0,
    ships: [newShip('schooner'), newShip('schooner'), newShip('brig')],
    flag: newFlag(),
    unlocked: ['caribbean'],
    done: {}, patrol: {}, lanes: {}, noto: {}, bossBeaten: {}, voyages: [],
    ports: ['staug'], charters: {}, contracts: {}, collected: {}, flagBoons: [],
    won: false,
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
  S.voyages = S.voyages || [];
  S.ports = S.ports || ['staug'];
  S.charters = S.charters || {};
  S.contracts = S.contracts || {};
  S.flagBoons = S.flagBoons || [];
  S.patrol = S.patrol || {};
  S.lanes = S.lanes || {};
  S.done = S.done || {};
  if (!S.startedAt) S.startedAt = Date.now();
  if (!S.ports.includes('staug')) S.ports.push('staug');

  /* Reales and gems were two currencies doing one job. Gems fold in at a flat
     rate and the whole thing is now just gold. The old field names are read
     off the raw save here, so this must not be renamed with the rest. */
  if (typeof S.gold !== 'number') {
    S.gold = (S.reales | 0) + (S.gems | 0) * GEM_TO_GOLD;
  }
  delete S.reales;
  delete S.gems;

  /* Patrols used to be stored as a bare counter that nothing ever decremented,
     so one patrol win suppressed a region's danger forever. They are now an
     expiry timestamp; convert anything that is not plausibly one. */
  for (const k in S.patrol) {
    const v = S.patrol[k];
    if (typeof v !== 'number' || v < 1e12) S.patrol[k] = Date.now() + PATROL_MS;
  }

  /* Generic `cargo` units became five named trade goods. Convert the old stock
     into the two staples so nothing is silently confiscated. */
  if (!S.goods) {
    const old = Math.max(0, S.cargo | 0);
    S.goods = zeroed(GOOD_KEYS);
    S.goods.sugar = Math.ceil(old * 0.6);
    S.goods.rum = Math.floor(old * 0.4);
  } else {
    GOOD_KEYS.forEach(k => { if (typeof S.goods[k] !== 'number') S.goods[k] = 0; });
  }
  delete S.cargo;

  /* `parts` became wood / metal / cloth. Split the stockpile three ways. */
  if (!S.mats) {
    const old = Math.max(0, S.parts | 0);
    S.mats = zeroed(MAT_KEYS);
    S.mats.wood = Math.ceil(old * 0.4);
    S.mats.metal = Math.round(old * 0.35);
    S.mats.cloth = Math.floor(old * 0.25);
  } else {
    MAT_KEYS.forEach(k => { if (typeof S.mats[k] !== 'number') S.mats[k] = 0; });
  }
  delete S.parts;

  if (typeof S.bell !== 'number') S.bell = 0;

  /* Flat relic list became named collectible sets. Slot the old names into
     whichever set claims them and keep anything unrecognised in `loose`. */
  if (!S.collected) {
    S.collected = {};
    (S.relics || []).forEach(name => {
      const set = PIECE_SET[name] || 'loose';
      S.collected[set] = S.collected[set] || [];
      if (!S.collected[set].includes(name)) S.collected[set].push(name);
    });
  }
  delete S.relics;

  /* Lane security is gone: trade is no longer gated behind clearing a lane. */
  delete S.rt;
  delete S.routes; delete S.day; delete S.lastSail;
}
