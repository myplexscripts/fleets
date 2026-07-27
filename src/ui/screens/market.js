/* MARKET — sell what you have taken, buy what you cannot take.

   The market does not sell trade goods and it does not sell ships. Goods come
   off the routes you run and the ships you beat; ships come off the ships you
   beat. What is for sale here is the dull stuff a shipwright deals in —
   materials, a deeper diving bell, another berth — and the counter that turns
   surplus cargo into coin.

   Every card is an item card: identity, what you hold, what it is, then a
   footer with the price on the left and the button on the right. Quantities are
   steppers. Nothing on this screen invents its own layout. */

import { $ } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { PORTS } from '../../data/ports.js';
import { GOODS, GOOD_KEYS } from '../../data/goods.js';
import { MATERIALS, MAT_KEYS } from '../../data/materials.js';
import { MAX_BELL, BELL_NAMES, bellCost, bellMaxDepth, DEPTH_NAMES } from '../../data/salvage.js';
import { canPay, pay } from '../../core/selectors.js';
import { chip, chipRow, have, outOf, priceChips } from '../format.js';
import { itemCard, itemAction, itemGrid, stepper, sect } from '../components.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';

const dockCost = () => ({ gold: 350 + (S.docks - 2) * 250 + (S.docks >= 6 ? 400 : 0) });

/* How many of each thing the stepper is currently set to. Screen state, not
   save state — it resets when you leave, which is what you would expect. */
const qty = {};
const amount = (key, max) => Math.max(1, Math.min(max == null ? Infinity : Math.max(1, max), qty[key] || 1));

/* One card's worth of markup, so a stepper tick can redraw its own card and
   nothing else. Rebuilding the screen for every tap made the whole page jump
   and replay its entrance animations, which reads as the game glitching. */
function goodCard(k) {
  const g = GOODS[k];
  const n = amount('g' + k, S.goods[k]);
  return itemCard({
    id: 'itm_g_' + k, icon: k, name: g.n, sub: g.unit,
    held: chipRow([chip(k, S.goods[k], '', g.n + ' in store')], 'tight'),
    body: stepper('good-qty', k, n, S.goods[k]),
    price: chipRow([chip('gold', g.sell * n, 'gold', `${g.sell} each`)], 'tight'),
    action: itemAction('Sell', 'sell-good', { good: k, n })
  });
}

function matCard(k) {
  const m = MATERIALS[k];
  const n = amount('m' + k);
  const cost = { gold: m.buy * n };
  return itemCard({
    id: 'itm_m_' + k, icon: k, name: m.n, sub: m.unit,
    held: chipRow([chip(k, S.mats[k], '', m.n + ' in store')], 'tight'),
    body: stepper('mat-qty', k, n),
    price: priceChips(cost),
    action: itemAction('Buy', 'buy-mat', { mat: k, n }, { disabled: !canPay(cost) })
  });
}

/* Swap one card for its freshly built self, without the entrance animation and
   without touching a pixel of anything else on the page. */
function refreshCard(id, html) {
  const el = $(id);
  if (!el) return false;
  el.outerHTML = html;
  const next = $(id);
  if (next) next.classList.add('noanim');
  return true;
}

