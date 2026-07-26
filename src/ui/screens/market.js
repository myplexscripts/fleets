/* MARKET — goods, materials, the diving bell, ships and berths. */

import { $, esc } from '../../core/dom.js';
import { S, newShip } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { TYPES } from '../../data/ships.js';
import { PORTS } from '../../data/ports.js';
import { GOODS, GOOD_KEYS } from '../../data/goods.js';
import { MATERIALS, MAT_KEYS } from '../../data/materials.js';
import { MAX_BELL, BELL_NAMES, bellCost, bellMaxDepth, DEPTH_NAMES } from '../../data/salvage.js';
import { canPay, pay } from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { chip, chipRow, have, outOf, priceChips } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';

const SHIP_BUILD = {
  frigate: { gold: 550, wood: 20, metal: 12, cloth: 8 },
  manowar: { gold: 1300, wood: 40, metal: 30, cloth: 18 }
};

const dockCost = () => ({ gold: 350 + (S.docks - 2) * 250 + (S.docks >= 6 ? 400 : 0) });

export function renderMarket() {
  let i = 0;
  let h = `<div class="sect" style="--i:${i++}">Trade Goods</div>`;

  h += `<div class="goodsgrid" style="--i:${i++}">`;
  GOOD_KEYS.forEach(k => {
    const g = GOODS[k];
    const can1 = S.gold >= g.buy, can10 = S.gold >= g.buy * 10;
    h += `<div class="goodcard">
      <div class="ghead">${iconHTML(k, 34)}<div><b>${g.n}</b>${chipRow([chip(k, S.goods[k], '', g.n + ' in store')], 'tight')}</div></div>
      ${chipRow([
        have('gold', S.gold, g.buy, 'Buy price, each'),
        chip('gold', g.sell, 'dim', 'Sell price, each')
      ], 'tight')}
      <div class="btnset">
        <button class="btn sm" ${can1 ? '' : 'disabled'} data-act="buy-good" data-good="${k}" data-n="1">+1</button>
        <button class="btn sm" ${can10 ? '' : 'disabled'} data-act="buy-good" data-good="${k}" data-n="10">+10</button>
        <button class="btn sm" ${S.goods[k] ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="1">−1</button>
      </div></div>`;
  });
  h += `</div>`;

  h += `<div class="sect" style="--i:${i++}">Materials</div>`;
  h += `<div class="goodsgrid" style="--i:${i++}">`;
  MAT_KEYS.forEach(k => {
    const m = MATERIALS[k];
    h += `<div class="goodcard">
      <div class="ghead">${iconHTML(k, 34)}<div><b>${m.n}</b>${chipRow([chip(k, S.mats[k], '', m.n + ' in store')], 'tight')}</div></div>
      ${chipRow([have('gold', S.gold, m.buy, 'Buy price, each')], 'tight')}
      <div class="btnset">
        <button class="btn sm" ${S.gold >= m.buy ? '' : 'disabled'} data-act="buy-mat" data-mat="${k}" data-n="1">+1</button>
        <button class="btn sm" ${S.gold >= m.buy * 5 ? '' : 'disabled'} data-act="buy-mat" data-mat="${k}" data-n="5">+5</button>
      </div></div>`;
  });
  h += `</div>`;

  /* ---- diving bell ---- */
  h += `<div class="sect" style="--i:${i++}">Salvage Gear</div>`;
  const maxed = S.bell >= MAX_BELL;
  const bc = bellCost(S.bell);
  h += `<div class="card uprow flagcard" style="--i:${i++}">
      <div class="row"><h3>${iconHTML('bell', 30)} ${esc(BELL_NAMES[S.bell])}</h3>
        <span class="pips">${'●'.repeat(S.bell)}${'○'.repeat(MAX_BELL - S.bell)}</span></div>
      <div class="row">
        ${chipRow([
          chip('depth', bellMaxDepth(S.bell), '', 'Reaches — ' + (DEPTH_NAMES[bellMaxDepth(S.bell)] || 'the abyss')),
          maxed ? '' : chip('depth', '+1', 'ok', 'Next bell: ' + BELL_NAMES[S.bell + 1])
        ], 'tight')}
        <button class="btn sm gold" ${!maxed && canPay(bc) ? '' : 'disabled'} data-act="buy-bell">${maxed ? 'MAX' : 'Upgrade'}</button>
      </div>
      ${maxed ? '' : priceChips(bc)}</div>`;

  /* ---- ships ---- */
  h += `<div class="sect" style="--i:${i++}">Buy a Ship</div>`;
  ['schooner', 'brig'].forEach(t => {
    h += shipCard(t, 'Buy', { gold: TYPES[t].cost },
      `data-act="buy-ship" data-type="${t}"`, S.gold >= TYPES[t].cost, i++);
  });

  if (S.unlocked.includes('gulf')) {
    h += `<div class="sect" style="--i:${i++}">Shipyard</div>`;
    h += shipCard('frigate', 'Build', SHIP_BUILD.frigate,
      `data-act="build-ship" data-type="frigate"`, canPay(SHIP_BUILD.frigate), i++);
    if (S.unlocked.includes('atlantic')) {
      h += shipCard('manowar', 'Build', SHIP_BUILD.manowar,
        `data-act="build-ship" data-type="manowar"`, canPay(SHIP_BUILD.manowar), i++);
    }
  }

  /* ---- harbour ---- */
  const dc = dockCost();
  h += `<div class="sect" style="--i:${i++}">Harbour</div>
    <div class="card uprow" style="--i:${i++}">
      <div class="row"><h3>Extra Berth</h3>
        ${chipRow([outOf('crew', S.ships.length, S.docks, S.ships.length >= S.docks ? 'warn' : '', 'Berths in use')], 'tight')}</div>
      <div class="row">
        ${chipRow([chip('crew', '+1', 'ok', 'Berths gained')], 'tight')}
        <button class="btn sm gold" ${canPay(dc) ? '' : 'disabled'} data-act="buy-dock">Buy</button></div>
      ${priceChips(dc)}</div>
    <div class="card" style="--i:${i++}">
      <div class="row"><h3>Charted Ports</h3>
        ${chipRow([outOf('port', S.ports.length, Object.keys(PORTS).length, '', 'Ports charted')], 'tight')}</div>
      <div class="sub">${S.ports.map(p => esc(PORTS[p].n)).join(' · ')}</div></div>`;

  $('main').innerHTML = h;
}

