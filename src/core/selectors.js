/* Derived game facts. Pure reads over `S`, plus the small wallet helpers that
   every screen needs. No DOM. */

import { S, routes } from './state.js';
import {
  VOY_SEC_PER_DAY, VOY_MAX_ACTIVE, RUSH_GOLD_PER_MIN,
  DANGER_RISE_MIN_DEFAULT, SWEEP_STEP
} from './config.js';
import { TYPES } from '../data/ships.js';
import { REGIONS, NOTO_BONUS, VOYAGE_TYPES } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { CHARTERS } from '../data/charters.js';
import { BOSSES } from '../data/bosses.js';
import { GOOD_KEYS } from '../data/goods.js';
import { MAT_KEYS } from '../data/materials.js';
import { SETS, SET_KEYS } from '../data/collectibles.js';
import { bellMaxDepth, CHEST_VALUE } from '../data/salvage.js';
import { contractRoute } from './contracts.js';
import { now } from './dom.js';

/* ---- ships ---- */
export const allShips = () => [S.flag, ...S.ships];
export const findShip = id => (id === 'FLAG' ? S.flag : S.ships.find(s => s.id === id));
export const tname = s => (s.type === 'flagship' ? 'Flagship' : TYPES[s.type].n);
export const repRate = s => (s.type === 'flagship' ? 6 : TYPES[s.type].rep);
export const repairCost = s => Math.ceil((s.max - s.hull) * repRate(s));
export const power = s => Math.round(s.guns * 2 + s.speed + s.hull / 5);
export const fleetPower = l => l.reduce((a, s) => a + power(s), 0);
export const fleetHull = l => l.reduce((a, s) => a + Math.max(0, s.hull), 0);
export const holdCap = l => l.reduce((a, s) => a + s.cargo, 0);
export const hasFit = k => !!(S.flag && S.flag.fittings.includes(k));

export function cond(s) {
  if (s.hull <= 0) return 'CRIPPLED';
  return s.hull < s.max * 0.6 ? 'DAMAGED' : 'SEAWORTHY';
}
export function condColor(c) {
  return c === 'CRIPPLED' ? 'var(--red)' : (c === 'DAMAGED' ? 'var(--yel)' : 'var(--grn)');
}

/* ---- wallet ----
   A cost or a reward is one flat bag: { gold, wood, metal, cloth }. There is a
   single currency on purpose — a second one only ever split the same decision
   in two. */
export function canPay(c) {
  if ((c.gold || 0) > S.gold) return false;
  return MAT_KEYS.every(m => (c[m] || 0) <= S.mats[m]);
}
export function pay(c) {
  S.gold -= (c.gold || 0);
  MAT_KEYS.forEach(m => { S.mats[m] -= (c[m] || 0); });
}
export function grant(o) {
  if (!o) return;
  S.gold += (o.gold || 0);
  MAT_KEYS.forEach(m => { S.mats[m] += (o[m] || 0); });
}
export const totalGoods = () => GOOD_KEYS.reduce((a, k) => a + S.goods[k], 0);
export const totalMats = () => MAT_KEYS.reduce((a, k) => a + S.mats[k], 0);

/* ---- danger ----

   A cargo lane's danger is alive: it climbs a step every `riseMin` minutes of
   real time, up to that lane's own cap, and a won sweep pushes it back down.
   It never blocks trade — it only decides how roughly a run is handled.

   Stored as (step, timestamp) and projected forward on read, so it keeps
   drifting while the game is closed without needing a ticker. */
export const patrolActive = rk => (S.patrol[rk] || 0) > now();
export const patrolLeft = rk => Math.max(0, (S.patrol[rk] || 0) - now());

const hasLane = r => r.type === 'cargo';
const laneCap = r => (r.dangerCap == null ? 3 : r.dangerCap);
const laneRiseMs = r => (r.riseMin || DANGER_RISE_MIN_DEFAULT) * 60000;

function laneRec(r) {
  const rec = S.lanes[r.id];
  if (!rec) {
    S.lanes[r.id] = { d: r.danger || 0, ts: now(), region: r.region };
    return S.lanes[r.id];
  }
  if (!rec.region) rec.region = r.region;   // records written before regions were stored
  return rec;
}

/* The lane's own danger, before any patrol is taken into account. */
export function laneDanger(r) {
  if (!hasLane(r)) return r.danger || 0;
  const rec = laneRec(r);
  const steps = Math.floor((now() - rec.ts) / laneRiseMs(r));
  return Math.max(0, Math.min(laneCap(r), rec.d + steps));
}

