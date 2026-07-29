/* The turn loop: one player order, then the enemy answers, then round ends. */

import { $, sleep } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { rnd, pick, fx } from '../core/rng.js';
import { power, hasFit } from '../core/selectors.js';
import { HIT_P, HIT_E, SINK, CRIP } from '../data/flavour.js';
import { action } from '../core/actions.js';
import { updateRes } from '../ui/hud.js';
import { refreshTut, tutEvent, tutRewindToCombat } from '../ui/tutorial.js';
import { wipe } from '../fx/wipe.js';
import { play, ambience } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';
import { award } from '../fx/award.js';
import { BT, gim, aliveE, aliveP } from './state.js';
import { BattleScene, phaserReady } from './scene.js';
import { blog, drawHud, lockOrders, showBanner, bannerOpen } from './hud.js';

let PG = null;   // the Phaser game, created once and reused

/* Boots a fresh Phaser game for each battle.

   It would be cheaper to keep one game alive across battles, but the battle
   screen is display:none between them, so the RESIZE scale mode collapses the
   canvas to 0x0 and the renderer cannot rebuild its framebuffer at that size —
   the next battle then draws nothing. Creating the game while the host is
   visible, and destroying it on the way out, keeps that impossible.

   If Phaser is unavailable the callback still runs with PG null; every visual
   call in this file is guarded, so the fight resolves through the log. */
function ensurePhaser(cb) {
  if (!phaserReady()) {
    const host = $('phaserHost');
    if (host && !host.dataset.fallback) {
      host.dataset.fallback = '1';
      host.innerHTML = '<div class="nofx">Battle graphics unavailable — fighting by signal flag.</div>';
    }
    cb();
    return;
  }
  if (PG) { PG.scale.refresh(); cb(); return; }
  PG = new Phaser.Game({
    type: Phaser.AUTO, parent: 'phaserHost', transparent: true,
    scale: { mode: Phaser.Scale.RESIZE }, scene: []
  });
  PG.events.once('ready', () => cb());
}

function teardownPhaser() {
  BT.scene = null;
  if (!PG) return;
  try { PG.destroy(true); } catch (e) { console.warn('[battle] teardown', e); }
  PG = null;
}

export function startBattle(fleet, enemies, escort, onEnd, boss) {
  BT.b = {
    fleet, enemies, onEnd, round: 1, target: 0, log: [],
    merchant: escort ? { type: 'merchant', name: 'Merchant Rose', hull: 40, max: 40 } : null,
    boss: boss || null,
    reinforce: (boss && boss.reinforce) || 0,
    reinfPool: (boss && boss.reinforcements) ? boss.reinforcements.slice() : [],
    telegraph: false
  };
  /* Clears BT.busy and the order bar's locked state together — a battle that
     ended on a win or an escape returns without unlocking, so without this the
     next battle would start with its orders greyed out and unclickable. */
  lockOrders(false);

  if (hasFit('magazine')) S.barrels = Math.min(9, S.barrels + 1);

  $('banner').classList.remove('on');
  $('battleScr').classList.add('on');
  $('battleScr').classList.toggle('boss', !!boss);
  ambience(true);
  if (boss) { play('boss_horn'); buzz('warn'); }

  blog(openingLine(boss, escort), boss ? 'bad' : '');

  drawHud();
  ensurePhaser(() => {
    if (PG) {
      if (PG.scene.getScene('battle')) PG.scene.remove('battle');
      PG.scene.add('battle', BattleScene, true);
    }
    refreshTut();
  });
}

/* Round-1 opener. Boss titles already start with "The". */
function openingLine(boss, escort) {
  if (boss) return `${boss.n} puts her helm over and comes about to meet you. ${boss.title}, in the flesh at last.`;
  if (escort) return "They came out of the haze on the convoy's blind quarter. Get between them and the merchant.";
  return 'Sails on the horizon, and not friendly ones. Beat to quarters.';
}

export const battleOpen = () => $('battleScr').classList.contains('on');

function retarget() {
  const b = BT.b;
  if (!b.enemies[b.target] || b.enemies[b.target].disabled) {
    const ni = b.enemies.findIndex(e => !e.disabled);
    if (ni > -1) {
      b.target = ni;
      if (BT.scene) BT.scene.setMarker(ni);
    }
  }
}

/* Keyboard target selection. */
export function cycleTarget(dir) {
  if (!BT.b || BT.busy) return;
  const live = BT.b.enemies.map((e, i) => ({ e, i })).filter(x => !x.e.disabled);
  if (live.length < 2) return;
  const at = live.findIndex(x => x.i === BT.b.target);
  const next = live[(at + (dir > 0 ? 1 : live.length - 1) + live.length) % live.length];
  BT.b.target = next.i;
  if (BT.scene) BT.scene.setMarker(next.i);
  play('ui_tap');
}

