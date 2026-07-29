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

   Everything a battle put in your hands, counted once at the end.

   The report itself is spread across time on purpose — the haul is at the top,
   the prizes are decided one at a time underneath it, and each decision pays
   out the moment it is made. That is right for deciding, and useless for
   knowing what the fight was worth: by the time the last prize is settled the
   first one is off the top of the screen.

   So everything is written down as it happens, and the total gets a screen of
   its own on the way out. */
let ledger = null;
let tallyShown = false;

function newLedger() {
  return { gold: 0, wood: 0, metal: 0, cloth: 0, goods: {}, ships: [], chests: 0 };
}

function logBag(o) {
  if (!o) return;
  ['gold', 'wood', 'metal', 'cloth'].forEach(k => { if (o[k]) ledger[k] += o[k]; });
}
function logGoods(g) {
  if (!g || !g.n) return;
  ledger.goods[g.good] = (ledger.goods[g.good] || 0) + g.n;
}

const ledgerEmpty = () => !ledger || (!ledger.gold && !ledger.wood && !ledger.metal
  && !ledger.cloth && !Object.keys(ledger.goods).length && !ledger.ships.length);

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

function drawTally() {
  const rows = [];
  let i = 0;
  const push = (icon, n, label) => rows.push(
    `<div class="tallyrow" style="--i:${i++}">${iconHTML(icon, 0, 'tallyic')}`
    + `<b class="tallyn" data-to="${n}">0</b><span>${esc(label)}</span></div>`);

  if (ledger.gold) push('gold', ledger.gold, 'Gold');
  MAT_KEYS.forEach(m => { if (ledger[m]) push(m, ledger[m], matName(m)); });
  Object.keys(ledger.goods).forEach(g => push(g, ledger.goods[g], GOODS[g] ? GOODS[g].n : g));
  /* A hull is not a quantity, so it gets her name where a number would be and
     her class where the label goes. */
  ledger.ships.forEach(sh => rows.push(
    `<div class="tallyrow ship" style="--i:${i++}">${shipHTML(sh.type, 'player', 0.55)}`
    + `<b class="tallyname">${esc(sh.name)}</b><span>${esc(TYPES[sh.type].n)}</span></div>`));

  $('rHead').innerHTML = `<div class="rverdict good">The Account</div>
    <div class="rwhere">What the fight was worth</div>`;
  $('rBody').innerHTML = `<div class="tally">${rows.join('')}</div>${wantedMeter()}`;
  $('rBody').scrollTop = 0;
  $('rFoot').innerHTML = `<button class="btn gold wide" data-act="close-result">Continue</button>`;

  /* Each figure starts its climb as its row lands, so the screen fills rather
     than appearing already finished. */
  qsa('#rBody .tallyn').forEach((el, n) => {
    const to = +el.dataset.to || 0;
    setTimeout(() => { countUp(el, to, 520); play('coin'); }, 220 + n * 130);
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
    }, 260 + i * 130);
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

  /* ---- head: the verdict, and where it happened ---- */
  $('rHead').innerHTML = `<div class="rverdict ${success ? 'good' : 'bad'}">${title}</div>
    <div class="rwhere">${esc(route.n)}</div>`;

  /* ---- body: the haul first, everything else after ---- */
  let h = strongbox(paid, spoils, holds);

  const lines = [msg, prizeMsg, evt].filter(Boolean);
  if (lines.length) {
    h += `<div class="rlines">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>`;
  }
  /* How wanted this made you is not mentioned here. It used to be a chip
     reading "34/100" in the middle of the report, which is both the scale the
     rest of the game stopped showing and a number nobody can do anything with
     at that moment. It has a bar on the account at the end instead, where it
     moves from where it was to where it is.

     The prizes are not built here either — they come up one at a time on the
     way out, each replacing the last. See nextPrize(). */
  h += '<div id="prizeSlot"></div>';

  $('rBody').innerHTML = h;
  $('rBody').scrollTop = 0;

  queue = captives.slice();
  atPrize = 0;
  pending = captives.length;
  if (pending) nextPrize();
  drawFoot();
  openResult();

  if (success && paid.gold) {
    setTimeout(() => coinFly(Math.min(12, Math.ceil(paid.gold / 200))), 420);
  }
  save();
  updateRes();
  refreshTut();
}

