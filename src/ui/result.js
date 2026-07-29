/* The after-action report.

   Its own full screen, not a drawer. What you won is the point of it, so the
   haul is the biggest thing on it — a strongbox of chips at the top, before any
   words. The account of what happened is one line underneath, because you were
   there.

   A prize is a decision, not a payout, and every option pays exactly one kind
   of thing, so the decision is never a sum:

     Keep      the hull, and nothing else. She takes a berth and needs repairing.
     Scuttle   supplies, and no coin.
     Ransom    coin, and no supplies.
     Chest     coin, more of it, and only off ships that were worth beating.

   There is no walking away. Declining all four was strictly worse than any one
   of them, which makes it not a choice but a mistake with a button on it.

   The screen will not close until every prize has been answered for — deciding
   is the reward. */

import { $, esc, reflow } from '../core/dom.js';
import { S, save, newShip } from '../core/state.js';
import { actions } from '../core/actions.js';
import { render } from '../core/bus.js';
import { rnd } from '../core/rng.js';
import { grant, wantedOf } from '../core/selectors.js';
import { TYPES } from '../data/ships.js';
import { SCRAP_YIELD, MAT_KEYS } from '../data/materials.js';
import { REGIONS } from '../data/world.js';
import { BOSSES } from '../data/bosses.js';
import { shipHTML } from '../art/ships.js';
import { chip, have, chipRow, outOf, tile, tileRow, bagTiles } from './format.js';
import { updateRes } from './hud.js';
import { coinFly } from '../fx/coins.js';
import { play } from '../fx/sound.js';
import { deny } from '../fx/pop.js';
import { tutEvent, refreshTut } from './tutorial.js';

/* A captain's strongbox, as a multiple of what her crew would have fetched.
   Only ships that outclassed their water carry one, so it is the payoff for
   taking the fight you were allowed to walk away from. */
const CHEST_MULT = 2.2;
const chestValue = t => Math.round(t.ransom * CHEST_MULT);

/* Prizes still waiting on a decision. */
let pending = 0;

export function showResult({ route, success, msg, captives = [], evt = '', noto = 0, prizeMsg = '', extra = null, spoils = null, fromVoyage = false }) {
  const paid = { ...(route.rew || {}) };
  if (extra) for (const k in extra) paid[k] = (paid[k] || 0) + extra[k];
  const isBoss = route.type === 'boss', isCh = route.type === 'charter';
  const title = success
    ? (isBoss ? 'Admiral Defeated' : (isCh ? 'Charter Fulfilled' : (fromVoyage ? 'Ships Returned' : 'The Water Is Yours')))
    : (isBoss ? 'Repulsed' : (fromVoyage ? 'Run Lost' : 'Battle Lost'));

  /* ---- head: the verdict, and where it happened ---- */
  $('rHead').innerHTML = `<div class="rverdict ${success ? 'good' : 'bad'}">${title}</div>
    <div class="rwhere">${esc(route.n)}</div>`;

  /* ---- body: the haul first, everything else after ---- */
  let h = strongbox(paid, spoils);

  const lines = [msg, prizeMsg, evt].filter(Boolean);
  if (lines.length) {
    h += `<div class="rlines">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>`;
  }
  h += notoRow(route, noto);

  if (captives.length) {
    h += `<div class="sect" style="--i:1">Prizes of War</div>
      <div class="sub center prizehint" id="prizeHint">${captives.length === 1
        ? 'Decide what becomes of her.' : 'Decide what becomes of each of them.'}</div>`;
    /* Every prize card is laid out identically — her four numbers on a fixed
       four-column grid, then one row per choice with the winnings on the same
       grid again. Two cards side by side line up column for column, so the
       cost of keeping one and the yield of scuttling the other can be read
       against each other without counting. */
    captives.forEach((e, i) => {
      const t = TYPES[e.type], full = S.ships.length >= S.docks;
      /* Her numbers here are stock numbers for her class, not the ones she was
         fighting with. You took a hull; her guns and her people went to the
         bottom with the ones who were using them. */
      h += `<div class="card prizecard${e.chest ? ' chesty' : ''}" style="--i:${i + 2}" id="cap${i}">
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
          ${prizeOpt(tileRow([tile('crew', (S.docks - S.ships.length), full ? 'bad' : 'ok', 'Berths free')], 'grid4'),
            'Keep', i, 'capture', e.type, full, 'gold')}
          ${prizeOpt(tileRow([bagTiles(SCRAP_YIELD[e.type], 'gold')], 'grid4'),
            'Scuttle', i, 'salvage', e.type)}
          ${e.derelict ? '' : prizeOpt(tileRow([tile('gold', t.ransom, 'gold', 'Ransom for her crew')], 'grid4'),
            'Ransom', i, 'ransom', e.type)}
          ${e.chest ? prizeOpt(tileRow([tile('chest', chestValue(t), 'gold', "The captain's own strongbox")], 'grid4'),
            "Captain's Chest", i, 'chest', e.type, false, 'gold') : ''}
        </div></div>`;
    });
  }
  $('rBody').innerHTML = h;
  $('rBody').scrollTop = 0;

  pending = captives.length;
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
function strongbox(paid, sp) {
  const bag = { ...paid };
  if (sp && sp.mats) MAT_KEYS.forEach(m => { if (sp.mats[m]) bag[m] = (bag[m] || 0) + sp.mats[m]; });

  const won = [bagTiles(bag, 'gold')];
  if (sp && sp.goods && sp.goods.n) won.push(tile(sp.goods.good, sp.goods.n, 'gold', sp.goods.name));

  const inner = tileRow(won);
  if (!inner) return '';
  return `<div class="strongbox"><div class="sboxlbl">Taken</div>${inner}</div>`;
}

/* Notoriety as a bar reading: what this added, and where the region stands. */
function notoRow(route, noto) {
  if (!noto) return '';
  const need = BOSSES[route.region] ? BOSSES[route.region].noto : 0;
  const cur = wantedOf(route.region);
  return `<div class="spoils"><span class="spoilslbl">${esc(REGIONS[route.region].n)}</span>${chipRow([
    chip('noto', '+' + noto, 'ok', 'Gained'),
    need ? have('noto', cur, need, 'Notoriety toward the admiral') : ''
  ], 'tight')}</div>`;
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
    if (S.ships.length >= S.docks) return deny('Every berth is full');
    S.ships.push(newShip(type, rnd(0.25, 0.45)));
    sub.textContent = 'Yours, damaged. Repair her in Port.';
  } else if (mode === 'salvage') {
    grant(SCRAP_YIELD[type]);
    play('repair');
    sub.textContent = 'Broken up for timber, iron and canvas.';
  } else if (mode === 'ransom') {
    S.gold += t.ransom;
    coinFly(6);
    play('coin');
    sub.textContent = 'Her crew ransomed. The hull goes to the bottom.';
  } else if (mode === 'chest') {
    S.gold += chestValue(t);
    coinFly(10);
    play('coin');
    sub.textContent = 'Her strongbox came up off the cabin sole.';
  }

  const opts = el.querySelector('.prizeopts');
  if (opts) opts.remove();
  el.classList.add('decided');

  pending = Math.max(0, pending - 1);
  drawFoot();
  const hint = $('prizeHint');
  if (hint && !pending) hint.remove();

  updateRes();
  save();
  tutEvent('prize');
}

actions({
  cap: d => capAct(+d.i, d.mode, d.type),
  'close-result': closeResult
});
