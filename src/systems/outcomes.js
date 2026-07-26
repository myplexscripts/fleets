/* What winning or losing a battle does to the world. */

import { S, syncFlag } from '../core/state.js';
import { SEC_PER_WIN, PATROL_MS } from '../core/config.js';
import { now } from '../core/dom.js';
import { DNAMES, REGIONS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { BOONS } from '../data/flagship.js';
import { effDanger, addSec, secNow, canVoyage, bossAsRoute } from '../core/selectors.js';
import { addNoto } from './notoriety.js';
import { showResult } from '../ui/result.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';

const prizesFrom = enemies => enemies.filter(e => e.disabled);

export function battleVictory(route, enemies) {
  const before = effDanger(route);
  addSec(route.id, SEC_PER_WIN);
  const after = effDanger(route);

  S.reales += route.rew.reales || 0;
  S.parts  += route.rew.parts || 0;
  S.gems   += route.rew.gems || 0;
  S.done[route.id] = (S.done[route.id] || 0) + 1;

  const noto = addNoto(route);
  if (route.type === 'patrol') S.patrol[route.region] = now() + PATROL_MS;

  let msg = `The lane is clear. Its security is now ${Math.round(secNow(route.id))}%.`;
  if (after < before) msg += ` The danger rating has dropped to ${DNAMES[after].toLowerCase()}.`;
  if (canVoyage(route) && after <= 1 && before > 1) {
    msg += ' It is now safe enough to send trade runs along it.';
    setTimeout(() => toast(route.n + ' is safe enough to trade now.', 'gold'), 800);
  }
  if (route.type === 'patrol') {
    msg += ` Your patrol holds ${REGIONS[route.region].n} quieter for a while.`;
  }

  showResult({ route, success: true, msg, captives: prizesFrom(enemies), noto });
}

export function charterVictory(route, enemies) {
  const c = route.charterDef;
  S.charters[c.id] = 1;
  S.reales += route.rew.reales;
  S.parts  += route.rew.parts;
  const noto = addNoto(route);

  let msg = `The commission is discharged and the paper signed off in front of witnesses. "${c.n}" is done.`;
  let prizeMsg = '';

  if (c.dest && !S.ports.includes(c.dest)) {
    S.ports.push(c.dest);
    msg += ` ${PORTS[c.dest].n} is charted, and a standing lane runs there now.`;
    setTimeout(() => toast('New port charted: ' + PORTS[c.dest].n, 'gold'), 800);
  }

  if (c.prize) {
    if (c.prize.relic) {
      S.relics.push(c.prize.relic);
      prizeMsg = 'Relic: ' + c.prize.relic + " — it will look well enough in the captain's quarters.";
      setTimeout(() => { play('relic'); toast('Relic claimed: ' + c.prize.relic, 'gold'); }, 1200);
    }
    if (c.prize.boon) {
      S.flagBoons.push(c.prize.boon);
      syncFlag();
      const b = BOONS[c.prize.boon];
      prizeMsg = 'Refit: ' + b.n + ' — ' + b.desc + ', fitted aboard the ' + S.flag.name + '.';
      setTimeout(() => { play('upgrade'); toast(b.n + ' fitted.', 'gold'); }, 1200);
    }
    if (c.prize.gems) {
      S.gems += c.prize.gems;
      prizeMsg = 'A map came with the payment. Whatever it pointed at was worth ' + c.prize.gems + ' gems.';
    }
  }

  showResult({ route, success: true, msg, captives: prizesFrom(enemies), noto, prizeMsg });
}

export function bossVictory(boss, enemies) {
  S.bossBeaten[boss.region] = true;
  S.reales += boss.rew.reales;
  S.parts  += boss.rew.parts;
  S.gems   += boss.rew.gems;
  buzz('win');

  /* Boss titles are written with their article ("The Ironclad"), so no "The" here. */
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
        ? 'They took the merchant out from under your guns and were over the horizon before you could come about. The charter is void and word will get around.'
        : 'What is left of your line limps home under torn canvas. The lane is exactly as dangerous as it was this morning.';
  showResult({ route, success: false, msg });
}
