/* The after-action report, and what you do with captured ships. */

import { $, esc } from '../core/dom.js';
import { S, save, newShip } from '../core/state.js';
import { actions } from '../core/actions.js';
import { rnd } from '../core/rng.js';
import { grant } from '../core/selectors.js';
import { TYPES } from '../data/ships.js';
import { SCRAP_YIELD, MATERIALS } from '../data/materials.js';

/* What the loose fittings off a broken-up prize fetch. */
const SCRAP_GOLD = 200;
import { REGIONS } from '../data/world.js';
import { BOSSES } from '../data/bosses.js';
import { shipHTML } from '../art/ships.js';
import { fmt, chip, chipRow, shipChips } from './format.js';
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
    ${noto ? `<div class="evt noto">Your name carries further in ${REGIONS[route.region].n} — notoriety +${noto}, now ${S.noto[route.region] || 0} of ${BOSSES[route.region].noto}.</div>` : ''}
    ${evt ? `<div class="evt">${esc(evt)}</div>` : ''}`;

  if (captives.length) {
    h += `<div class="sect" style="margin-top:14px;--i:1">Prizes of War</div>`;
    captives.forEach((e, i) => {
      const t = TYPES[e.type], full = S.ships.length >= S.docks;
      h += `<div class="card" style="--i:${i + 2}" id="cap${i}"><div class="shiprow">
        <div>${shipHTML(e.type, e.pal === 'boss' ? 'boss' : 'enemy', 0.85)}</div>
        <div class="shipmeta"><h3>${e.derelict ? 'Derelict' : 'Captured'} ${t.n}</h3>
        ${shipChips({ speed: t.speed, guns: t.guns, hull: Math.round(t.hull * 0.33), max: t.hull, cargo: t.cargo })}
        <div class="sub">Keep her (needs a berth), break her up for ${scrapLine(e.type)}${e.derelict ? '' : ', or ransom the crew for ' + t.ransom + ' gold'}.</div></div></div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:7px">
          <button class="btn sm gold" ${full ? 'disabled' : ''} data-act="cap" data-i="${i}" data-mode="capture" data-type="${e.type}">Keep</button>
          <button class="btn sm" data-act="cap" data-i="${i}" data-mode="salvage" data-type="${e.type}">Break Up</button>
          ${e.derelict ? '' : `<button class="btn sm" data-act="cap" data-i="${i}" data-mode="ransom" data-type="${e.type}">Ransom</button>`}
          <button class="btn sm" data-act="cap" data-i="${i}" data-mode="ignore" data-type="${e.type}">Let Go</button>
        </div>${full ? '<div class="sub" style="color:var(--yel);margin-top:8px">No free berth. Scuttle a ship in Port, or buy a berth in the Market, to keep her.</div>' : ''}</div>`;
    });
  }

  h += `<button class="btn gold wide" style="margin-top:12px" data-act="close-sheet">Continue</button>`;

  setSheet(`<h3>${esc(route.n)}</h3>`, h);
  openSheet();

  if (success && paid.gold) {
    setTimeout(() => coinFly(Math.min(12, Math.ceil(paid.gold / 200))), 500);
  }
  save();
  updateRes();
  refreshTut();
}

const scrapWords = type => {
  const y = SCRAP_YIELD[type];
  return `${y.wood} ${MATERIALS.wood.unit}, ${y.metal} ${MATERIALS.metal.unit} and ${y.cloth} ${MATERIALS.cloth.unit}`;
};
const scrapLine = type => scrapWords(type) + `, plus ${SCRAP_GOLD} gold`;

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
    sub.textContent = 'Added to your fleet, damaged. Repair her in Port.';
    toast('The ' + t.n + ' flies your colours now.', 'gold');
  } else if (mode === 'salvage') {
    const yld = SCRAP_YIELD[type];
    grant(yld);
    S.gold += SCRAP_GOLD;
    sub.textContent = `Broken up for ${scrapWords(type)}, and ${SCRAP_GOLD} gold for the fittings.`;
  } else if (mode === 'ransom') {
    S.gold += t.ransom;
    coinFly(6);
    sub.textContent = `Crew ransomed back for ${t.ransom} gold.`;
  } else {
    sub.textContent = 'Left to drift. Nothing gained.';
  }

  const row = el.querySelector('.row');
  if (row) row.remove();
  updateRes();
  save();
  tutEvent('prize');
}

actions({
  cap: d => capAct(+d.i, d.mode, d.type)
});
