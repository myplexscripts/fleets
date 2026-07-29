/* What winning or losing a battle mission does to the world.

   Battles never open a trade route — trade routes are always open. What a patrol
   buys you is a quieter region, which makes every cargo run through it safer;
   everything else pays in coin, materials and reputation. A patrol is the only
   thing in the game that lowers danger. */

import { S, syncFlag } from '../core/state.js';
import { PATROL_MS, HUNT_COOLDOWN_MS } from '../core/config.js';
import { now } from '../core/dom.js';
import { REGIONS, DNAMES } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { BOONS } from '../data/flagship.js';
import { fmtDur, bossAsRoute, grant, clearLane, calmRegion, lanePay, effDanger } from '../core/selectors.js';
import { addNoto } from './wanted.js';
import { awardPiece, rollDrop } from './collectibles.js';
import { clearDraw } from './enemies.js';
import { goodsHaul, matsHaul } from './loot.js';
import { showResult } from '../ui/result.js';
import { award } from '../fx/award.js';
import { buzz } from '../fx/haptics.js';

const prizesFrom = enemies => enemies.filter(e => e.disabled);

/* Beaten ships occasionally give up something for the great cabin. A find is
   never a line of text you might miss — it stops the game and asks to be taken,
   which is also why the tutorial never produces one: a modal that lands on top
   of a scripted step is fighting the script. */
/* How often a beaten ship gives up something for the great cabin.

   Deliberately small. A collectible turning up one fight in six is not a find,
   it is a drip — and the sets are meant to be the thing you are quietly hoping
   for over a whole session rather than something you can count on this
   afternoon. */
const DROP_CHANCE = 0.035;

function battleDrop() {
  if (typeof S.tut === 'number') return null;
  const d = Math.random() < DROP_CHANCE ? rollDrop('battle') : null;
  if (d) {
    setTimeout(() => award({
      icon: 'relic', kind: 'Taken Off Her', title: d.name,
      text: `${d.setName} — ${d.have} of ${d.of}.`, ok: 'Continue'
    }), 700);
  }
  return d;
}

export function battleVictory(route, enemies) {
  clearDraw(route.id);
  grant(route.rew);
  S.done[route.id] = (S.done[route.id] || 0) + 1;
  const noto = addNoto(route);
  const spoils = { goods: goodsHaul(route.region, route.danger), mats: matsHaul(route.region, route.danger) };

  let msg = 'The water is yours. What was floating out here is not any more.';

  if (route.type === 'hunt') {
    /* Cleared. The next one along will be somebody else entirely — the draw is
       forgotten above, and the ground itself goes quiet until they arrive. */
    S.hunts[route.id] = now() + HUNT_COOLDOWN_MS;
    msg = 'That is the last of them. Word gets around, though, and there is always '
      + 'somebody else willing to try for the price on your head.';
  } else if (route.type === 'patrol') {
    /* Every lane in the region drops a step, and the water stays quiet for a
       while on top of that. This is the only way danger ever comes down. */
    S.patrol[route.region] = now() + PATROL_MS;
    const cleared = calmRegion(route.region);
    msg = `Your patrol has the run of ${REGIONS[route.region].n}.`
      + (cleared ? ` ${cleared} lane${cleared === 1 ? '' : 's'} pushed back a step,` : '')
      + ` and the whole region stays a step quieter for ${fmtDur(PATROL_MS / 1000)}.`;
  } else if (route.type === 'escort') {
    msg = 'The merchant makes port with her cargo and her crew, and says so loudly to anyone who will listen.';
  } else if (route.type === 'blockade') {
    msg = 'The blockade is broken open and the ships behind it are already moving.';
  }

  battleDrop();
  showResult({ route, success: true, msg, spoils, captives: prizesFrom(enemies), noto });
}

/* Clearing a cargo lane: the fight you may take on a lane that has gone bad,
   instead of — or before — running it. It never opens the lane; the lane was
   always open. It just makes the next passage through it a better bet. */
