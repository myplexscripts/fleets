/* The after-action report.

   Its own full screen, not a drawer. What you won is the point of it, so the
   haul is the biggest thing on it — a strongbox of chips at the top, before any
   words. The account of what happened is one line underneath, because you were
   there.

   A prize is a decision, not a payout, and every option pays exactly one kind
   of thing, so the decision is never a sum:

     Keep      the hull, and nothing else. She takes a dock and needs repairing.
     Scuttle   supplies, and no coin.
     Ransom    coin, and no supplies.
     Chest     coin, more of it, and only off ships that were worth beating.

   There is no walking away. Declining all four was strictly worse than any one
   of them, which makes it not a choice but a mistake with a button on it.

   The screen will not close until every prize has been answered for — deciding
   is the reward.

   It runs as a sequence rather than a page. Every prize used to be stacked down
   one long scroll, which turned three captures into a wall of near-identical
   cards to scroll through and answer in the wrong order — the decisions were
   fine and the shape around them was a form to fill in. Now:

     1. the haul, and what happened
     2. each prize on its own, one card at a time, counted "2 of 3"
     3. the account: the total, climbing, and the wanted bar moving

   Same decisions, one at a time, and a payoff at the end that is worth getting
   to. */

import { $, qsa, esc, reflow } from '../core/dom.js';
import { S, save, newShip } from '../core/state.js';
import { actions } from '../core/actions.js';
import { render } from '../core/bus.js';
import { rnd } from '../core/rng.js';
import { grant, wantedOf } from '../core/selectors.js';
import { TYPES } from '../data/ships.js';
import { SCRAP_YIELD, MAT_KEYS } from '../data/materials.js';
import { GOODS } from '../data/goods.js';
import { REGIONS } from '../data/world.js';
import { BOSSES } from '../data/bosses.js';
import { shipHTML } from '../art/ships.js';
import { iconHTML } from '../art/icons.js';
import { tile, tileRow, bagTiles, matName } from './format.js';
import { updateRes } from './hud.js';
import { coinFly } from '../fx/coins.js';
import { play } from '../fx/sound.js';
import { deny } from '../fx/pop.js';
import { tutEvent, refreshTut } from './tutorial.js';

/* ---- the account ----

   Everything a battle put in your hands, in one place, once.

   It used to be in three: a reward row on the victory banner (the barrel, the
   admiral's title), a strongbox at the top of the report (the coin and the
   materials), a modal of its own for a collectible, and then the prizes paying
   out one at a time underneath. Four places, three of which you had to dismiss
   to reach the next, and none of which was the total.

   Now the fight is a verdict, the prizes are decisions, and everything either
   one produced arrives together on one screen at the end. Anything found before
   the report opens — the banner's barrel, a piece off a beaten hull — is parked
   in `carried` and swept in when it does. */
let ledger = null;
let tallyShown = false;
let carried = null;

function newLedger() {
  return {
    gold: 0, wood: 0, metal: 0, cloth: 0,
    goods: {}, ships: [], barrels: 0, titles: [], pieces: []
  };
}

/* Handed over by the battle before the report exists. Kept until showResult
   sweeps it up, so nothing found at the end of a fight is lost between the
   banner closing and the account opening. */
export function carry(o) {
  carried = carried || { barrels: 0, titles: [], pieces: [] };
  if (o.barrels) carried.barrels += o.barrels;
  if (o.title) carried.titles.push(o.title);
  if (o.piece) carried.pieces.push(o.piece);
}

function logBag(o) {
  if (!o) return;
  ['gold', 'wood', 'metal', 'cloth'].forEach(k => { if (o[k]) ledger[k] += o[k]; });
}
function logGoods(g) {
  if (!g || !g.n) return;
  ledger.goods[g.good] = (ledger.goods[g.good] || 0) + g.n;
}

/* Numbers arrive by counting up rather than simply being there. A total that
   was always on screen is a receipt; one that climbs is a haul. */