/* Real time until this lane worsens by a step, or 0 if it is already capped. */
export function laneRiseIn(r) {
  if (!hasLane(r) || laneDanger(r) >= laneCap(r)) return 0;
  const rec = laneRec(r);
  const elapsed = (now() - rec.ts) % laneRiseMs(r);
  return laneRiseMs(r) - elapsed;
}

/* Snapshot the drift and knock the lane down. Called on a won sweep. */
export function sweepLane(r) {
  const before = laneDanger(r);
  const after = Math.max(0, before - SWEEP_STEP);
  S.lanes[r.id] = { d: after, ts: now(), region: r.region };
  return { before, after };
}

/* A patrol clears every lane in its region at once. */
export function sweepRegion(rk) {
  let cleared = 0;
  Object.keys(S.lanes).forEach(id => {
    const rec = S.lanes[id];
    if (rec.region !== rk) return;
    if (rec.d > 0) { rec.d = Math.max(0, rec.d - 1); cleared++; }
    rec.ts = now();
  });
  return cleared;
}

export function effDanger(r) {
  const base = laneDanger(r);
  return Math.max(0, Math.min(3, base - (patrolActive(r.region) ? 1 : 0)));
}

/* Lanes worth sweeping right now. A Safe lane needs no escort. */
export const needsSweep = r => hasLane(r) && effDanger(r) > 0;

/* ---- mission shape ---- */
export const canVoyage = r => VOYAGE_TYPES.includes(r.type);
export const isBattle = r => !canVoyage(r);

/* Do we hold the goods a cargo run wants? */
export const goodsHeld = good => (good ? S.goods[good] || 0 : 0);
export const cargoReady = r => r.type !== 'cargo' || goodsHeld(r.good) >= r.qty;

/* Can the fleet physically carry it? */
export const holdReady = (r, fleet) =>
  r.type !== 'cargo' || holdCap(fleet) >= r.qty;

/* ---- dives ---- */
export const bellDepth = () => bellMaxDepth(S.bell);
export const diveReachable = r => r.type !== 'dive' || bellDepth() >= r.depth;

/* Chests a dive is expected to raise. Spare bell capability adds to the haul,
   and the fleet's hold caps what can be brought up in one trip. */
export function diveChests(r, fleet, roll) {
  const spare = Math.max(0, S.bell - (r.depth - 1));
  const spread = r.chestMax - r.chestMin;
  const base = r.chestMin + (roll === undefined ? spread / 2 : Math.floor(roll * (spread + 1)));
  const cap = Math.max(1, Math.floor(holdCap(fleet) / 6));
  return Math.max(1, Math.min(cap, Math.round(base + spare)));
}
export const chestValue = r => CHEST_VALUE[r.depth] || 0;

/* A voyage is launchable when its own gate is satisfied. */
export function voyageOpen(r) {
  if (r.type === 'dive') return diveReachable(r);
  if (r.type === 'cargo') return cargoReady(r);
  return false;
}

/* Chance a cargo run arrives intact. Danger hurts, escorting power helps. */
export function tradeChance(r, fp) {
  const d = effDanger(r);
  const ratio = r.qty ? fp / (r.qty * 2.5) : 1;
  return Math.max(35, Math.min(98, Math.round(100 * (0.72 + 0.16 * Math.min(ratio, 1.5) - 0.11 * d))));
}

/* Estimated odds of taking a fight, from the two line-ups' total power. It is
   a forecast, not a dice roll — the battle is still fought by hand. Shown before
   committing so a hopeless match-up can be rerolled instead of walked into. */
export function battleOdds(fleet, enemies) {
  if (!fleet.length) return 0;
  const fp = fleetPower(fleet);
  const ep = Math.max(1, enemies.reduce((a, e) => a + Math.round(e.guns * 2 + e.speed + e.hull / 5), 0));
  const ratio = fp / ep;
  const odds = 100 * (1 - Math.exp(-1.6 * Math.pow(ratio, 2.2)));
  return Math.max(3, Math.min(100, Math.round(odds)));
}

/* Total times a mission has been finished. Older saves counted battles under a
   'bat_' prefix, so fold both. */
export function doneCount(id) {
  return (S.done[id] || 0) + (S.done['bat_' + id] || 0);
}
export function notoGain(r) {
  let n = 8 + effDanger(r) * 5 + (NOTO_BONUS[r.type] || 0);
  if (doneCount(r.id) >= 3) n = Math.ceil(n / 2);   // diminishing returns on farming
  return Math.max(3, n);
}