export function laneVictory(route, enemies) {
  /* Quoted on the sheet before the fight, so read the pay before clearing moves
     the lane out from under it. */
  const pay = lanePay(route);
  clearDraw(route.id);
  const { before, after } = clearLane(route);
  grant(pay);
  S.done['lane_' + route.id] = (S.done['lane_' + route.id] || 0) + 1;
  const noto = addNoto(route);
  const spoils = { goods: goodsHaul(route.region, before), mats: matsHaul(route.region, before) };

  let msg = `The water is yours. ${route.n} drops from ${DNAMES[before].toLowerCase()} to ${DNAMES[after].toLowerCase()}.`;
  if (after === 0) msg += ' Nothing is working this lane now.';

  battleDrop();
  showResult({ route, success: true, msg, spoils, captives: prizesFrom(enemies), noto });
}

export function laneLoss(route) {
  showResult({
    route, success: false,
    msg: `They hold the lane. ${route.n} is still ${DNAMES[effDanger(route)].toLowerCase()}, and anything you send through it carries that risk.`
  });
}

export function charterVictory(route, enemies) {
  clearDraw(route.id);
  const c = route.charterDef;
  S.charters[c.id] = 1;
  grant(route.rew);
  const noto = addNoto(route);

  let msg = `The commission is discharged and the paper signed off in front of witnesses. "${c.n}" is done.`;
  let prizeMsg = '';

  if (c.dest && !S.ports.includes(c.dest)) {
    S.ports.push(c.dest);
    setTimeout(() => award({
      icon: 'port', kind: 'New Port', title: PORTS[c.dest].n,
      text: 'Charted for good. It will keep a cargo contract open for you.',
      ok: 'Continue'
    }), 700);
  }

  if (c.prize) {
    if (c.prize.piece) {
      const got = awardPiece(c.prize.piece);
      if (got) {
        setTimeout(() => award({
          icon: 'relic', kind: 'Collectible', title: got.name,
          text: `${got.setName} — ${got.have} of ${got.of}.`, ok: 'Continue'
        }), 900);
      } else {
        prizeMsg = `${c.prize.piece} again. You already have one; it goes in a drawer.`;
      }
    }
    if (c.prize.boon) {
      S.flagBoons.push(c.prize.boon);
      syncFlag();
      const b = BOONS[c.prize.boon];
      setTimeout(() => award({
        icon: 'relic', kind: 'Legendary Refit', title: b.n, text: b.desc,
        sound: 'upgrade', ok: 'Continue'
      }), 900);
      prizeMsg = '';
    }
    if (c.prize.gold) {
      S.gold += c.prize.gold;
      prizeMsg = 'A map came with the payment. Whatever it pointed at was worth ' + c.prize.gold + ' gold.';
    }
  }

  const spoils = { goods: goodsHaul(route.region, route.danger), mats: matsHaul(route.region, route.danger) };
  showResult({ route, success: true, msg, spoils, captives: prizesFrom(enemies), noto, prizeMsg });
}

export function bossVictory(boss, enemies) {
  S.bossBeaten[boss.region] = true;
  battleDrop();
  grant(boss.rew);
  buzz('win');

  /* Boss titles are written with their article ("The Ironclad"), so no "The". */
  let msg = `${boss.n} strikes her colours with what is left of her upperworks on fire. ${boss.title} is broken, and every captain in these waters will know it by morning.`;

  if (boss.unlocks && !S.unlocked.includes(boss.unlocks)) {
    S.unlocked.push(boss.unlocks);
    setTimeout(() => award({
      icon: 'map', kind: 'New Waters', title: REGIONS[boss.unlocks].n,
      text: 'The chart opens. Fresh water, richer cargo, heavier ships.',
      sound: 'victory', ok: 'Continue'
    }), 700);
  } else if (!boss.unlocks) {
    msg += ' Nothing stands between you and the Grand Fleet Route now.';
    if (!S.won) {
      S.won = true;
      setTimeout(() => award({
        icon: 'star', kind: 'The Ocean Is Yours', title: 'Grand Fleet Route',
        text: 'Nothing stands between you and it now.',
        sound: 'victory', ok: 'Continue'
      }), 800);
    }
  }

  showResult({
    route: bossAsRoute(boss), success: true, msg,
    spoils: { goods: goodsHaul(boss.region, 3), mats: matsHaul(boss.region, 3) },
    captives: enemies.filter(e => e.disabled && !e.isBoss), noto: 0
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
