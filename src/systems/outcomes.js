/* What winning or losing a battle mission does to the world.

   Battles never open a trade route any more — trade routes are always open. What
   a patrol buys you is a quieter region, which makes cargo runs through it
   safer; everything else pays in coin, materials and reputation. */

import { S, syncFlag } from '../core/state.js';
import { PATROL_MS } from '../core/config.js';
import { now } from '../core/dom.js';
import { REGIONS, DNAMES } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { BOONS } from '../data/flagship.js';
import { fmtDur, bossAsRoute, grant, sweepLane, sweepRegion, effDanger } from '../core/selectors.js';
import { addNoto } from './notoriety.js';
import { awardPiece, rollDrop } from './collectibles.js';
import { goodsHaul, haulLine } from './loot.js';
import { showResult } from '../ui/result.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';

const prizesFrom = enemies => enemies.filter(e => e.disabled);

/* Beaten ships occasionally give up something for the great cabin. */
function battleDrop() {
  return Math.random() < 0.16 ? rollDrop('battle') : null;
}
const dropLine = d => (d ? `${d.name} was taken off her — ${d.setName}, ${d.have} of ${d.of}.` : '');

export function battleVictory(route, enemies) {
  grant(route.rew);
  S.done[route.id] = (S.done[route.id] || 0) + 1;
  const noto = addNoto(route);
  const haul = goodsHaul(route.region, route.danger);

  let msg = 'The water is yours. What was floating out here is not any more.';

  if (route.type === 'patrol') {
    /* The broad version of a sweep: every lane in the region drops a step, and
       the water stays quiet for a while on top of that. */
    S.patrol[route.region] = now() + PATROL_MS;
    const cleared = sweepRegion(route.region);
    msg = `Your patrol has the run of ${REGIONS[route.region].n}.`
      + (cleared ? ` ${cleared} lane${cleared === 1 ? '' : 's'} pushed back a step,` : '')
      + ` and the whole region stays a step quieter for ${fmtDur(PATROL_MS / 1000)}.`;
  } else if (route.type === 'escort') {
    msg = 'The merchant makes port with her cargo and her crew, and says so loudly to anyone who will listen.';
  } else if (route.type === 'blockade') {
    msg = 'The blockade is broken open and the ships behind it are already moving.';
  }

  showResult({
    route, success: true, msg: msg + ' ' + haulLine(haul),
    captives: prizesFrom(enemies), noto, prizeMsg: dropLine(battleDrop())
  });
}

/* Sweeping a cargo lane: the escort action that pushes one lane's danger down a
   step. It never opens the lane — the lane was always open — it just makes the
   next run through it a safer bet. */
export function sweepVictory(route, enemies) {
  const { before, after } = sweepLane(route);
  grant({ gold: 120 + 90 * before });
  S.done['sweep_' + route.id] = (S.done['sweep_' + route.id] || 0) + 1;
  const noto = addNoto(route);
  const haul = goodsHaul(route.region, before);

  let msg = `The lane is swept. ${route.n} drops from ${DNAMES[before].toLowerCase()} to ${DNAMES[after].toLowerCase()}.`;
  if (after === 0) msg += ' Nothing is working this water now.';
  msg += ' ' + haulLine(haul);

  showResult({
    route, success: true, msg,
    captives: prizesFrom(enemies), noto, prizeMsg: dropLine(battleDrop())
  });
}

export function sweepLoss(route) {
  showResult({
    route, success: false,
    msg: `They hold the lane. ${route.n} is still ${DNAMES[effDanger(route)].toLowerCase()}, and anything you send through it carries that risk.`
  });
}

export function charterVictory(route, enemies) {
  const c = route.charterDef;
  S.charters[c.id] = 1;
  grant(route.rew);
  const noto = addNoto(route);

  let msg = `The commission is discharged and the paper signed off in front of witnesses. "${c.n}" is done.`;
  let prizeMsg = '';

  if (c.dest && !S.ports.includes(c.dest)) {
    S.ports.push(c.dest);
    msg += ` ${PORTS[c.dest].n} is charted — it will offer you cargo contracts from now on.`;
    setTimeout(() => toast('New port charted: ' + PORTS[c.dest].n, 'gold'), 800);
  }

  if (c.prize) {
    if (c.prize.piece) {
      const got = awardPiece(c.prize.piece);
      prizeMsg = got
        ? `${got.name} — ${got.setName}, ${got.have} of ${got.of}.`
        : `${c.prize.piece} again. You already have one; it goes in a drawer.`;
    }
    if (c.prize.boon) {
      S.flagBoons.push(c.prize.boon);
      syncFlag();
      const b = BOONS[c.prize.boon];
      prizeMsg = 'Refit: ' + b.n + ' — ' + b.desc + ', fitted aboard the ' + S.flag.name + '.';
      setTimeout(() => { play('upgrade'); toast(b.n + ' fitted.', 'gold'); }, 1200);
    }
    if (c.prize.gold) {
      S.gold += c.prize.gold;
      prizeMsg = 'A map came with the payment. Whatever it pointed at was worth ' + c.prize.gold + ' gold.';
    }
  }

  const haul = goodsHaul(route.region, route.danger);
  showResult({ route, success: true, msg: msg + ' ' + haulLine(haul), captives: prizesFrom(enemies), noto, prizeMsg });
}

export function bossVictory(boss, enemies) {
  S.bossBeaten[boss.region] = true;
  grant(boss.rew);
  buzz('win');

  /* Boss titles are written with their article ("The Ironclad"), so no "The". */
  let msg = `${boss.n} strikes her colours with what is left of her upperworks on fire. ${boss.title} is broken, and every captain in these waters will know it by morning.`;

  if (boss.unlocks && !S.unlocked.includes(boss.unlocks)) {
    S.unlocked.push(boss.unlocks);
    msg += ` The chart opens: ${REGIONS[boss.unlocks].n} lies before you.`;
    setTimeout(() => toast('New waters charted: ' + REGIONS[boss.unlocks].n, 'gold'), 800);
  } else if (!boss.unlocks) {
    msg += ' Nothing stands between you and the Grand Fleet Route now.';
    if (!S.won) {
      S.won = true;
      setTimeout(() => { play('victory'); toast('The Grand Fleet Route lies open.', 'gold'); }, 800);
    }
  }

  showResult({
    route: bossAsRoute(boss), success: true, msg,
    captives: enemies.filter(e => e.disabled && !e.isBoss), noto: 0,
    prizeMsg: dropLine(rollDrop('battle'))
  });
}

/* Loss copy, by mission type. */
export function battleLoss(route, boss) {
  const msg = boss
    ? `${boss.n} still holds this water and knows your face now. Your line broke and ran, and she let you go — which is its own kind of message.`
    : route.type === 'charter'
      ? 'The commission goes unfulfilled and the man who offered it is not pleased. It stands, though. Refit and come back for it.'
      : route.type === 'escort'
        ? 'They took the merchant out from under your guns and were over the horizon before you could come about. The contract is void and word will get around.'
        : 'What is left of your line limps home under torn canvas. Nothing out here has changed.';
  showResult({ route, success: false, msg });
}