export function renderMarket() {
  let i = 0;
  let h = '';

  /* ---- sell: turn surplus cargo into coin ---- */
  const held = GOOD_KEYS.filter(k => S.goods[k] > 0);
  h += sect('Sell Cargo', i++);

  if (!held.length) {
    h += `<div class="card" style="--i:${i++}"><div class="sub center">Nothing in the hold to sell.</div></div>`;
  } else {
    h += itemGrid(held.map(goodCard).join(''));
    i++;
  }

  /* ---- buy: materials ---- */
  h += sect('Materials', i++);
  h += itemGrid(MAT_KEYS.map(matCard).join(''));
  i++;

  /* ---- the diving bell ---- */
  const maxed = S.bell >= MAX_BELL;
  const bc = bellCost(S.bell);
  h += sect('Salvage Gear', i++);
  h += itemCard({
    icon: 'bell', name: BELL_NAMES[S.bell], sub: DEPTH_NAMES[bellMaxDepth(S.bell)] || 'The abyss',
    held: chipRow([outOf('depth', S.bell, MAX_BELL, '', 'Bell level')], 'tight'),
    body: chipRow([
      chip('depth', bellMaxDepth(S.bell), '', 'Reaches'),
      maxed ? '' : chip('depth', '+1', 'ok', 'Next: ' + BELL_NAMES[S.bell + 1])
    ], 'tight'),
    price: maxed ? '' : priceChips(bc),
    action: itemAction(maxed ? 'Max' : 'Upgrade', 'buy-bell', {}, { disabled: maxed || !canPay(bc) }),
    cls: 'owned'
  });

  /* ---- harbour ---- */
  const dc = dockCost();
  h += sect('Harbour', i++);
  h += itemGrid([
    itemCard({
      icon: 'crew', name: 'Extra Berth', sub: 'Room for one more ship',
      held: chipRow([outOf('crew', S.ships.length, S.docks,
        S.ships.length >= S.docks ? 'warn' : '', 'Berths in use')], 'tight'),
      body: chipRow([chip('crew', '+1', 'ok', 'Berths gained')], 'tight'),
      price: priceChips(dc),
      action: itemAction('Buy', 'buy-dock', {}, { disabled: !canPay(dc) })
    }),
    itemCard({
      icon: 'port', name: 'Charted Ports', sub: 'Each keeps a contract open',
      held: chipRow([outOf('port', S.ports.length, Object.keys(PORTS).length, '', 'Ports charted')], 'tight'),
      body: `<div class="sub">${S.ports.map(p => PORTS[p].n).join(' · ')}</div>`
    })
  ].join(''));

  $('main').innerHTML = h;
}

/* ---- stepper ---- */
function bump(key, d, max, redraw) {
  const cur = amount(key, max);
  const next = Math.max(1, Math.min(max == null ? 9999 : max, cur + d));
  if (next === cur) return;
  qty[key] = next;
  /* Only this card changed, so only this card is rebuilt. */
  if (!refreshCard('itm_' + key[0] + '_' + key.slice(1), redraw())) render();
}

/* ---- actions ---- */
function sellGood(key, n) {
  const g = GOODS[key];
  const qtyOut = Math.min(S.goods[key], Math.max(1, +n || 1));
  if (qtyOut <= 0) return;
  S.goods[key] -= qtyOut;
  const paid = qtyOut * g.sell;
  S.gold += paid;
  qty['g' + key] = 1;
  play('coin');
  toast(`Sold ${qtyOut} ${g.unit} for ${paid} gold.`, 'gold');
  render();
}

function buyMat(key, n) {
  const m = MATERIALS[key], count = Math.max(1, +n || 1), cost = m.buy * count;
  if (S.gold < cost) return toast(`Not enough gold — that is ${cost}.`, 'bad');
  S.gold -= cost;
  S.mats[key] += count;
  qty['m' + key] = 1;
  play('coin');
  toast(`Bought ${count} ${m.unit}.`, 'gold');
  render();
}

function buyBell() {
  if (S.bell >= MAX_BELL) return;
  const c = bellCost(S.bell);
  if (!canPay(c)) return toast('Not enough to pay for that bell.', 'bad');
  pay(c);
  S.bell++;
  play('upgrade');
  toast(`${BELL_NAMES[S.bell]} rigged — depth ${bellMaxDepth(S.bell)} now.`, 'gold');
  render();
}

function buyDock() {
  const c = dockCost();
  if (!canPay(c)) return toast('Not enough to pay for another berth.', 'bad');
  pay(c);
  S.docks++;
  play('upgrade');
  toast('New berth bought.', 'gold');
  render();
}

actions({
  'good-qty': d => bump('g' + d.key, +d.d, S.goods[d.key], () => goodCard(d.key)),
  'mat-qty': d => bump('m' + d.key, +d.d, null, () => matCard(d.key)),
  'sell-good': d => sellGood(d.good, d.n),
  'buy-mat': d => buyMat(d.mat, +d.n),
  'buy-bell': buyBell,
  'buy-dock': buyDock
});
