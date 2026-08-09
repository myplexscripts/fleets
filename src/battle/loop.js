/* The engagement, on a clock.

   Battles used to be turns: one order from you, then every enemy answered, then
   the round ticked over. That put the player in charge of every single
   broadside, which sounds like control and plays like paperwork — the same two
   buttons, over and over, with the interesting decisions buried among them.

   Now the guns look after themselves. Every ship on the water carries a reload
   meter that fills at her own rate, and when it fills she fires. Speed decides
   how often, guns decide how hard, hull decides how long she lasts. Nobody
   orders a broadside because a broadside is not a decision — it is what a ship
   with loaded guns does.

   What is left for the player is the part that was always interesting:

     TARGET   tap a ship and your line prefers her. Free, any time.
     BRACE    a few seconds of taking far less, paid for in your own rate of
              fire. The answer to a telegraphed volley.
     BOARD    take her intact once she is beaten down. On a cooldown.
     BARRELS  a consumable that hits like nothing else you own.
     RETREAT  because a fight you cannot win must be leavable.

   The clock stops for the end banner, and whenever the tab is not being looked
   at — coming back to a battle that resolved itself in the background would be
   the worst possible version of this. */

import { $, sleep } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { rnd, pick, fx } from '../core/rng.js';
/* `fx` here is already the log's message formatter, so the figurehead door
   comes in under its own name. */
import { power, hasFit, fx as figFx } from '../core/selectors.js';
import {
  BRACE_MS, BRACE_COOLDOWN_MS, BRACE_MULT, BRACE_RELOAD_MULT,
  BOARD_COOLDOWN_MS, VOLLEY_EVERY_MS, VOLLEY_WARN_MS
} from '../core/config.js';
import { HIT_P, HIT_E, SINK, CRIP } from '../data/flavour.js';
import { MERCHANT_NAMES } from '../data/names.js';
import { action } from '../core/actions.js';
import { updateRes } from '../ui/hud.js';
import { refreshTut, tutEvent, tutRewindToCombat } from '../ui/tutorial.js';
import { wipe } from '../fx/wipe.js';
import { play, ambience } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';
import { award } from '../fx/award.js';
import { BT, gim, aliveE, aliveP, reloadMs, primeTimers, boardable, closed } from './state.js';
import { BattleScene, phaserReady } from './scene.js';
import { blog, drawHud, showBanner, bannerOpen } from './hud.js';

let PG = null;     // the Phaser game, created once per battle and destroyed after
let raf = 0;       // the clock
let last = 0;

/* Boots a fresh Phaser game for each battle.

   It would be cheaper to keep one alive across battles, but the battle screen
   is display:none between them, so the RESIZE scale mode collapses the canvas
   to 0x0 and the renderer cannot rebuild its framebuffer at that size — the
   next battle then draws nothing. Creating the game while the host is visible,
   and destroying it on the way out, keeps that impossible.

   If Phaser is unavailable the callback still runs with PG null; every visual
   call here is guarded, so the fight resolves through the log and the meters. */
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
    fleet, enemies, onEnd, target: 0, log: [],
    merchant: escort ? { type: 'merchant', name: pick(MERCHANT_NAMES.brig), hull: 40, max: 40, speed: 3, guns: 0 } : null,
    boss: boss || null,
    reinforce: (boss && boss.reinforce) || 0,
    reinfPool: (boss && boss.reinforcements) ? boss.reinforcements.slice() : [],
    /* the clock */
    t: 0,
    timers: new Map(),
    brace: 0, braceCd: 0, boardCd: 0,
    volleyAt: 0,
    telegraph: false,
    over: false, resolving: 0
  };
  BT.busy = false;

  const b = BT.b;
  /* Set after BT.b exists — gim() reads it, and inside the literal above it
     would still have been answering about the last battle's admiral. */
  b.volleyAt = gim('broadside') ? VOLLEY_EVERY_MS : 0;
  primeTimers(fleet, true, true).forEach((v, k) => b.timers.set(k, v));
  primeTimers(enemies, true, false).forEach((v, k) => b.timers.set(k, v));

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
    startClock();
  });
}

/* Opener. Boss titles already start with "The". */
function openingLine(boss, escort) {
  if (boss) return `${boss.n} puts her helm over and comes about to meet you. ${boss.title}, in the flesh at last.`;
  if (escort) return "They came out of the haze on the convoy's blind quarter. Get between them and the merchant.";
  return 'Sails on the horizon, and not friendly ones. Beat to quarters.';
}

export const battleOpen = () => $('battleScr').classList.contains('on');

/* ---- the clock ---------------------------------------------------------- */