function countUp(el, to, ms) {
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* One thing you came away with. Glyph on top, what it is under that, how much
   at the foot — a column, so a dozen of them tile across a phone where a dozen
   full-width rows would be a scroll. */
function tcard(i, art, name, value, cls) {
  const num = typeof value === 'number'
    ? `<b class="tn" data-to="${value}">0</b>`
    : `<b class="tn word">${esc(value)}</b>`;
  return `<div class="tcard ${cls || ''}" style="--i:${i}">
    <div class="tart">${art}</div><span class="tname">${esc(name)}</span>${num}</div>`;
}

function drawTally(title, sub, lines) {
  const cards = [];
  let i = 0;
  const push = (art, name, value, cls) => cards.push(tcard(i++, art, name, value, cls));
  const glyph = k => iconHTML(k, 0, 'tallyic');

  if (ledger.gold) push(glyph('gold'), 'Gold', ledger.gold);
  MAT_KEYS.forEach(m => { if (ledger[m]) push(glyph(m), matName(m), ledger[m]); });
  Object.keys(ledger.goods).forEach(g =>
    push(glyph(g), GOODS[g] ? GOODS[g].n : g, ledger.goods[g]));
  /* Powder and shot for the barrels: a victory is worth one, and it used to be
     announced on the banner and then never mentioned again. */
  if (ledger.barrels) push(glyph('barrels'), 'Fire Barrels', ledger.barrels);

  /* A hull is not a quantity, so her name goes where the number would be. */
  ledger.ships.forEach(sh =>
    push(shipHTML(sh.type, 'player', 0.6), TYPES[sh.type].n, sh.name, 'ship'));

  /* Off a beaten hull, for the great cabin. This used to stop the game with a
     modal of its own seven hundred milliseconds after the banner. */
  ledger.pieces.forEach(p => push(glyph('relic'), p.name,
    p.of ? `${p.have}/${p.of}` : 'Oddment', 'relic' + (p.complete ? ' setdone' : '')));

  /* And what beating an admiral makes you. */
  ledger.titles.forEach(t => push(glyph('star'), 'Title Earned', t, 'title'));

  $('rHead').innerHTML = `<div class="rverdict ${cards.length ? 'good' : 'bad'}">${esc(title)}</div>
    <div class="rwhere">${esc(sub)}</div>`;
  $('rBody').innerHTML =
    ((lines && lines.length) ? `<div class="rlines">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : '')
    + (cards.length ? `<div class="tally">${cards.join('')}</div>`
      : '<div class="sub center tallynone">Nothing came of it but the wear on your hulls.</div>')
    + wantedMeter();
  $('rBody').scrollTop = 0;
  $('rFoot').innerHTML = `<button class="btn gold wide" data-act="close-result">Continue</button>`;

  /* Each card pops as it lands and its figure starts climbing with it, so the
     screen fills rather than appearing already finished. The stagger is short
     because there can be a dozen of these — long enough to read as a sequence,
     not so long that the last one is still arriving after a thumb has moved. */
  qsa('#rBody .tn[data-to]').forEach((el, n) => {
    const to = +el.dataset.to || 0;
    setTimeout(() => { countUp(el, to, 480); play('coin'); }, 200 + n * 90);
  });

  /* And then the bar moves, last, after the money has finished counting — it is
     the consequence of the haul rather than part of it. */
  const fill = $('rWanted');
  if (fill) {
    setTimeout(() => {
      fill.style.width = fill.dataset.to;
      if (fill.dataset.ready) {
        setTimeout(() => {
          const w = fill.closest('.wmeter');
          if (w) w.classList.add('ready');
          play('boss_horn');
        }, 900);
      }
    }, 320 + i * 90);
  }
}

/* How badly you are wanted in this water, before and after.

   The same shape as the fill on the region card, so the thing that just moved
   here is recognisably the thing that will be moved when the chart comes back —
   and it moves ON this screen, from where it was to where it is, rather than
   simply being drawn at its new value. */
function wantedMeter() {
  const b = BOSSES[wantedRegion];
  if (!b || !b.noto || S.bossBeaten[wantedRegion]) return '';
  const need = b.noto;
  const now_ = Math.min(wantedOf(wantedRegion), need);
  const was = Math.min(wantedWas, need);
  if (now_ === was) return '';

  const pct = n => Math.round(n / need * 100) + '%';
  const up = now_ > was;
  const ready = now_ >= need;

  return `<div class="wmeter" style="--i:0">
    <div class="wmlbl">
      <span>${esc(REGIONS[wantedRegion].n)} — wanted</span>
      <b class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(now_ - was)}</b>
    </div>
    <div class="wmbar"><i id="rWanted" style="width:${pct(was)}"
      data-to="${pct(now_)}"${ready ? ' data-ready="1"' : ''}></i></div>
    <div class="wmfoot">${ready
      ? `${esc(b.n)} has had enough of you. She is out there now.`
      : `${need - now_} more and ${esc(b.n)} comes looking for you.`}</div>
  </div>`;
}

/* A captain's strongbox, as a multiple of what her crew would have fetched.
   Only ships that outclassed their water carry one, so it is the payoff for
   taking the fight you were allowed to walk away from. */
const CHEST_MULT = 2.2;
const chestValue = t => Math.round(t.ransom * CHEST_MULT);

/* The prizes still to be answered for, and where in that queue we are. The
   screen is a sequence now, so it has to remember its own place. */
let queue = [];
let atPrize = 0;
let pending = 0;
/* The wanted level before this fight, so the account can show it move. */
let wantedWas = 0;
let wantedRegion = '';
/* What the account will be headed with, held from showResult until the last
   prize has been answered for. */
let tallyLines = [];
let tallyTitle = '';
let tallyWhere = '';

export function showResult({ route, success, msg, captives = [], evt = '', noto = 0, prizeMsg = '', extra = null, spoils = null, holds = null, fromVoyage = false }) {
  const paid = { ...(route.rew || {}) };
  if (extra) for (const k in extra) paid[k] = (paid[k] || 0) + extra[k];
  const isBoss = route.type === 'boss', isCh = route.type === 'charter';
  const title = success
    ? (isBoss ? 'Admiral Defeated' : (isCh ? 'Charter Fulfilled' : (fromVoyage ? 'Ships Returned' : 'The Water Is Yours')))
    : (isBoss ? 'Repulsed' : (fromVoyage ? 'Run Lost' : 'Battle Lost'));

  /* Everything this fight earns is written down as it is handed over, so the
     account at the end is a total rather than a guess. */
  ledger = newLedger();
  tallyShown = false;
  /* Read before anything is granted: `noto` has already been added to the save
     by the time we are called, so "before" is where it stands minus the gain. */
  wantedRegion = route.region;
  wantedWas = Math.max(0, wantedOf(route.region) - (noto || 0));
  if (success) {
    logBag(paid);
    if (spoils && spoils.mats) logBag(spoils.mats);
    if (spoils && spoils.goods) logGoods(spoils.goods);
    (holds || []).forEach(logGoods);
  }

  /* Anything the fight handed over before this screen existed — the barrel a
     victory is worth, a piece off a beaten hull, an admiral's title. */
  if (carried) {
    ledger.barrels += carried.barrels;
    ledger.titles = ledger.titles.concat(carried.titles);
    ledger.pieces = ledger.pieces.concat(carried.pieces);
    carried = null;
  }

  const lines = [msg, prizeMsg, evt].filter(Boolean);
  queue = captives.slice();
  atPrize = 0;
  pending = captives.length;
  tallyLines = lines;
  tallyTitle = title;
  tallyWhere = route.n;

  /* With nothing to decide there is nothing to report: the account IS the
     report, and putting a screen in front of it that only says what the account
     is about to say is a tap for no reason. Straight there. */
  if (!pending) {
    tallyShown = true;
    drawTally(title, route.n, lines);
    openResult();
  } else {
    $('rHead').innerHTML = `<div class="rverdict ${success ? 'good' : 'bad'}">${esc(title)}</div>
      <div class="rwhere">${esc(route.n)}</div>`;
    /* Only the decisions live here. What the fight was worth — the coin, the
       materials, the holds — is not shown twice; it is all on the account. */
    $('rBody').innerHTML = '<div id="prizeSlot"></div>';
    $('rBody').scrollTop = 0;
    nextPrize();
    drawFoot();
    openResult();
  }

  if (success && paid.gold) {
    setTimeout(() => coinFly(Math.min(12, Math.ceil(paid.gold / 200))), 420);
  }
  save();
  updateRes();
  refreshTut();
}

/* ---- the prizes, one at a time ----

   Each captured hull gets the whole slot to herself. Her four numbers sit on a
   fixed four-column grid and every choice below repeats that grid, so what
   keeping her costs and what scuttling her yields line up column for column and
   can be read against each other without counting.

   Her numbers are stock numbers for her class, not the ones she was fighting
   with. You took a hull; her guns and her people went to the bottom with the
   people who were using them. */
function nextPrize() {
  const slot = $('prizeSlot');
  if (!slot) return;
  const e = queue[atPrize];
  if (!e) { slot.innerHTML = ''; return; }

  const t = TYPES[e.type], full = S.ships.length >= S.docks;
  const i = atPrize;
  const many = queue.length > 1;

  slot.innerHTML = `<div class="sect" style="--i:1">Prizes of War</div>
    <div class="sub center prizehint" id="prizeHint">
      ${many ? `<b class="prizecount">${i + 1} of ${queue.length}</b> — ` : ''}Decide what becomes of her.
    </div>
    <div class="card prizecard${e.chest ? ' chesty' : ''}" style="--i:2" id="cap${i}">
      <div class="prizehead">
        <div class="prizeart">${shipHTML(e.type, e.pal === 'boss' ? 'boss' : 'enemy', 0.85)}</div>
        <h3>${e.derelict ? 'Derelict' : 'Captured'} ${t.n}</h3>
        ${e.chest ? '<span class="tag gold">STRONGBOX</span>' : ''}
      </div>
      ${tileRow([
        tile('speed', t.speed, 'dim', 'Speed'),
        tile('guns', t.guns, 'dim', 'Guns'),
        tile('hull', t.hull, 'dim', 'Hull'),
        tile('cargo', t.cargo, 'dim', 'Cargo space')
      ], 'grid4')}
      <div class="sub"></div>
      <div class="prizeopts">
        ${prizeOpt(tileRow([tile('crew', (S.docks - S.ships.length), full ? 'bad' : 'ok', 'Docks free')], 'grid4'),
          'Keep', i, 'capture', e.type, full, 'gold')}
        ${prizeOpt(tileRow([bagTiles(SCRAP_YIELD[e.type], 'gold')], 'grid4'),
          'Scuttle', i, 'salvage', e.type)}
        ${e.derelict ? '' : prizeOpt(tileRow([tile('gold', t.ransom, 'gold', 'Ransom for her crew')], 'grid4'),
          'Ransom', i, 'ransom', e.type)}
        ${e.chest ? prizeOpt(tileRow([tile('chest', chestValue(t), 'gold', "The captain's own strongbox")], 'grid4'),
          "Captain's Chest", i, 'chest', e.type, false, 'gold') : ''}
      </div></div>`;
  refreshTut();
}

/* One prize choice: what you get on the left, the button that takes it right —
   the same invariant as every item card in the game. */
function prizeOpt(gets, label, i, mode, type, disabled, cls) {
  return `<div class="prizeopt"><div class="prizegets">${gets}</div>`
    + `<button class="btn sm ${cls || ''} itemact"${disabled ? ' disabled' : ''}`
    + ` data-act="cap" data-i="${i}" data-mode="${mode}" data-type="${type}">${label}</button></div>`;
}

function drawFoot() {
  $('rFoot').innerHTML = pending
    ? `<button class="btn wide" disabled>${pending} prize${pending === 1 ? '' : 's'} undecided</button>`
    : `<button class="btn gold wide" data-act="close-result">Continue</button>`;
}

/* ---- the screen itself ---- */
function openResult() {
  const el = $('resultScr');
  el.classList.add('on');
  reflow(el);
  el.classList.add('vis');
}

export const resultOpen = () => $('resultScr').classList.contains('on');

export function closeResult() {
  const el = $('resultScr');
  if (!el.classList.contains('on')) return;
  if (pending) return;                     // decisions first

  /* The account, on the way out. Reached from the prize sequence — a fight with
     nothing to decide went straight there and has already shown it. */
  if (!tallyShown) {
    tallyShown = true;
    play('victory');
    drawTally(tallyTitle, tallyWhere, tallyLines);
    return;
  }

  el.classList.remove('vis');
  setTimeout(() => el.classList.remove('on'), 320);
  tutEvent('sheet:close');
  render();
}

function capAct(i, mode, type) {
  const t = TYPES[type], el = $('cap' + i);
  if (!el) return;

  if (mode === 'capture') {
    if (S.ships.length >= S.docks) return deny('Every dock is full');
    const taken = newShip(type, rnd(0.25, 0.45));
    S.ships.push(taken);
    ledger.ships.push(taken);
  } else if (mode === 'salvage') {
    grant(SCRAP_YIELD[type]);
    logBag(SCRAP_YIELD[type]);
    play('repair');
  } else if (mode === 'ransom') {
    S.gold += t.ransom;
    logBag({ gold: t.ransom });
    coinFly(6);
    play('coin');
  } else if (mode === 'chest') {
    const box = chestValue(t);
    S.gold += box;
    logBag({ gold: box });
    coinFly(10);
    play('coin');
  }

  pending = Math.max(0, pending - 1);
  atPrize++;
  drawFoot();

  updateRes();
  save();
  tutEvent('prize');

  /* Straight on to the next one. A decided hull used to hold for the best part
     of a second, saying what became of her, before sliding out — which is a
     sentence nobody reads twice and a wait on every single tap. What became of
     her is on the account at the end anyway, itemised, so the card's whole job
     ends the moment it is answered. It leaves at once. */
  el.classList.add('gone');
  setTimeout(() => {
    if (!$('cap' + i)) return;              // screen closed under us
    if (queue[atPrize]) { nextPrize(); $('rBody').scrollTop = 0; }
    else {
      const slot = $('prizeSlot');
      if (slot) slot.innerHTML = '';
    }
  }, 190);
}

actions({
  cap: d => capAct(+d.i, d.mode, d.type),
  'close-result': closeResult
});
