/* Derived game facts. Pure reads over `S`, plus the small wallet helpers that
   every screen needs. No DOM. */

import { S, routes } from './state.js';
import {
  VOY_SEC_PER_DAY, VOY_MAX_ACTIVE, RUSH_GOLD_PER_MIN, CARGO_PER_CHEST,
  DANGER_RISE_MIN_DEFAULT, LANE_CLEAR_STEP, WANTED_COOL_PER_MIN
} from './config.js';
import { TYPES } from '../data/ships.js';
import { REGIONS, NOTO_BONUS, VOYAGE_TYPES, MAX_DANGER } from '../data/world.js';
import { REGION_RATING, DANGER_MULT, HEAT_MULT } from '../data/water.js';
import { PORTS } from '../data/ports.js';
import { CHARTERS } from '../data/charters.js';
import { BOSSES } from '../data/bosses.js';
import { GOOD_KEYS } from '../data/goods.js';
import { MAT_KEYS } from '../data/materials.js';
import { SETS, SET_KEYS } from '../data/collectibles.js';
import { bellMaxDepth, CHEST_VALUE } from '../data/salvage.js';
import { contractRoute } from './contracts.js';
import { ensureDives, diveRoute, diveById } from './dives.js';
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
   real time, up to that lane's own cap. Fighting the lane pushes it down a step;
   patrolling its region does the same to every lane there at once. Neither is
   compulsory — danger never blocks trade, it only decides how roughly a run is
   handled, so sailing a bad lane anyway is always allowed.

   Stored as (step, timestamp) and projected forward on read, so it keeps
   drifting while the game is closed without needing a ticker. */
export const patrolActive = rk => (S.patrol[rk] || 0) > now();
export const patrolLeft = rk => Math.max(0, (S.patrol[rk] || 0) - now());

const hasLane = r => r.type === 'cargo';
const laneCap = r => Math.min(MAX_DANGER, r.dangerCap == null ? MAX_DANGER : r.dangerCap);
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

/* Fighting a lane knocks its own danger down a step. Snapshot the drift first,
   because the record is about to be rewritten. */
export function clearLane(r) {
  const before = laneDanger(r);
  const after = Math.max(0, before - LANE_CLEAR_STEP);
  S.lanes[r.id] = { d: after, ts: now(), region: r.region };
  return { before, after };
}

/* A patrol does the same to every lane in its region at once. */
export function calmRegion(rk) {
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
  return Math.max(0, Math.min(MAX_DANGER, base - (patrolActive(r.region) ? 1 : 0)));
}

/* A lane worth fighting. Safe water has nothing working it, so there is nothing
   to clear — anything above that, the player may fight or simply sail. */
export const laneFight = r => hasLane(r) && effDanger(r) > 0;

/* What clearing a lane pays in coin. Deliberately modest — the reason to take
   a lane fight is what you strip off the ships you beat and the prizes you take
   from them, which is worth many times this. A flat clearance fee that competed
   with a cargo run would just be a second, worse cargo run. */
export const lanePay = r => ({ gold: Math.round(routeRating(r) * (2 + laneDanger(r))) });

/* ---- the free repair ----
   Offered only when the flagship is damaged and the purse cannot cover fixing
   her. Never a timer, never better than paying, and gone the moment you can. */
export const freeRepairOffered = () =>
  !!S.flag && S.flag.hull < S.flag.max && S.gold < repairCost(S.flag);

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
   and the ship's cargo space caps what can be brought up in one trip — a chest
   takes CARGO_PER_CHEST of it, which is what makes a bigger hull worth having
   on a dive as well as on a run. */
export const chestCap = fleet => Math.max(1, Math.floor(holdCap(fleet) / CARGO_PER_CHEST));

export function diveChests(r, fleet, roll) {
  const spare = Math.max(0, S.bell - (r.depth - 1));
  const spread = r.chestMax - r.chestMin;
  const base = r.chestMin + (roll === undefined ? spread / 2 : Math.floor(roll * (spread + 1)));
  return Math.max(1, Math.min(chestCap(fleet), Math.round(base + spare)));
}
export const chestValue = r => CHEST_VALUE[r.depth] || 0;

/* A voyage is launchable when its own gate is satisfied. */
export function voyageOpen(r) {
  if (r.type === 'dive') return diveReachable(r);
  if (r.type === 'cargo') return cargoReady(r);
  return false;
}

/* What a cargo run asks of the ship you send: space for the consignment, guns
   enough to see off the water it crosses, and the legs to get there. Only the
   first is a hard gate — the other two are met or paid for. */
export const runNeeds = r => ({
  cargo: r.qty || 0,
  power: r.power || 0,
  speed: r.speed || 0
});

/* Chance a cargo run arrives intact.

   Measured against the water she has to cross, not against a separate danger
   tax bolted onto the odds. Danger and heat are already inside the rating, so
   there is one number deciding how bad a passage is and it is the same number
   that decides who would be waiting if you went looking for a fight. Under what
   the water is rated for the odds fall away fast; over it there is little more
   to gain, which is what makes "strong enough" a real threshold rather than a
   stat to keep pouring into. */
export function tradeChance(r, fp) {
  const need = Math.max(1, (r.power || 0) || routeRating(r));
  const ratio = Math.min(1.45, fp / need);
  return Math.max(20, Math.min(98, Math.round(100 * (0.44 + 0.40 * ratio))));
}

/* Estimated odds of taking a fight, from the two line-ups' total power. It is a
   forecast, not a dice roll — the battle is still fought by hand. Shown before
   you commit so you can walk away and come back with a better fleet, which is
   the only answer to a bad match-up. */
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