function startClock() {
  stopClock();
  last = performance.now();
  raf = requestAnimationFrame(tick);
}
function stopClock() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/* A battle nobody is watching does not happen. */
const paused = () => document.hidden || bannerOpen() || !battleOpen();

function tick(now) {
  raf = requestAnimationFrame(tick);
  const b = BT.b;
  if (!b || b.over) return;

  const dt = Math.min(120, now - last);       // a backgrounded tab must not lurch
  last = now;
  if (paused()) return;

  b.t += dt;
  if (b.brace > 0) b.brace -= dt;
  if (b.braceCd > 0) b.braceCd -= dt;
  if (b.boardCd > 0) b.boardCd -= dt;

  advance(b.fleet, dt, true);
  advance(b.enemies, dt, false);
  bossVolley(dt);

  drawHud();
  if (BT.scene) BT.scene.drawReloads();
  checkOver();
}

/* Fill everyone's meter, and let go anyone who is loaded. */
function advance(list, dt, mine) {
  const b = BT.b;
  /* Bracing means the crews are holding on rather than serving the guns. */
  const rate = (mine && b.brace > 0) ? BRACE_RELOAD_MULT : 1;

  list.forEach(s => {
    if (mine ? s.hull <= 0 : s.disabled) return;
    const t = b.timers.get(s);
    if (!t) return;
    t.at += (dt / t.of) * rate;
    if (t.at >= 1) {
      t.at = 0;
      closed(t, s);          // she has closed the range; normal reload from here
      fire(s, mine);
    }
  });
}

/* ---- gunnery ------------------------------------------------------------ */

/* A shot's weight. `carve` says which side of the figurehead to read, because
   the same carving is two different numbers depending on which end of the shot
   you are: 'gun' for one of yours firing, 'hull' for one landing on yours.
   Omitted means neither — an escorted merchant is not your hull, and a carving
   on your bow has no business protecting somebody else's ship. */
function damageFrom(s, mult, carve) {
  const carved = carve === 'gun' ? figFx('dmg') : carve === 'hull' ? figFx('armour') : 1;
  return Math.max(1, Math.round(s.guns * rnd(0.8, 1.2) * (mult || 1) * carved));
}

/* One ship, one broadside. Everything visual is fire-and-forget: the clock does
   not wait for an animation, or a slow frame would slow the whole battle. */
function fire(s, mine) {
  const b = BT.b, sc = BT.scene;
  if (b.over) return;

  if (mine) {
    const t = preferredTarget();
    if (!t) return;
    const slot = b.fleet.indexOf(s);
    const dmg = damageFrom(s, slot === 1 ? 1.25 : 1, 'gun');   // centre of the line hits harder
    land(s, t, dmg, false, false);

    /* Chase Guns give the flagship a second, weaker shot behind the first. */
    if (s.id === 'FLAG' && hasFit('chase')) {
      setTimeout(() => {
        if (b.over) return;
        const t2 = preferredTarget();
        if (t2) land(s, t2, damageFrom(s, 0.6, 'gun'), false, false);
      }, 260);
    }
    return;
  }

  /* Escort work: some of them go for the merchant instead of you. */
  if (b.merchant && b.merchant.hull > 0 && Math.random() < 0.3) {
    land(s, b.merchant, damageFrom(s, 0.8), true, true);
    return;
  }
  const ps = aliveP();
  if (!ps.length) return;
  /* Mostly they pick your strongest, sometimes at random. */
  const t = Math.random() < 0.65 ? ps.reduce((a, x) => (power(x) > power(a) ? x : a)) : pick(ps);
  const rear = b.fleet.indexOf(t) === 2 ? 0.75 : 1;
  land(s, t, damageFrom(s, rear * (b.brace > 0 ? BRACE_MULT : 1), 'hull'), true, false);
}

/* Put a shot into somebody, with all the noise that goes with it. */
function land(from, to, dmg, incoming, atMerchant) {
  const b = BT.b, sc = BT.scene;
  if (!to || b.over) return;
  if (!atMerchant && (incoming ? to.hull <= 0 : to.disabled)) return;

  to.hull = Math.max(0, to.hull - dmg);
  blog(fx(pick(incoming ? HIT_E : HIT_P), from.name, to.name, dmg), incoming ? 'bad' : '');
  buzz('hit');

  if (sc) {
    Promise.resolve(sc.fireShot(from, to, false)).then(hit => {
      if (!hit) return;
      sc.impact(hit.x, hit.y, dmg, false);
      sc.hitFlash(hit.o);
      sc.drawHp(hit.o);
      if ((atMerchant || incoming) ? to.hull <= 0 : to.hull <= 0) sc.sink(hit.o);
    }).catch(() => {});
  }

  if (to.hull > 0) return;

  if (atMerchant) {
    blog(`The ${to.name} is going down by the bow and there is nothing to be done about it.`, 'bad');
  } else if (incoming) {
    blog(fx(pick(CRIP), to.name), 'bad');
  } else if (!to.disabled) {
    to.disabled = true;
    blog(fx(pick(SINK), to.name), 'good');
    buzz('big');
    retarget();
    maybeReinforce(to);
  }
}

