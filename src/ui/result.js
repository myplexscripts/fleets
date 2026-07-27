/* The after-action report.

   Its own full screen, not a drawer. What you won is the point of it, so the
   haul is the biggest thing on it — a strongbox of chips at the top, before any
   words. The account of what happened is one line underneath, because you were
   there.

   A prize is a decision, not a payout. Nothing about a beaten ship is granted
   automatically: keep her and she takes a berth, scuttle her for materials,
   ransom the crew for coin, or let her drift. The screen will not close until
   every prize taken has been answered for — deciding is the reward. */

import { $, esc, reflow } from '../core/dom.js';
import { S, save, newShip } from '../core/state.js';
import { actions } from '../core/actions.js';
import { render } from '../core/bus.js';
import { rnd } from '../core/rng.js';
import { grant } from '../core/selectors.js';
import { TYPES } from '../data/ships.js';
import { SCRAP_YIELD, MAT_KEYS } from '../data/materials.js';
import { REGIONS } from '../data/world.js';
import { BOSSES } from '../data/bosses.js';
import { shipHTML } from '../art/ships.js';
import { chip, have, chipRow, outOf, bagChips, shipChips } from './format.js';
import { updateRes } from './hud.js';
import { coinFly } from '../fx/coins.js';
import { toast } from '../fx/toast.js';
import { tutEvent, refreshTut } from './tutorial.js';

/* What the loose fittings off a scuttled prize fetch. */
const SCRAP_GOLD = 200;

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
    captives.forEach((e, i) => {
      const t = TYPES[e.type], full = S.ships.length >= S.docks;
      h += `<div class="card" style="--i:${i + 2}" id="cap${i}"><div class="shiprow">
        <div>${shipHTML(e.type, e.pal === 'boss' ? 'boss' : 'enemy', 0.85)}</div>
        <div class="shipmeta"><h3>${e.derelict ? 'Derelict' : 'Captured'} ${t.n}</h3>
        ${shipChips({ speed: t.speed, guns: t.guns, hull: Math.round(t.hull * 0.33), max: t.hull, cargo: t.cargo })}
        <div class="sub"></div></div></div>
        <div class="prizeopts">
          ${prizeOpt(chipRow([outOf('crew', S.ships.length, S.docks, full ? 'bad' : 'ok', 'Berths in use')], 'tight'),
            'Keep', i, 'capture', e.type, full, 'gold')}
          ${prizeOpt(chipRow([bagChips({ ...SCRAP_YIELD[e.type], gold: SCRAP_GOLD })], 'tight'),
            'Scuttle', i, 'salvage', e.type)}
          ${e.derelict ? '' : prizeOpt(chipRow([chip('gold', t.ransom, 'gold', 'Ransom')], 'tight'),
            'Ransom', i, 'ransom', e.type)}
          ${prizeOpt('', 'Let Go', i, 'ignore', e.type)}
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

/* The haul, big, before any prose. One frame, one chip per thing — the contract
   money and the materials off the enemy are the same metal, so they are added
   rather than listed twice. */
function strongbox(paid, sp) {
  const bag = { ...paid };
  if (sp && sp.mats) MAT_KEYS.forEach(m => { if (sp.mats[m]) bag[m] = (bag[m] || 0) + sp.mats[m]; });

  const won = [bagChips(bag)];
  if (sp && sp.goods && sp.goods.n) won.push(chip(sp.goods.good, sp.goods.n, 'gold', sp.goods.name));

  const inner = chipRow(won, 'big');
  if (!inner) return '';
  return `<div class="strongbox"><div class="sboxlbl">Taken</div>${inner}</div>`;
}

/* Notoriety as a bar reading: what this added, and where the region stands. */
function notoRow(route, noto) {
  if (!noto) return '';
  const need = BOSSES[route.region] ? BOSSES[route.region].noto : 0;
  const cur = S.noto[route.region] || 0;
  return `<div class="spoils"><span class="spoilslbl">${esc(REGIONS[route.region].n)}</span>${chipRow([
    chip('noto', '+' + noto, 'ok', 'Gained'),
    need ? have('noto', cur, need, 'Notoriety toward the admiral') : ''
  ], 'tight')}</div>`;
}

/* One prize choice: what you get on the left, the button that takes it right. */
function prizeOpt(gets, label, i, mode, type, disabled, cls) {
  return `<div class="prizeopt"><div class="itemprice">${gets}</div>`
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
    if (S.ships.length >= S.docks) return toast('Every berth is full, Captain.', 'bad');
    S.ships.push(newShip(type, rnd(0.25, 0.45)));
    sub.textContent = 'Yours, damaged. Repair her in Port.';
  } else if (mode === 'salvage') {
    grant(SCRAP_YIELD[type]);
    S.gold += SCRAP_GOLD;
    sub.textContent = 'Scuttled for materials.';
  } else if (mode === 'ransom') {
    S.gold += t.ransom;
    coinFly(6);
    sub.textContent = 'Crew ransomed.';
  } else {
    sub.textContent = 'Left to drift.';
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