async function maybeReinforce(dead) {
  if (!gim('wolfpack') || BT.b.reinforce <= 0) return;
  const tpl = BT.b.reinfPool.shift();
  if (!tpl) return;
  BT.b.reinforce--;

  const nd = { ...tpl, max: tpl.hull, disabled: false, pal: 'boss' };
  BT.b.enemies.push(nd);
  blog(`Another sail cuts out of the fog where there was nothing — the ${nd.name} takes her place in the line.`, 'bad');
  if (BT.scene) await BT.scene.spawnReinforcement(nd, dead);
  else await sleep(300);
  retarget();
}

export async function cmd(c) {
  if (BT.busy || !BT.b || bannerOpen()) return;
  const b = BT.b, sc = BT.scene;
  lockOrders(true);

  try {
    if (c === 'retreat') {
      const crew = aliveP();
      const sp = crew.reduce((a, s) => a + s.speed, 0) / Math.max(1, crew.length);
      if (Math.random() < Math.min(0.9, 0.45 + sp * 0.04)) {
        blog('You put the helm hard over and slip away under every stitch she carries.', 'good');
        if (sc) sc.retreatAnim();
        play('sail');
        await sleep(750);
        return showBanner('escaped');
      }
      blog('The wind betrays you at exactly the wrong moment and they close the gap.', 'bad');
      await enemyPhase(false);
      return endRound();
    }

    if (c === 'barrels') {
      if (S.barrels < 1) { lockOrders(false); return; }
      S.barrels--;
      updateRes();
    }

    const brace = c === 'brace', barrel = c === 'barrels';
    if (brace && sc) sc.shieldPulse();

    if (c === 'board') {
      const t = b.enemies[b.target], thr = hasFit('grapple') ? 0.55 : 0.40;
      if (gim('ironclad')) {
        blog('The grapples clatter off iron plating and fall away into the water. There is no boarding that ship.', 'bad');
      } else if (!t || t.disabled || t.hull > t.max * thr) {
        blog(`Too much hull left to board — get her below ${Math.round(thr * 100)}% first.`, 'bad');
      } else {
        const boarder = aliveP()[0];
        await (sc ? sc.boardDash(boarder, t) : sleep(300));
        if (Math.random() < (t.hull < t.max * 0.15 ? 0.75 : 0.55)) {
          t.disabled = true;
          t.hull = Math.max(1, t.hull);
          blog(`${boarder.name}'s people go over the rail screaming and the ${t.name} strikes inside two minutes.`, 'good');
          if (sc) {
            const o = sc.find(t);
            sc.floatText(o.c.x, o.c.y - 44, 'TAKEN', '#63c06a', 24);
            sc.sink(o);
          }
          buzz('big');
          retarget();
          await maybeReinforce(t);
        } else {
          const dm = Math.round(t.guns * rnd(0.8, 1.2));
          boarder.hull = Math.max(0, boarder.hull - dm);
          blog(`They were waiting at the rail with pikes. ${boarder.name} comes away with ${dm} and fewer hands.`, 'bad');
          if (sc) {
            const o = sc.find(boarder);
            sc.impact(o.c.x, o.c.y, dm, false);
            sc.hitFlash(o);
            sc.drawHp(o);
            if (boarder.hull <= 0) sc.sink(o);
          }
        }
      }
    } else {
      /* Gunnery. Chase Guns give the flagship a second, weaker shot. */
      for (const s of aliveP()) {
        const shots = (s.id === 'FLAG' && hasFit('chase')) ? 2 : 1;
        for (let k = 0; k < shots; k++) {
          if (!aliveE().length) break;
          const slotI = b.fleet.indexOf(s);
          let t = c === 'focus' ? b.enemies[b.target] : pick(aliveE());
          if (!t || t.disabled) t = aliveE()[0];
          if (!t) break;

          const dmg = Math.round(
            s.guns * rnd(0.8, 1.2) *
            (slotI === 1 ? 1.25 : 1) *     // centre of the line hits harder
            (barrel ? 1.6 : 1) *
            (brace ? 0.5 : 1) *
            (k ? 0.6 : 1)
          );
          const hit = await (sc ? sc.fireShot(s, t, barrel) : sleep(200));
          t.hull -= dmg;
          blog(fx(pick(HIT_P), s.name, t.name, dmg) + (k ? ' The chase guns speak after her.' : ''), '');
          if (sc && hit) { sc.impact(hit.x, hit.y, dmg, barrel); sc.hitFlash(hit.o); sc.drawHp(hit.o); }
          buzz('hit');

          if (t.hull <= 0 && !t.disabled) {
            t.disabled = true;
            t.hull = 0;
            blog(fx(pick(SINK), t.name), 'good');
            if (sc) sc.sink(sc.find(t));
            buzz('big');
            retarget();
            await maybeReinforce(t);
          }
          await sleep(170);
        }
      }
    }

    if (!aliveE().length) { await sleep(500); return showBanner('win'); }
    await sleep(280);
    await enemyPhase(brace);
    endRound();
  } catch (e) {
    console.error('[battle]', e);
    endRound();
  }
}

