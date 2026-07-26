/* Trade runs: launching, and what the fleet brings home. */

import { S, save, nextVoyId } from '../core/state.js';
import { VOY_MAX_ACTIVE } from '../core/config.js';
import { now } from '../core/dom.js';
import { rnd } from '../core/rng.js';
import {
  findShip, fleetPower, fleetHull, voyDuration, voyageOpen, voyReady,
  tradeChance, salvageChance, notoGain, hasFit, fmtDur
} from '../core/selectors.js';
import { addNoto } from './notoriety.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { showResult } from '../ui/result.js';

export function launchVoyage(route, fleet) {
  if (!fleet.length || !voyageOpen(route)) return false;
  if (S.voyages.length >= VOY_MAX_ACTIVE) {
    toast('You already have as many fleets at sea as you can manage.', 'bad');
    return false;
  }
  if (route.cargo) S.cargo -= route.cargo;

  const dur = voyDuration(route, fleet);
  const odds = route.type === 'salvage'
    ? salvageChance(route, fleetHull(fleet))
    : tradeChance(route, fleetPower(fleet));

  S.voyages.push({
    id: nextVoyId(), routeId: route.id, routeName: route.n, region: route.region, type: route.type,
    ships: fleet.map(s => s.id), startedAt: now(), endsAt: now() + dur * 1000,
    odds, rew: route.rew, noto: notoGain(route), shipFind: route.ship || null
  });

  play('depart');
  toast('Fleet away. Back in ' + fmtDur(dur) + '.', 'blu');
  save();
  return true;
}

export function collectVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v || !voyReady(v)) return;
  S.voyages = S.voyages.filter(x => x.id !== id);

  const fleet = v.ships.map(findShip).filter(Boolean);
  const success = Math.random() * 100 < v.odds;
  const captives = [];
  let msg = '', evt = '';

  /* Copper sheathing keeps the flagship out of harm's way on a bad run. */
  const damageable = () => fleet.filter(s => s.hull > 0 && !(hasFit('copper') && s.id === 'FLAG'));

  if (success) {
    S.reales += v.rew.reales || 0;
    S.parts  += v.rew.parts || 0;
    S.gems   += v.rew.gems || 0;
    S.done[v.routeId] = (S.done[v.routeId] || 0) + 1;
    msg = 'The fleet docked with full holds. The run paid out.';
    if (v.shipFind && Math.random() < v.shipFind.chance) {
      captives.push({ type: v.shipFind.type, derelict: true });
      msg = 'The fleet docked with full holds, towing a wreck they raised on the way.';
    }
    play('arrive');
  } else {
    const alive = damageable();
    if (alive.length) {
      const s = alive[Math.floor(Math.random() * alive.length)];
      const dm = Math.round(s.max * rnd(0.2, 0.45));
      s.hull = Math.max(0, s.hull - dm);
      msg = `Raiders caught the fleet mid-passage and took the cargo. No payment, and the ${s.name} came home with ${dm} damage.`;
    } else {
      msg = 'The cargo was lost at sea. No payment.';
    }
    play('defeat');
  }

  /* An unrelated something happens on roughly a third of runs. */
  if (Math.random() < 0.3 && typeof S.tut !== 'number') {
    const alive = damageable();
    const roll = Math.random();
    if (roll < 0.35 && alive.length) {
      const s = alive[Math.floor(Math.random() * alive.length)];
      const dm = Math.max(1, Math.round(s.max * rnd(0.06, 0.14)));
      s.hull = Math.max(0, s.hull - dm);
      evt = `A storm on the way home damaged the ${s.name} for ${dm}.`;
    } else if (roll < 0.7) {
      const cg = Math.floor(rnd(3, 8));
      S.cargo += cg;
      evt = `The fleet salvaged ${cg} cargo units from floating wreckage on the way home.`;
    } else {
      evt = 'A red moon on the third night. The crew have opinions about it. Nothing came of it.';
    }
  }

  const noto = success
    ? addNoto({ region: v.region, id: v.routeId, type: v.type, danger: 0 }, v.noto)
    : 0;

  showResult({
    route: { id: v.routeId, n: v.routeName, region: v.region, type: v.type, rew: v.rew },
    success, msg, captives, evt, noto, fromVoyage: true
  });
}
