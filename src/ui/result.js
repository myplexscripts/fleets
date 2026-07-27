/* The after-action report, and what you do with captured ships. */

import { $, esc } from '../core/dom.js';
import { S, save, newShip } from '../core/state.js';
import { actions } from '../core/actions.js';
import { rnd } from '../core/rng.js';
import { grant } from '../core/selectors.js';
import { TYPES } from '../data/ships.js';
import { SCRAP_YIELD } from '../data/materials.js';

/* What the loose fittings off a broken-up prize fetch. */
const SCRAP_GOLD = 200;
import { REGIONS } from '../data/world.js';
import { BOSSES } from '../data/bosses.js';
import { shipHTML } from '../art/ships.js';
import { fmt, chip, have, chipRow, outOf, bagChips, shipChips } from './format.js';
import { GOODS } from '../data/goods.js';
import { MAT_KEYS } from '../data/materials.js';
import { setSheet, openSheet } from './sheet.js';
import { updateRes } from './hud.js';
import { coinFly } from '../fx/coins.js';
import { toast } from '../fx/toast.js';
import { tutEvent, refreshTut } from './tutorial.js';

export function showResult({ route, success, msg, captives = [], evt = '', noto = 0, prizeMsg = '', extra = null, spoils = null, fromVoyage = false }) {
  /* A dive's chest money is not part of the route reward, so fold it in for the
     payout line and the coin shower. */
  const paid = { ...(route.rew || {}) };
  if (extra) for (const k in extra) paid[k] = (paid[k] || 0) + extra[k];
  const isBoss = route.type === 'boss', isCh = route.type === 'charter';
  const title = success
    ? (isBoss ? 'Admiral Defeated' : (isCh ? 'Charter Fulfilled' : (fromVoyage ? 'Ships Returned' : 'Lane Swept')))
    : (isBoss ? 'Repulsed' : (fromVoyage ? 'Run Lost' : 'Battle Lost'));

  let h = `<div class="resulthead ${success ? 'good' : 'bad'}">${title}</div>
    <div class="sub center">${success && fmt(paid) ? '<b style="color:var(--goldhi)">' + fmt(paid) + '</b> paid into the strongbox. ' : ''}${esc(msg || '')}</div>
    ${spoilsRow(spoils)}
    ${prizeMsg ? `<div class="evt prize">${esc(prizeMsg)}</div>` : ''}
    ${notoRow(route, noto)}
    ${evt ? `<div class="evt">${esc(evt)}</div>` : ''}`;

  if (captives.length) {
    h += `<div class="sect" style="margin-top:14px;--i:1">Prizes of War</div>`;
    captives.forEach((e, i) => {
      const t = TYPES[e.type], full = S.ships.length >= S.docks;
      /* Each option shows what it gives you, so choosing needs no paragraph. */
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

  setSheet(`<h3>${esc(route.n)}</h3>`, h,
    `<button class="btn gold wide" data-act="close-sheet">Continue</button>`);
  openSheet();

  if (success && paid.gold) {
    setTimeout(() => coinFly(Math.min(12, Math.ceil(paid.gold / 200))), 500);
  }
  save();
  updateRes();
  refreshTut();
}


/* One prize choice. Same shape as an item footer everywhere else: what you get
   on the left, the button that takes it on the right. */
function prizeOpt(gets, label, i, mode, type, disabled, cls) {
  return `<div class="prizeopt"><div class="itemprice">${gets}</div>`
    + `<button class="btn sm ${cls || ''} itemact"${disabled ? ' disabled' : ''}`
    + ` data-act="cap" data-i="${i}" data-mode="${mode}" data-type="${type}">${label}</button></div>`;
}

/* Notoriety, as a bar reading rather than a sentence: what this win added, and
   where the region now stands against its admiral. */
function notoRow(route, noto) {
  if (!noto) return '';
  const need = BOSSES[route.region] ? BOSSES[route.region].noto : 0;
  const cur = S.noto[route.region] || 0;
  return `<div class="spoils"><span class="spoilslbl">${esc(REGIONS[route.region].n)}</span>${chipRow([
    chip('noto', '+' + noto, 'ok', 'Gained'),
    need ? have('noto', cur, need, 'Notoriety toward the admiral') : ''
  ], 'tight')}</div>`;
}

/* What came off the enemy, as chips rather than a sentence. */
function spoilsRow(sp) {
  if (!sp) return '';
  const list = [];
  if (sp.goods && sp.goods.n) list.push(chip(sp.goods.good, sp.goods.n, 'gold', sp.goods.name));
  if (sp.mats) MAT_KEYS.forEach(m => { if (sp.mats[m]) list.push(chip(m, sp.mats[m], 'gold', m)); });
  if (!list.length) return '';
  return `<div class="spoils"><span class="spoilslbl">Taken</span>${chipRow(list, 'tight')}</div>`;
}

function capAct(i, mode, type) {
  const t = TYPES[type], el = $('cap' + i);
  if (!el) return;
  const sub = el.querySelector('.sub');

  if (mode === 'capture') {
    if (S.ships.length >= S.docks) return toast('Every berth is full, Captain.', 'bad');
    S.ships.push(newShip(type, rnd(0.25, 0.45)));
    sub.textContent = 'Yours, damaged. Repair her in Port.';
    toast('The ' + t.n + ' flies your colours now.', 'gold');
  } else if (mode === 'salvage') {
    const yld = SCRAP_YIELD[type];
    grant(yld);
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
  updateRes();
  save();
  tutEvent('prize');
}

actions({
  cap: d => capAct(+d.i, d.mode, d.type)
});