/* The haul, big, before any prose, and on one line whatever it holds.

   Tiles rather than chips: the glyph sits over the number, so six kinds of
   winnings fit across a phone at 40px a glyph where six chips would wrap. The
   contract money and the materials off the enemy are the same metal, so they
   are added rather than listed twice. */
function strongbox(paid, sp, holds) {
  const bag = { ...paid };
  if (sp && sp.mats) MAT_KEYS.forEach(m => { if (sp.mats[m]) bag[m] = (bag[m] || 0) + sp.mats[m]; });

  const won = [bagTiles(bag, 'gold')];
  if (sp && sp.goods && sp.goods.n) won.push(tile(sp.goods.good, sp.goods.n, 'gold', sp.goods.name));
  /* A convoy's holds are the point of taking one, so they sit in the strongbox
     with everything else rather than being mentioned in the prose. */
  (holds || []).forEach(g => won.push(tile(g.good, g.n, 'gold', g.name)));

  const inner = tileRow(won);
  if (!inner) return '';
  return `<div class="strongbox"><div class="sboxlbl">Taken</div>${inner}</div>`;
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

  /* One more screen on the way out: the total. It only appears when there is
     something to say — a lost battle that earned nothing and moved nothing
     closes straight away rather than showing an empty ledger. A fight that paid
     nothing but stirred the water still has the wanted bar to show. */
  if (!tallyShown && (!ledgerEmpty() || wantedMeter())) {
    tallyShown = true;
    play('victory');
    drawTally();
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
  const sub = el.querySelector('.sub');

  if (mode === 'capture') {
    if (S.ships.length >= S.docks) return deny('Every dock is full');
    const taken = newShip(type, rnd(0.25, 0.45));
    S.ships.push(taken);
    ledger.ships.push(taken);
    sub.textContent = 'Yours, damaged. Repair her in Port.';
  } else if (mode === 'salvage') {
    grant(SCRAP_YIELD[type]);
    logBag(SCRAP_YIELD[type]);
    play('repair');
    sub.textContent = 'Broken up for timber, iron and canvas.';
  } else if (mode === 'ransom') {
    S.gold += t.ransom;
    logBag({ gold: t.ransom });
    coinFly(6);
    play('coin');
    sub.textContent = 'Her crew ransomed. The hull goes to the bottom.';
  } else if (mode === 'chest') {
    const box = chestValue(t);
    S.gold += box;
    logBag({ gold: box });
    coinFly(10);
    play('coin');
    sub.textContent = 'Her strongbox came up off the cabin sole.';
  }

  const opts = el.querySelector('.prizeopts');
  if (opts) opts.remove();
  el.classList.add('decided');

  pending = Math.max(0, pending - 1);
  atPrize++;
  drawFoot();

  updateRes();
  save();
  tutEvent('prize');

  /* Let the decision land — the card says what became of her and settles — and
     then bring the next one up. Swapping instantly would make three prizes feel
     like one card flickering. */
  const wait = queue[atPrize] ? 900 : 620;
  setTimeout(() => {
    if (!$('cap' + i)) return;              // screen closed under us
    el.classList.add('gone');
    setTimeout(() => {
      if (queue[atPrize]) { nextPrize(); $('rBody').scrollTop = 0; }
      else {
        const slot = $('prizeSlot');
        if (slot) slot.innerHTML = '';
      }
    }, 260);
  }, wait);
}

actions({
  cap: d => capAct(+d.i, d.mode, d.type),
  'close-result': closeResult
});