async function enemyPhase(brace) {
  const b = BT.b, sc = BT.scene;

  /* The telegraphed boss volley lands first, before anything else fires. */
  if (b.telegraph) {
    const bs = b.enemies.find(e => e.isBoss && !e.disabled);
    b.telegraph = false;
    if (bs) {
      const ps = aliveP();
      if (ps.length) {
        const t = ps.reduce((a, s) => (power(s) > power(a) ? s : a));
        const dm = Math.round(bs.guns * 2.6 * (brace ? 0.42 : 1));
        const hit = await (sc ? sc.fireShot(bs, t, false, true) : sleep(300));
        t.hull = Math.max(0, t.hull - dm);
        if (sc) sc.flash(0xffb060);
        blog(`${bs.name} empties her lower deck in one long rolling crash — ${t.name} takes ${dm}.${brace ? ' Braced, thank God.' : ' Nothing was ready for it.'}`, 'bad');
        if (sc && hit) {
          sc.impact(hit.x, hit.y, dm, true);
          sc.hitFlash(hit.o);
          sc.drawHp(hit.o);
          if (t.hull <= 0) { sc.sink(hit.o); blog(fx(pick(CRIP), t.name), 'bad'); }
        }
        buzz('big');
        await sleep(260);
      }
    }
  }

  for (const e of aliveE()) {
    /* Escort missions: some enemies go for the merchant instead of you. */
    if (b.merchant && b.merchant.hull > 0 && Math.random() < 0.3) {
      const dm = Math.round(e.guns * rnd(0.6, 1.0));
      const hit = await (sc ? sc.fireShot(e, b.merchant, false) : sleep(200));
      b.merchant.hull = Math.max(0, b.merchant.hull - dm);
      blog(`${e.name} ignores you entirely and puts her guns on the ${b.merchant.name} — ${dm}.`, 'bad');
      if (sc && hit) {
        sc.impact(hit.x, hit.y, dm, false);
        sc.hitFlash(hit.o);
        sc.drawHp(hit.o);
        if (b.merchant.hull <= 0) {
          sc.sink(hit.o);
          blog(`The ${b.merchant.name} is going down by the bow and there is nothing to be done about it.`, 'bad');
        }
      }
      await sleep(170);
      continue;
    }

    const ps = aliveP();
    if (!ps.length) break;
    /* Mostly they pick your strongest ship, sometimes at random. */
    const t = Math.random() < 0.65 ? ps.reduce((a, s) => (power(s) > power(a) ? s : a)) : pick(ps);
    const dm = Math.round(e.guns * rnd(0.8, 1.2) * (b.fleet.indexOf(t) === 2 ? 0.75 : 1) * (brace ? 0.5 : 1));
    const hit = await (sc ? sc.fireShot(e, t, false) : sleep(200));
    t.hull = Math.max(0, t.hull - dm);
    blog(fx(pick(HIT_E), e.name, t.name, dm), 'bad');
    if (sc && hit) {
      sc.impact(hit.x, hit.y, dm, false);
      sc.hitFlash(hit.o);
      sc.drawHp(hit.o);
      if (t.hull <= 0) { sc.sink(hit.o); blog(fx(pick(CRIP), t.name), 'bad'); }
    }
    await sleep(170);
  }
}

function endRound() {
  const b = BT.b;
  b.round++;

  if (b.merchant && b.merchant.hull <= 0) {
    blog('The merchant is gone beneath the waves and your contract with her.', 'bad');
    return showBanner('loss');
  }
  if (!aliveP().length) {
    blog('Your line is shattered and what is left is not answering signals.', 'bad');
    return showBanner('loss');
  }

  if (gim('broadside') && b.round % 3 === 0 && b.enemies.some(e => e.isBoss && !e.disabled)) {
    b.telegraph = true;
    blog(`The gunports come up along ${b.boss.n}'s lower deck, one after another. Whatever comes next will not be survivable twice. BRACE.`, 'bad');
    if (BT.scene) BT.scene.telegraphFx();
  }

  lockOrders(false);
  drawHud();
}

export function endBattle(kind) {
  $('banner').classList.remove('on');
  ambience(false);
  const b = BT.b;

  wipe(() => {
    $('battleScr').classList.remove('on');
    $('battleScr').classList.remove('boss');
    teardownPhaser();

    if (kind === 'win') tutEvent('battle:end');
    else if (tutRewindToCombat()) {
      award({
        icon: 'hull', kind: 'Beaten Back', title: 'Repair and Try Again',
        text: 'Patch your hulls in Port, then take that patrol on a second time.',
        ok: 'Continue', sound: 'defeat'
      });
    }

    b.onEnd(kind === 'win', b.enemies);
    save();
    updateRes();
  });
}

action('order', d => cmd(d.order));
action('battle-continue', d => endBattle(d.kind));