/* ---- bosses ---- */
export function bossReady(rk) {
  const b = BOSSES[rk];
  return !!b && !S.bossBeaten[rk] && (S.noto[rk] || 0) >= b.noto;
}
export function anyBossReady() {
  return Object.keys(REGIONS).some(rk => S.unlocked.includes(rk) && bossReady(rk));
}

/* ---- charters ---- */
export const charterDone = id => !!S.charters[id];
export function charterAvailable(c) {
  if (charterDone(c.id)) return false;
  const p = PORTS[c.loc];
  if (!S.unlocked.includes(p.region) || !S.ports.includes(c.loc)) return false;
  return c.req.every(charterDone);
}
export const chartersAt = pid => CHARTERS.filter(c => c.loc === pid && charterAvailable(c));

/* ---- collectibles ---- */
export const piecesOf = setKey => S.collected[setKey] || [];
export const hasPiece = (setKey, name) => piecesOf(setKey).includes(name);
export const setComplete = setKey =>
  !!SETS[setKey] && piecesOf(setKey).length >= SETS[setKey].pieces.length;
export const totalPieces = () =>
  Object.keys(S.collected).reduce((a, k) => a + S.collected[k].length, 0);
export const completedSets = () => SET_KEYS.filter(setComplete).length;

/* ---- synthetic routes ---- */
export function charterRoute(c) {
  const p = PORTS[c.loc];
  return {
    id: 'ch_' + c.id, region: p.region, n: c.n, type: 'charter', charterDef: c,
    danger: Math.min(3, Math.floor((c.t - 1) / 3)),
    power: 18 * c.t,
    rew: { gold: 140 * c.t, metal: c.t, cloth: c.t },
    x: p.x, y: p.y
  };
}
export function bossAsRoute(b) {
  return {
    id: b.id, region: b.region, n: b.n, type: 'boss', danger: 3,
    power: b.power, rew: b.rew, bossDef: b, final: b.final, x: b.x, y: b.y
  };
}

/* Every mission currently on the chart: fixed nodes plus one node per charted
   port — a charter if one is on offer there, otherwise its cargo contract. */
export function allRoutes() {
  const out = routes.filter(r =>
    S.unlocked.includes(r.region) && (!r.requiresBoss || S.bossBeaten[r.requiresBoss]));
  S.ports.forEach(pid => {
    const p = PORTS[pid];
    if (!p || !S.unlocked.includes(p.region)) return;
    const chs = chartersAt(pid);
    out.push(chs.length ? charterRoute(chs[0]) : contractRoute(pid));
  });
  return out;
}

export function routeById(id) {
  const r = routes.find(x => x.id === id);
  if (r) return r;
  const bk = Object.keys(BOSSES).find(k => BOSSES[k].id === id);
  if (bk) return bossAsRoute(BOSSES[bk]);
  if (id.startsWith('k_')) {
    const pid = id.slice(2), chs = chartersAt(pid);
    return chs.length ? charterRoute(chs[0]) : contractRoute(pid);
  }
  if (id.startsWith('ch_')) {
    const c = CHARTERS.find(x => 'ch_' + x.id === id);
    if (c) return charterRoute(c);
  }
  return null;
}

/* ---- voyages ---- */
export function busyIds() {
  const s = new Set();
  S.voyages.forEach(v => v.ships.forEach(i => s.add(i)));
  return s;
}
export const isBusy = id => S.voyages.some(v => v.ships.includes(id));
export const voyageOf = id => S.voyages.find(v => v.ships.includes(id));
export const voyReady = v => now() >= v.endsAt;
export const readyCount = () => S.voyages.filter(voyReady).length;
export const voyageSlotsFree = () => S.voyages.length < VOY_MAX_ACTIVE;

export function voyDuration(r, fleet) {
  const avg = fleet.reduce((a, s) => a + s.speed, 0) / Math.max(1, fleet.length);
  return Math.max(45, Math.round(r.len * VOY_SEC_PER_DAY * Math.max(0.45, 1 - (avg - 4) * 0.07)));
}
export function rushCost(v) {
  return Math.max(RUSH_GOLD_PER_MIN,
    Math.ceil((v.endsAt - now()) / 60000) * RUSH_GOLD_PER_MIN);
}

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  return m + ':' + String(s).padStart(2, '0');
}
