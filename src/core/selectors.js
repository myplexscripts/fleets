/* Derived game facts. Pure reads over `S` — no DOM, no mutation except the
   lane-security bookkeeping that has to stamp a timestamp. */

import { S, routes } from './state.js';
import { SEC_DECAY_PER_MIN, VOY_SEC_PER_DAY, VOY_MAX_ACTIVE, RUSH_GEM_PER_MIN } from './config.js';
import { TYPES } from '../data/ships.js';
import { REGIONS, NOTO_BONUS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { CHARTERS } from '../data/charters.js';
import { BOSSES } from '../data/bosses.js';
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
export const hasFit = k => !!(S.flag && S.flag.fittings.includes(k));

export function cond(s) {
  if (s.hull <= 0) return 'CRIPPLED';
  return s.hull < s.max * 0.6 ? 'DAMAGED' : 'SEAWORTHY';
}
export function condColor(c) {
  return c === 'CRIPPLED' ? 'var(--red)' : (c === 'DAMAGED' ? 'var(--yel)' : 'var(--grn)');
}

/* ---- money ---- */
export const canPay = c => S.reales >= (c.reales || 0) && S.parts >= (c.parts || 0) && S.gems >= (c.gems || 0);
export function pay(c) {
  S.reales -= (c.reales || 0);
  S.parts  -= (c.parts || 0);
  S.gems   -= (c.gems || 0);
}

/* ---- lane security & danger ---- */
function rtOf(id) {
  if (!S.rt[id]) S.rt[id] = { sec: 0, ts: now() };
  return S.rt[id];
}
export function secNow(id) {
  const r = rtOf(id);
  return Math.max(0, Math.min(100, r.sec - (now() - r.ts) / 60000 * SEC_DECAY_PER_MIN));
}
export function addSec(id, n) {
  const r = rtOf(id);
  r.sec = Math.max(0, Math.min(100, secNow(id) + n));
  r.ts = now();
}

/* A patrol win suppresses regional danger until its timestamp runs out. */
export const patrolActive = rk => (S.patrol[rk] || 0) > now();
export const patrolLeft = rk => Math.max(0, (S.patrol[rk] || 0) - now());

export function effDanger(r) {
  const base = r.danger || 0;
  const fromSecurity = Math.floor(secNow(r.id) / 40);
  const fromPatrol = patrolActive(r.region) ? 1 : 0;
  return Math.max(0, Math.min(3, base - fromSecurity - fromPatrol));
}

/* ---- mission shape ---- */
export const canVoyage = r => ['trade', 'port', 'salvage'].includes(r.type);
export const voyageOpen = r => canVoyage(r) && effDanger(r) <= 1;

export function battleChance(r) {
  const d = effDanger(r);
  if (['raid', 'blockade', 'boss', 'charter'].includes(r.type)) return 1;
  if (r.type === 'escort') return Math.min(0.9, [0.05, 0.35, 0.72, 1.0][d] + 0.3);
  return [0.05, 0.35, 0.72, 1.0][d];
}
export function tradeChance(r, fp) {
  const d = effDanger(r), ratio = r.power ? fp / r.power : 1;
  return Math.max(20, Math.min(97, Math.round(100 * (0.55 + 0.35 * Math.min(ratio, 1.4) - 0.09 * d))));
}
export function salvageChance(r, fh) {
  return Math.max(20, Math.min(95, Math.round(100 * (0.35 + 0.5 * Math.min(fh / r.hullreq, 1.3)))));
}

/* Total times a lane has been finished, by battle or by trade run. Older saves
   counted battles under a 'bat_' prefix, so fold both. */
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

/* ---- synthetic routes ---- */
export function portRoute(pid) {
  const p = PORTS[pid], t = p.t;
  return {
    id: 'pt_' + pid, region: p.region, n: p.n + ' Lane', type: 'port',
    danger: Math.min(3, Math.floor((t - 1) / 3)),
    cargo: 6 + 3 * t, len: Math.max(1, Math.ceil(t / 2)), power: 16 * t,
    rew: { reales: 110 * t, parts: Math.ceil(t / 2), gems: t >= 8 ? 1 : 0 },
    x: p.x, y: p.y
  };
}
export function charterRoute(c) {
  const p = PORTS[c.loc];
  return {
    id: 'ch_' + c.id, region: p.region, n: c.n, type: 'charter', charterDef: c,
    danger: Math.min(3, Math.floor((c.t - 1) / 3)),
    len: Math.max(1, Math.ceil(c.t / 2)), power: 18 * c.t,
    rew: { reales: 140 * c.t, parts: 2 * c.t },
    x: p.x, y: p.y
  };
}
export function bossAsRoute(b) {
  return {
    id: b.id, region: b.region, n: b.n, type: 'boss', danger: 3, len: 0,
    power: b.power, rew: b.rew, bossDef: b, final: b.final, x: b.x, y: b.y
  };
}

/* Every mission currently on the chart: fixed lanes plus one node per charted
   port (a charter if one is on offer there, otherwise its supply lane). */
export function allRoutes() {
  const out = routes.filter(r =>
    S.unlocked.includes(r.region) && (!r.requiresBoss || S.bossBeaten[r.requiresBoss]));
  S.ports.forEach(pid => {
    const p = PORTS[pid];
    if (!p || !S.unlocked.includes(p.region)) return;
    const chs = chartersAt(pid);
    out.push(chs.length ? charterRoute(chs[0]) : portRoute(pid));
  });
  return out;
}

export function routeById(id) {
  const r = routes.find(x => x.id === id);
  if (r) return r;
  const bk = Object.keys(BOSSES).find(k => BOSSES[k].id === id);
  if (bk) return bossAsRoute(BOSSES[bk]);
  if (id.startsWith('pt_')) {
    const pid = id.slice(3), chs = chartersAt(pid);
    return chs.length ? charterRoute(chs[0]) : portRoute(pid);
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
  return Math.max(1, Math.ceil((v.endsAt - now()) / 60000 * RUSH_GEM_PER_MIN));
}

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  return m + ':' + String(s).padStart(2, '0');
}
