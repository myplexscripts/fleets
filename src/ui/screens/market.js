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
import { costStr } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';

const SHIP_BUILD = {
  frigate: { reales: 550, wood: 20, metal: 12, cloth: 8 },
  manowar: { reales: 1300, wood: 40, metal: 30, cloth: 18 }
};

const dockCost = () => ({ reales: 350 + (S.docks - 2) * 250, gems: S.docks >= 6 ? 2 : 0 });

export function renderMarket() {
  let i = 0;
  let h = `<div class="sect" style="--i:${i++}">Trade Goods</div>
    <div class="card" style="--i:${i++}"><div class="sub">Bought here, delivered under contract. A delivery pays several times what this counter will give you back for the same crates, so buy to fill a contract — not to speculate.</div></div>`;

  h += `<div class="goodsgrid" style="--i:${i++}">`;
  GOOD_KEYS.forEach(k => {
    const g = GOODS[k];
    const can1 = S.reales >= g.buy, can10 = S.reales >= g.buy * 10;
    h += `<div class="goodcard">
      <div class="ghead">${iconHTML(k, 34)}<div><b>${g.n}</b><i>${S.goods[k]} ${g.unit}</i></div></div>
      <div class="gprice">buy ${g.buy}${iconHTML('reales', 16)} · sell ${g.sell}${iconHTML('reales', 16)}</div>
      <div class="btnset">
        <button class="btn sm" ${can1 ? '' : 'disabled'} data-act="buy-good" data-good="${k}" data-n="1">+1</button>
        <button class="btn sm" ${can10 ? '' : 'disabled'} data-act="buy-good" data-good="${k}" data-n="10">+10</button>
        <button class="btn sm" ${S.goods[k] ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="1">−1</button>
      </div></div>`;
  });
  h += `</div>`;

  h += `<div class="sect" style="--i:${i++}">Materials</div>
    <div class="card" style="--i:${i++}"><div class="sub">Refits are built from these. Fighting, breaking up captured hulls and diving wrecks all yield them — buying is the expensive shortcut.</div></div>`;
  h += `<div class="goodsgrid" style="--i:${i++}">`;
  MAT_KEYS.forEach(k => {
    const m = MATERIALS[k];
    h += `<div class="goodcard">
      <div class="ghead">${iconHTML(k, 34)}<div><b>${m.n}</b><i>${S.mats[k]} ${m.unit}</i></div></div>
      <div class="gprice">buy ${m.buy}${iconHTML('reales', 16)}</div>
      <div class="btnset">
        <button class="btn sm" ${S.reales >= m.buy ? '' : 'disabled'} data-act="buy-mat" data-mat="${k}" data-n="1">+1</button>
        <button class="btn sm" ${S.reales >= m.buy * 5 ? '' : 'disabled'} data-act="buy-mat" data-mat="${k}" data-n="5">+5</button>
      </div></div>`;
  });
  h += `</div>`;

  /* ---- diving bell ---- */
  h += `<div class="sect" style="--i:${i++}">Salvage Gear</div>`;
  const maxed = S.bell >= MAX_BELL;
  const bc = bellCost(S.bell);
  h += `<div class="card flagcard" style="--i:${i++}"><div class="row">
      <div style="flex:1"><h3>${iconHTML('bell', 30)} ${esc(BELL_NAMES[S.bell])}</h3>
        <div class="sub">Reaches depth <b>${bellMaxDepth(S.bell)}</b> — ${DEPTH_NAMES[bellMaxDepth(S.bell)] || 'the abyss'}.
        ${maxed ? 'Nothing on this ocean lies deeper than you can work.' : `Next: <b>${esc(BELL_NAMES[S.bell + 1])}</b>, down to depth ${bellMaxDepth(S.bell + 1)}. A bell deeper than a wreck needs also brings up more chests.`}
        <br><span class="pips">${'●'.repeat(S.bell)}${'○'.repeat(MAX_BELL - S.bell)}</span></div></div>
      <button class="btn sm gold" ${!maxed && canPay(bc) ? '' : 'disabled'} data-act="buy-bell">${maxed ? 'MAX' : costStr(bc)}</button>
    </div></div>`;

  /* ---- ships ---- */
  h += `<div class="sect" style="--i:${i++}">Buy a Ship</div>`;
  ['schooner', 'brig'].forEach(t => {
    h += shipCard(t, `Buy · ${iconHTML('reales', 19)}${TYPES[t].cost}`,
      `data-act="buy-ship" data-type="${t}"`, S.reales >= TYPES[t].cost, i++);
  });

  if (S.unlocked.includes('gulf')) {
    h += `<div class="sect" style="--i:${i++}">Shipyard</div>`;
    h += shipCard('frigate', `Build · ${costStr(SHIP_BUILD.frigate)}`,
      `data-act="build-ship" data-type="frigate"`, canPay(SHIP_BUILD.frigate), i++);
    if (S.unlocked.includes('atlantic')) {
      h += shipCard('manowar', `Build · ${costStr(SHIP_BUILD.manowar)}`,
        `data-act="build-ship" data-type="manowar"`, canPay(SHIP_BUILD.manowar), i++);
    }
  }

  /* ---- harbour ---- */
  const dc = dockCost();
  h += `<div class="sect" style="--i:${i++}">Harbour</div>
    <div class="card" style="--i:${i++}"><div class="row"><div><h3>Extra Berth</h3>
      <div class="sub">Each berth holds one ship. You are using ${S.ships.length} of ${S.docks}.</div></div>
      <button class="btn sm gold" ${canPay(dc) ? '' : 'disabled'} data-act="buy-dock">Buy · ${costStr(dc)}</button></div></div>
    <div class="card" style="--i:${i++}"><h3>Charted Ports — ${S.ports.length}/${Object.keys(PORTS).length}</h3>
      <div class="sub">Every charted port keeps a cargo contract open for you.<br>${S.ports.map(p => PORTS[p].n).join(' · ')}</div></div>`;

  $('main').innerHTML = h;
}

function shipCard(t, price, attrs, ok, i) {
  const d = TYPES[t];
  return `<div class="card" style="--i:${i}"><div class="shiprow">
    <div class="fleetship">${shipHTML(t, 'player', 1.0)}</div>
    <div class="shipmeta"><h3>${d.n}</h3>
      <div class="stats"><span>SPD <b>${d.speed}</b></span><span>GUNS <b>${d.guns}</b></span><span>HULL <b>${d.hull}</b></span><span>HOLD <b>${d.cargo}</b></span></div>
      <div style="margin-top:10px"><button class="btn sm gold" ${ok ? '' : 'disabled'} ${attrs}>${price}</button></div>
    </div></div></div>`;
}

/* ---- actions ---- */
function buyGood(key, n) {
  const g = GOODS[key], cost = g.buy * n;
  if (S.reales < cost) return toast(`Not enough reales — that is ${cost}.`, 'bad');
  S.reales -= cost;
  S.goods[key] += n;
  play('coin');
  toast(`Bought ${n} ${g.unit} of ${g.n.toLowerCase()} for ${cost} reales.`, 'gold');
  render();
}

function buyMat(key, n) {
  const m = MATERIALS[key], cost = m.buy * n;
  if (S.reales < cost) return toast(`Not enough reales — that is ${cost}.`, 'bad');
  S.reales -= cost;
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
  if (S.reales < cost) return toast('Not enough reales for that ship.', 'bad');
  S.reales -= cost;
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