/* Who your line is shooting at: the tapped ship if she is still up, otherwise
   whoever is left. */
function preferredTarget() {
  const b = BT.b;
  const t = b.enemies[b.target];
  if (t && !t.disabled) return t;
  const next = aliveE()[0];
  if (next) {
    b.target = b.enemies.indexOf(next);
    if (BT.scene) BT.scene.setMarker(b.target);
  }
  return next || null;
}

function retarget() {
  const b = BT.b;
  if (!b.enemies[b.target] || b.enemies[b.target].disabled) preferredTarget();
}

/* Keyboard target selection. */
export function cycleTarget(dir) {
  if (!BT.b || bannerOpen()) return;
  const live = BT.b.enemies.map((e, i) => ({ e, i })).filter(x => !x.e.disabled);
  if (live.length < 2) return;
  const at = live.findIndex(x => x.i === BT.b.target);
  const next = live[(at + (dir > 0 ? 1 : live.length - 1) + live.length) % live.length];
  BT.b.target = next.i;
  if (BT.scene) BT.scene.setMarker(next.i);
  play('ui_tap');
}

function maybeReinforce(dead) {
  const b = BT.b;
  if (!gim('wolfpack') || b.reinforce <= 0) return;
  const tpl = b.reinfPool.shift();
  if (!tpl) return;
  b.reinforce--;

  const nd = { ...tpl, max: tpl.hull, disabled: false, pal: 'boss' };
  b.enemies.push(nd);
  /* She cuts out of the fog already in the fight — no run-in for a ship that
     was waiting for you. */
  b.timers.set(nd, { at: 0.1, of: reloadMs(nd, false), closing: false, mine: false });
  blog(`Another sail cuts out of the fog where there was nothing — the ${nd.name} takes her place in the line.`, 'bad');
  if (BT.scene) BT.scene.spawnReinforcement(nd, dead);
  retarget();
}

/* ---- the admiral's big one ---------------------------------------------- */

function bossVolley(dt) {
  const b = BT.b;
  if (!b.volleyAt) return;
  const bs = b.enemies.find(e => e.isBoss && !e.disabled);
  if (!bs) { b.volleyAt = 0; b.telegraph = false; return; }

  b.volleyAt -= dt;

  if (!b.telegraph && b.volleyAt <= VOLLEY_WARN_MS) {
    b.telegraph = true;
    blog(`The gunports come up along ${b.boss.n}'s lower deck, one after another. `
      + 'Whatever comes next will not be survivable twice. BRACE.', 'bad');
    if (BT.scene) BT.scene.telegraphFx();
    play('telegraph');
  }

  if (b.volleyAt > 0) return;

  b.telegraph = false;
  b.volleyAt = VOLLEY_EVERY_MS;
  const ps = aliveP();
  if (!ps.length) return;

  const t = ps.reduce((a, s) => (power(s) > power(a) ? s : a));
  const braced = b.brace > 0;
  const dm = Math.round(bs.guns * 2.6 * (braced ? 0.42 : 1));
  t.hull = Math.max(0, t.hull - dm);
  if (BT.scene) BT.scene.flash(0xffb060);
  blog(`${bs.name} empties her lower deck in one long rolling crash — ${t.name} takes ${dm}.`
    + (braced ? ' Braced, thank God.' : ' Nothing was ready for it.'), 'bad');
  buzz('big');

  if (BT.scene) {
    Promise.resolve(BT.scene.fireShot(bs, t, false, true)).then(hit => {
      if (!hit) return;
      BT.scene.impact(hit.x, hit.y, dm, true);
      BT.scene.hitFlash(hit.o);
      BT.scene.drawHp(hit.o);
      if (t.hull <= 0) BT.scene.sink(hit.o);
    }).catch(() => {});
  }
  if (t.hull <= 0) blog(fx(pick(CRIP), t.name), 'bad');
}

/* ---- what the player actually does -------------------------------------- */