/* ---- wanted level ----

   What used to be notoriety. The rename is not cosmetic: a progress bar only
   counts up, but a wanted level is something the world reacts to. Heat in a
   region does two things — it summons that region's admiral once it crosses her
   threshold, and until then it makes the water there worse, because the more
   badly you are wanted the heavier the ships that come looking.

   It cools on its own. Heat you earned three days ago is not heat. The one
   exception is a summoned admiral: once she is on the chart she stays there
   forever, so nobody can lose a boss by taking too long over it. */
export const wantedOf = rk => Math.max(0, Math.round(coolWanted(rk)));

function coolWanted(rk) {
  const rec = S.wanted[rk];
  if (!rec) return 0;
  const b = BOSSES[rk];
  /* Latched: she has been summoned and is not going away. */
  if (b && S.summoned[rk]) return Math.max(rec.v, b.noto);
  const mins = (now() - (rec.ts || now())) / 60000;
  return Math.max(0, rec.v - mins * WANTED_COOL_PER_MIN);
}

export function addWanted(rk, n) {
  const cur = coolWanted(rk);
  S.wanted[rk] = { v: Math.max(0, cur + n), ts: now() };
  return S.wanted[rk].v;
}

/* Heat as a 0..2 step, which is what the water rating actually consumes — the
   raw number is for the bar on the chart, the step is for the ocean. */
export function heatStep(rk) {
  const b = BOSSES[rk];
  const need = b ? b.noto : 100;
  const f = Math.min(1, wantedOf(rk) / Math.max(1, need));
  return f >= 0.66 ? 2 : (f >= 0.33 ? 1 : 0);
}

/* ---- how hard this water is ----

   One number per patch of ocean, from where it is, how bad the lane has got,
   and how badly you are wanted there. Never from the player's fleet: a rating
   that chased you would make home water exactly as dangerous on hour nine as
   on hour one. */
export function waterRating(region, danger) {
  const base = REGION_RATING[region] || REGION_RATING.caribbean;
  const d = Math.max(0, Math.min(MAX_DANGER, danger || 0));
  return Math.round(base * (1 + DANGER_MULT * d + HEAT_MULT * heatStep(region)));
}

/* The rating of the water a given route sits in, danger projected as of now. */
export const routeRating = r => waterRating(r.region, isBattle(r) ? (r.danger || 0) : effDanger(r));

/* ---- bosses ---- */
export function bossReady(rk) {
  const b = BOSSES[rk];
  if (!b || S.bossBeaten[rk]) return false;
  if (S.summoned[rk]) return true;
  return wantedOf(rk) >= b.noto;
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
    danger: Math.min(MAX_DANGER, Math.floor((c.t - 1) / 3)),
    power: 18 * c.t,
    rew: { gold: 140 * c.t, metal: c.t, cloth: c.t },
    x: p.x, y: p.y
  };
}
export function bossAsRoute(b) {
  return {
    id: b.id, region: b.region, n: b.n, type: 'boss', danger: MAX_DANGER,
    power: b.power, rew: b.rew, bossDef: b, final: b.final, x: b.x, y: b.y
  };
}

/* Every mission currently on the chart: fixed nodes plus one node per charted
   port — a charter if one is on offer there, otherwise its cargo contract. */
/* Two kinds of marker come back rather than staying put: a hunting ground you
   have just cleared, and a convoy you have just taken. Both are empty for a
   while and then somebody else is out there — which is the whole difference
   between a place on a chart and an event that happens at one. */
const RESPAWNS = ['hunt', 'convoy'];
export const huntCoolLeft = id => Math.max(0, (S.hunts[id] || 0) - now());
export const huntUp = r => !RESPAWNS.includes(r.type) || huntCoolLeft(r.id) <= 0;

export function allRoutes() {
  const out = routes.filter(r =>
    S.unlocked.includes(r.region)
    && (!r.requiresBoss || S.bossBeaten[r.requiresBoss])
    && huntUp(r));

  /* Wrecks are a live set: the bell decides which depths exist and finishing
     one takes it off the chart. See core/dives.js. */
  ensureDives();
  (S.dives || []).forEach(d => {
    if (S.unlocked.includes(d.region)) out.push(diveRoute(d));
  });
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
  if (id.startsWith('dv_')) {
    const d = diveById(id);
    return d ? diveRoute(d) : null;
  }
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

/* You own one diving bell. It is aboard whichever ship is working a wreck, so
   a second dive would need a second bell — and there is only ever one. */
export const diveOut = () => S.voyages.some(v => v.type === 'dive');
export const readyCount = () => S.voyages.filter(voyReady).length;
export const voyageSlotsFree = () => S.voyages.length < VOY_MAX_ACTIVE;

/* Time away.

   A hull's speed is the thing that decides it, and it decides it hard: the
   fastest ship you own comes home in around a third of the time the slowest
   one takes on the same run. That is the whole trade against her hold — a Man
   o' War carries five times what a schooner does and takes far longer over it,
   so "which ship for this job" has a real answer that changes with the job
   rather than always being "the biggest one that fits". */
export function voyDuration(r, fleet) {
  const avg = fleet.reduce((a, s) => a + s.speed, 0) / Math.max(1, fleet.length);
  const need = r.speed || 4;
  const factor = Math.max(0.4, Math.min(2.2, 1 + (need - avg) * 0.2));
  return Math.max(45, Math.round(r.len * VOY_SEC_PER_DAY * factor));
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
