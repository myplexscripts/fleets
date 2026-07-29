/* Voyages: the two reasons a ship leaves port.

   A cargo run carries goods to a port and is paid for the delivery.
   A wreck dive brings up chests, which are sold as they surface.

   Neither can turn into a battle — combat lives entirely on the battle
   missions. The only thing that can go wrong on a cargo run is losing the
   cargo, and a dive cannot go wrong at all. */

import { S, save, nextVoyId } from '../core/state.js';
import { VOY_MAX_ACTIVE } from '../core/config.js';
import { now } from '../core/dom.js';
import { rnd } from '../core/rng.js';
import { GOODS } from '../data/goods.js';
import { DIVE_FIND_CHANCE } from '../data/salvage.js';
import { clearContract } from '../core/contracts.js';
import { clearDive } from '../core/dives.js';
import {
  findShip, fleetPower, holdCap, voyDuration, voyageOpen, voyReady,
  tradeChance, notoGain, hasFit, fmtDur, grant, diveChests, chestValue
} from '../core/selectors.js';
import { addNoto } from './wanted.js';
import { rollDrop } from './collectibles.js';
import { returnCargo } from './loot.js';
import { say, deny } from '../fx/pop.js';
import { play } from '../fx/sound.js';
import { showResult } from '../ui/result.js';
import { award } from '../fx/award.js';

export function launchVoyage(route, fleet) {
  if (!voyageOpen(route)) return false;
  /* One ship per voyage. The interesting question is whether any single hull in
     the fleet is big enough for the job — pooling three of them would answer it
     for free. */
  if (fleet.length !== 1) {
    deny('Pick one ship');
    return false;
  }
  if (S.voyages.length >= VOY_MAX_ACTIVE) {
    deny('No fleets to spare');
    return false;
  }
  if (route.type === 'cargo') {
    if (holdCap(fleet) < route.qty) {
      deny('Hold is too small');
      return false;
    }
    /* Goods leave the warehouse now — they are aboard. */
    S.goods[route.good] -= route.qty;
  }

  const dur = voyDuration(route, fleet);
  const v = {
    id: nextVoyId(), routeId: route.id, routeName: route.n, region: route.region,
    type: route.type, ships: fleet.map(s => s.id),
    startedAt: now(), endsAt: now() + dur * 1000,
    rew: route.rew, noto: notoGain(route)
  };

  if (route.type === 'cargo') {
    v.odds = tradeChance(route, fleetPower(fleet));
    v.good = route.good;
    v.qty = route.qty;
    v.dest = route.dest;
    v.portId = route.portId || null;
  } else {
    v.odds = 100;                                  // dives are safe by design
    v.depth = route.depth;
    v.chests = diveChests(route, fleet, Math.random());
    v.chestValue = chestValue(route);
  }

  S.voyages.push(v);
  play('depart');
  say(fmtDur(dur), 'blu', 'time');
  save();
  return true;
}

export function collectVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v || !voyReady(v)) return;
  S.voyages = S.voyages.filter(x => x.id !== id);

  const fleet = v.ships.map(findShip).filter(Boolean);
  return v.type === 'dive' ? finishDive(v, fleet) : finishCargo(v, fleet);
}

/* ---- cargo runs ---- */
function finishCargo(v, fleet) {
  const success = Math.random() * 100 < v.odds;
  const g = GOODS[v.good];
  let msg = '', evt = '', back = null;

  if (success) {
    grant(v.rew);
    S.done[v.routeId] = (S.done[v.routeId] || 0) + 1;
    if (v.portId) clearContract(v.portId);   // the port draws a new one
    /* She comes home loaded with whatever was going the other way. */
    back = returnCargo(v.region, v.good, v.qty);
    msg = `The consignment was landed at ${v.dest} and signed for.`;
    play('arrive');
  } else {
    /* The cargo is already gone — it was deducted at launch. */
    const alive = damageable(fleet);
    if (alive.length) {
      const s = alive[Math.floor(Math.random() * alive.length)];
      const dm = Math.round(s.max * rnd(0.2, 0.45));
      s.hull = Math.max(0, s.hull - dm);
      msg = `Raiders took the fleet mid-passage and stripped the hold. The ${g.n.toLowerCase()} is gone, there is no payment, and the ${s.name} came home with ${dm} damage.`;
    } else {
      msg = `The hold was stripped at sea. The ${g.n.toLowerCase()} is gone and there is no payment.`;
    }
    play('defeat');
  }

  evt = sideEvent(fleet);
  const noto = success ? addNoto({ region: v.region, id: v.routeId, type: v.type, danger: 0 }, v.noto) : 0;

  showResult({
    route: { id: v.routeId, n: v.routeName, region: v.region, type: v.type, rew: v.rew },
    success, msg, evt, noto, fromVoyage: true,
    spoils: back ? { goods: back } : null
  });
}

/* ---- wreck dives ---- */
function finishDive(v, fleet) {
  const chests = Math.max(1, v.chests | 0);
  const takings = chests * (v.chestValue || 0);

  /* Chests never enter the hold as an item — they are sold on the quayside. */
  S.gold += takings;
  grant(v.rew);
  S.done[v.routeId] = (S.done[v.routeId] || 0) + 1;
  /* The wreck has been emptied. She comes off the chart, and the coast turns up
     another one somewhere else. */
  if (v.routeId && v.routeId.startsWith('dv_')) clearDive(v.routeId.slice(3));
  play('coin');

  const msg = `${chests} chest${chests === 1 ? '' : 's'} came up off the wreck and went straight to the buyers on the quay for ${takings} gold.`;
  /* No finds during the tutorial — an award modal over a scripted step fights
     the script. Same reason the side events are held back. */
  const found = (typeof S.tut !== 'number' && Math.random() < diveFindChance(v.depth))
    ? rollDrop('dive') : null;
  if (found) {
    setTimeout(() => award({
      icon: 'relic', kind: 'Came Up With the Last Chest', title: found.name,
      text: `${found.setName} — ${found.have} of ${found.of}.`, ok: 'Continue'
    }), 700);
  }

  const noto = addNoto({ region: v.region, id: v.routeId, type: v.type, danger: 0 }, v.noto);

  showResult({
    route: { id: v.routeId, n: v.routeName, region: v.region, type: v.type, rew: v.rew },
    success: true, msg, evt: sideEvent(fleet), noto,
    extra: { gold: takings }, fromVoyage: true
  });
}

/* ---- shared ---- */
const diveFindChance = d => DIVE_FIND_CHANCE[d] || 0;

/* Copper sheathing keeps the flagship out of harm's way. */
const damageable = fleet =>
  fleet.filter(s => s.hull > 0 && !(hasFit('copper') && s.id === 'FLAG'));

/* Something unrelated happens on roughly a third of voyages. */
function sideEvent(fleet) {
  if (Math.random() >= 0.3 || typeof S.tut === 'number') return '';
  const alive = damageable(fleet);
  const roll = Math.random();
  if (roll < 0.35 && alive.length) {
    const s = alive[Math.floor(Math.random() * alive.length)];
    const dm = Math.max(1, Math.round(s.max * rnd(0.06, 0.14)));
    s.hull = Math.max(0, s.hull - dm);
    return `A storm on the way home damaged the ${s.name} for ${dm}.`;
  }
  if (roll < 0.7) {
    const salvaged = Math.floor(rnd(2, 6));
    S.mats.wood += salvaged;
    return `The crew pulled ${salvaged} timber out of floating wreckage on the way home.`;
  }
  return 'A red moon on the third night. The crew have opinions about it. Nothing came of it.';
}