export function cmd(c) {
  const b = BT.b;
  if (!b || b.over || bannerOpen()) return;
  const sc = BT.scene;

  if (c === 'brace') {
    if (b.braceCd > 0) return;
    b.brace = BRACE_MS;
    b.braceCd = BRACE_MS + BRACE_COOLDOWN_MS;
    if (sc) sc.shieldPulse();
    play('board');
    blog('Every hand grabs something solid and the gunports come down.', 'good');
    drawHud();
    return;
  }

  if (c === 'barrels') {
    if (S.barrels < 1) return;
    S.barrels--;
    updateRes();
    const t = preferredTarget();
    const from = aliveP()[0];
    if (t && from) {
      const dmg = damageFrom(from, 2.4, 'gun');
      t.hull = Math.max(0, t.hull - dmg);
      blog(`A barrel goes over in a lazy arc and bursts across the ${t.name}'s deck — ${dmg}.`, 'good');
      buzz('big');
      if (sc) {
        Promise.resolve(sc.fireShot(from, t, true)).then(hit => {
          if (!hit) return;
          sc.impact(hit.x, hit.y, dmg, true);
          sc.hitFlash(hit.o);
          sc.drawHp(hit.o);
          if (t.hull <= 0) sc.sink(hit.o);
        }).catch(() => {});
      }
      if (t.hull <= 0 && !t.disabled) {
        t.disabled = true;
        blog(fx(pick(SINK), t.name), 'good');
        retarget();
        maybeReinforce(t);
      }
    }
    drawHud();
    return;
  }

  if (c === 'board') return doBoard();
  if (c === 'retreat') return doRetreat();
}

function doBoard() {
  const b = BT.b, sc = BT.scene;
  const t = boardable(hasFit('grapple'));
  if (!t) {
    if (gim('ironclad')) {
      blog('The grapples clatter off iron plating and fall away into the water. There is no boarding that ship.', 'bad');
    } else if (b.boardCd > 0) {
      blog('The boarding party is still sorting itself out.', 'bad');
    } else {
      const thr = hasFit('grapple') ? 55 : 40;
      blog(`Too much hull left to board — get her below ${thr}% first.`, 'bad');
    }
    return;
  }

  b.boardCd = BOARD_COOLDOWN_MS;
  const boarder = aliveP()[0];
  if (sc) sc.boardDash(boarder, t);
  play('board');

  if (Math.random() < (t.hull < t.max * 0.15 ? 0.75 : 0.55)) {
    t.disabled = true;
    t.hull = Math.max(1, t.hull);
    blog(`${boarder.name}'s people go over the rail screaming and the ${t.name} strikes inside two minutes.`, 'good');
    if (sc) {
      const o = sc.find(t);
      if (o) { sc.floatText(o.c.x, o.c.y - 44, 'TAKEN', '#63c06a', 24); sc.sink(o); }
    }
    buzz('big');
    retarget();
    maybeReinforce(t);
  } else {
    const dm = Math.round(t.guns * rnd(0.8, 1.2));
    boarder.hull = Math.max(0, boarder.hull - dm);
    blog(`They were waiting at the rail with pikes. ${boarder.name} comes away with ${dm} and fewer hands.`, 'bad');
    if (sc) {
      const o = sc.find(boarder);
      if (o) { sc.impact(o.c.x, o.c.y, dm, false); sc.hitFlash(o); sc.drawHp(o); if (boarder.hull <= 0) sc.sink(o); }
    }
  }
  drawHud();
}

async function doRetreat() {
  const b = BT.b, sc = BT.scene;
  const crew = aliveP();
  const sp = crew.reduce((a, s) => a + s.speed, 0) / Math.max(1, crew.length);
  if (Math.random() < Math.min(0.9, 0.45 + sp * 0.04)) {
    b.over = true;
    blog('You put the helm hard over and slip away under every stitch she carries.', 'good');
    if (sc) sc.retreatAnim();
    play('sail');
    await sleep(700);
    return showBanner('escaped');
  }
  blog('The wind betrays you at exactly the wrong moment and they close the gap.', 'bad');
}

/* ---- the end ------------------------------------------------------------ */

function checkOver() {
  const b = BT.b;
  if (b.over) return;

  if (b.merchant && b.merchant.hull <= 0) {
    b.over = true;
    blog('The merchant is gone beneath the waves and your contract with her.', 'bad');
    return showBanner('loss');
  }
  if (!aliveE().length) {
    b.over = true;
    setTimeout(() => showBanner('win'), 420);
    return;
  }
  if (!aliveP().length) {
    b.over = true;
    blog('Your line is shattered and what is left is not answering signals.', 'bad');
    return showBanner('loss');
  }
}

export function endBattle(kind) {
  stopClock();
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