function shipCard(t, label, cost, attrs, ok, i) {
  const d = TYPES[t];
  return `<div class="card" style="--i:${i}"><div class="shiprow">
    <div class="fleetship">${shipHTML(t, 'player', 1.0)}</div>
    <div class="shipmeta">
      <div class="row"><h3>${d.n}</h3>
        <button class="btn sm gold" ${ok ? '' : 'disabled'} ${attrs}>${label}</button></div>
      ${chipRow([
        chip('speed', d.speed, '', 'Speed'),
        chip('guns', d.guns, '', 'Guns'),
        chip('hull', d.hull, '', 'Hull'),
        chip('cargo', d.cargo, '', 'Cargo space')
      ])}
      ${priceChips(cost)}
    </div></div></div>`;
}

/* ---- actions ---- */
function buyGood(key, n) {
  const g = GOODS[key], cost = g.buy * n;
  if (S.gold < cost) return toast(`Not enough gold — that is ${cost}.`, 'bad');
  S.gold -= cost;
  S.goods[key] += n;
  play('coin');
  toast(`Bought ${n} ${g.unit} of ${g.n.toLowerCase()} for ${cost} gold.`, 'gold');
  render();
}

function buyMat(key, n) {
  const m = MATERIALS[key], cost = m.buy * n;
  if (S.gold < cost) return toast(`Not enough gold — that is ${cost}.`, 'bad');
  S.gold -= cost;
  S.mats[key] += n;
  play('coin');
  toast(`Bought ${n} ${m.unit}.`, 'gold');
  render();
}

function buyBell() {
  if (S.bell >= MAX_BELL) return;
  const c = bellCost(S.bell);
  if (!canPay(c)) return toast('Not enough to pay for that bell.', 'bad');
  pay(c);
  S.bell++;
  play('upgrade');
  toast(`${BELL_NAMES[S.bell]} rigged — you can work depth ${bellMaxDepth(S.bell)} now.`, 'gold');
  render();
}

function berthFree() {
  if (S.ships.length >= S.docks) {
    toast('All berths are full. Buy an extra berth below first.', 'bad');
    return false;
  }
  return true;
}

function buyShip(t) {
  if (!berthFree()) return;
  const cost = TYPES[t].cost;
  if (S.gold < cost) return toast('Not enough gold for that ship.', 'bad');
  S.gold -= cost;
  S.ships.push(newShip(t));
  toast('A ' + TYPES[t].n + ' joins your fleet.', 'gold');
  render();
}

function buildShip(t) {
  if (!berthFree()) return;
  const c = SHIP_BUILD[t];
  if (!canPay(c)) return toast('Not enough materials to lay down that hull.', 'bad');
  pay(c);
  S.ships.push(newShip(t));
  toast('Your ' + TYPES[t].n + ' is built and berthed.', 'gold');
  render();
}

function buyDock() {
  const c = dockCost();
  if (!canPay(c)) return toast('Not enough to pay for another berth.', 'bad');
  pay(c);
  S.docks++;
  toast('New berth bought.', 'gold');
  render();
}

actions({
  'buy-good': d => buyGood(d.good, +d.n),
  'buy-mat': d => buyMat(d.mat, +d.n),
  'buy-bell': buyBell,
  'buy-ship': d => buyShip(d.type),
  'build-ship': d => buildShip(d.type),
  'buy-dock': buyDock
});
