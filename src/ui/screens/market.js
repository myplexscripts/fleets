/* MARKET — ships, trade goods, berths. */

import { $ } from '../../core/dom.js';
import { S, newShip } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { CARGO_PRICE } from '../../core/config.js';
import { TYPES } from '../../data/ships.js';
import { PORTS } from '../../data/ports.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { toast } from '../../fx/toast.js';

const dockCost = () => 350 + (S.docks - 2) * 250;
const dockGems = () => (S.docks >= 6 ? 2 : 0);

export function renderMarket() {
  let i = 0;
  let h = `<div class="sect" style="--i:${i++}">Buy a Ship</div>`;

  ['schooner', 'brig'].forEach(t => {
    h += marketShipCard(t, `Buy · ${iconHTML('reales', 19)}${TYPES[t].cost}`,
      `data-act="buy-ship" data-type="${t}"`, S.reales >= TYPES[t].cost, i++);
  });

  if (S.unlocked.includes('gulf')) {
    h += `<div class="sect" style="--i:${i++}">Shipyard</div>`;
    h += marketShipCard('frigate', `Build · ${iconHTML('reales', 19)}550 ${iconHTML('parts', 19)}28`,
      `data-act="build-ship" data-type="frigate" data-reales="550" data-parts="28"`,
      S.reales >= 550 && S.parts >= 28, i++);
    if (S.unlocked.includes('atlantic')) {
      h += marketShipCard('manowar', `Build · ${iconHTML('reales', 19)}1300 ${iconHTML('parts', 19)}65`,
        `data-act="build-ship" data-type="manowar" data-reales="1300" data-parts="65"`,
        S.reales >= 1300 && S.parts >= 65, i++);
    }
  }

  h += `<div class="sect" style="--i:${i++}">Trade Goods</div>
    <div class="card" style="--i:${i++}"><div class="row">
      <span class="sub" style="flex:1 1 170px">Trade runs load these as cargo. You have <b>${S.cargo}</b> units. Each unit costs ${CARGO_PRICE} reales.</span>
      <span class="btnset">
        <button class="btn sm" ${S.reales >= CARGO_PRICE * 5 ? '' : 'disabled'} data-act="buy-cargo" data-n="5">Buy 5 · ${iconHTML('reales', 19)}${CARGO_PRICE * 5}</button>
        <button class="btn sm" ${S.reales >= CARGO_PRICE * 20 ? '' : 'disabled'} data-act="buy-cargo" data-n="20">Buy 20 · ${iconHTML('reales', 19)}${CARGO_PRICE * 20}</button></span></div></div>

    <div class="sect" style="--i:${i++}">Harbour</div>
    <div class="card" style="--i:${i++}"><div class="row"><div><h3>Extra Berth</h3>
      <div class="sub">Each berth holds one ship. You are using ${S.ships.length} of ${S.docks}.</div></div>
      <button class="btn sm gold" ${S.reales >= dockCost() && S.gems >= dockGems() ? '' : 'disabled'} data-act="buy-dock">Buy · ${iconHTML('reales', 19)}${dockCost()}${dockGems() ? ' ' + iconHTML('gems', 19) + dockGems() : ''}</button></div></div>

    <div class="card" style="--i:${i++}"><h3>Charted Ports — ${S.ports.length}/${Object.keys(PORTS).length}</h3>
      <div class="sub">${S.ports.map(p => PORTS[p].n).join(' · ')}</div></div>`;

  $('main').innerHTML = h;
}

function marketShipCard(t, price, attrs, ok, i) {
  const d = TYPES[t];
  return `<div class="card" style="--i:${i}"><div class="shiprow">
    <div class="fleetship">${shipHTML(t, 'player', 1.0)}</div>
    <div class="shipmeta"><h3>${d.n}</h3>
      <div class="stats"><span>SPD <b>${d.speed}</b></span><span>GUNS <b>${d.guns}</b></span><span>HULL <b>${d.hull}</b></span><span>CARGO <b>${d.cargo}</b></span></div>
      <div style="margin-top:10px"><button class="btn sm gold" ${ok ? '' : 'disabled'} ${attrs}>${price}</button></div>
    </div></div></div>`;
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

function buildShip(t, r, p) {
  if (!berthFree()) return;
  if (S.reales < r || S.parts < p) return toast('Not enough to lay down that hull.', 'bad');
  S.reales -= r;
  S.parts -= p;
  S.ships.push(newShip(t));
  toast('Your ' + TYPES[t].n + ' is built and berthed.', 'gold');
  render();
}

function buyCargo(n) {
  const c = n * CARGO_PRICE;
  if (S.reales < c) return toast('Not enough reales — ' + n + ' units cost ' + c + '.', 'bad');
  S.reales -= c;
  S.cargo += n;
  toast('Bought ' + n + ' cargo units for ' + c + ' reales.', 'gold');
  render();
}

function buyDock() {
  const c = dockCost(), g = dockGems();
  if (S.reales < c || S.gems < g) return toast('Not enough to pay for another berth.', 'bad');
  S.reales -= c;
  S.gems -= g;
  S.docks++;
  toast('New berth bought.', 'gold');
  render();
}

actions({
  'buy-ship': d => buyShip(d.type),
  'build-ship': d => buildShip(d.type, +d.reales, +d.parts),
  'buy-cargo': d => buyCargo(+d.n),
  'buy-dock': buyDock
});
