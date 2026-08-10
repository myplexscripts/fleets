/* MARKET — two counters, and you stand at one of them.

   SELL turns surplus cargo into coin. SHIPWRIGHT is the yard: a deeper diving
   bell today, more of the same kind of thing later. Docks belong on the Port
   screen, next to the fleet they make room for.

   Nothing sells you materials. Timber, iron and canvas come off hulls you have
   broken up and hulls you have beaten, and that is the point — it is what makes
   "scuttle her for supplies or ransom her crew for coin" a real question every
   single time instead of an exchange rate. While a counter sold materials at a
   fixed price, ransom was simply the better number and the choice was theatre.

   Trade goods and ships are not for sale either: goods come off the routes you
   run and the ships you beat, and a ship joins your fleet only by being taken
   from somebody else.

   Every card is an item card: identity, what you hold, what it is, then a
   footer with the price on the left and the button on the right. Quantities are
   steppers. A completed deal pops off the button that did it rather than
   announcing itself across the top of the screen. */

import { $, esc } from '../../core/dom.js';
import { S, save } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { PORTS } from '../../data/ports.js';
import { GOODS, GOOD_KEYS } from '../../data/goods.js';
import { MAX_BELL, BELL_NAMES, bellCost, bellMaxDepth, DEPTH_NAMES } from '../../data/salvage.js';
import { WAREHOUSE, MAX_WAREHOUSE, warehouseCost, storeCapAt } from '../../data/storage.js';
import { FIGUREHEADS, SHOP_FIGS } from '../../data/figureheads.js';
import { canPay, pay, storeCap, hasFig } from '../../core/selectors.js';
import { rechartDives } from '../../core/dives.js';
import { chip, chipRow, outOf, priceChips } from '../format.js';
import { itemCard, itemAction, itemGrid, stepper, sect } from '../components.js';
import { updateRes, purseHTML } from '../hud.js';
import { pop, deny } from '../../fx/pop.js';
import { award } from '../../fx/award.js';
import { play } from '../../fx/sound.js';

/* Which counter you are standing at. Screen state, not save state. */
let tab = 'sell';

/* How many of each thing the stepper is currently set to. */
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
  const held = GOOD_KEYS.filter(k => S.goods[k] > 0);
  let i = 0;

  let h = purseHTML();
  h += `<div class="mtabs sticky">
      <button class="mtab ${tab === 'sell' ? 'on' : ''}" data-act="mkt-tab" data-tab="sell">Sell</button>
      <button class="mtab ${tab === 'buy' ? 'on' : ''}" data-act="mkt-tab" data-tab="buy">Shipwright</button>
    </div>`;

  if (tab === 'sell') {
    h += sect('Trade Goods', i++);
    h += held.length
      ? itemGrid(held.map(goodCard).join(''), 'rail')
      : `<div class="card" style="--i:${i++}"><div class="sub center">Nothing in the hold to sell. Run a contract, or take some off an enemy.</div></div>`;
  } else {
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

    /* The warehouse. Bought here because everything it holds is bought and sold
       here, and because a cap the player cannot see the price of is a cap that
       reads as an arbitrary refusal. */
    const whMax = S.wh >= MAX_WAREHOUSE;
    const wc = warehouseCost(S.wh);
    h += sect('Storage', i++);
    h += itemCard({
      icon: 'cargo', name: WAREHOUSE[S.wh].n, sub: WAREHOUSE[S.wh].sub,
      held: chipRow([outOf('cargo', S.wh, MAX_WAREHOUSE, '', 'Warehouse level')], 'tight'),
      body: chipRow([
        chip('cargo', storeCap(), '', 'Room for this much of every material and every good'),
        whMax ? '' : chip('cargo', '+' + (storeCapAt(S.wh + 1) - storeCap()), 'ok',
          'Next: ' + WAREHOUSE[S.wh + 1].n)
      ], 'tight') + `<div class="sub">Anything over the line is sold on the quay at half price.</div>`,
      price: whMax ? '' : priceChips(wc),
      action: itemAction(whMax ? 'Max' : 'Upgrade', 'buy-warehouse', {}, { disabled: whMax || !canPay(wc) }),
      cls: 'owned'
    });

    /* The chandler's three. Plain, cheap enough to own all of them early, and
       one obvious effect each — so the mechanic is understood long before an
       admiral's carving turns up. */
    h += sect('Figureheads', i++);
    h += itemGrid(SHOP_FIGS.map(k => {
      const d = FIGUREHEADS[k], owned = hasFig(k);
      /* Flavour in the caption slot, effect in the body. The other way round put
         the one thing you buy it for into small caps and wrapped it over three
         lines, while the line about the paintwork got the readable prose. */
      return itemCard({
        icon: 'figure', name: d.n, sub: d.sub,
        held: owned ? chipRow([chip('flag', 'OWNED', 'gold')], 'tight') : '',
        body: `<div class="sub">${esc(d.desc)}</div>`,
        price: owned ? '' : priceChips(d.cost),
        action: itemAction(owned ? 'Owned' : 'Buy', 'buy-fig', { key: k },
          { disabled: owned || !canPay(d.cost) }),
        cls: owned ? 'owned' : ''
      });
    }).join(''), 'rail');

    h += sect('Harbour', i++);
    h += itemCard({
      icon: 'port', name: 'Charted Ports', sub: 'Each keeps a contract open',
      held: chipRow([outOf('port', S.ports.length, Object.keys(PORTS).length, '', 'Ports charted')], 'tight'),
      body: `<div class="sub">${S.ports.map(p => PORTS[p].n).join(' · ')}</div>`
    });
  }

  $('main').innerHTML = h;
}

/* ---- stepper ---- */
function bump(key, d, max, redraw) {
  const cur = amount(key, max);
  const next = Math.max(1, Math.min(max == null ? 9999 : max, cur + d));
  if (next === cur) return;
  qty[key] = next;
  if (!refreshCard('itm_' + key[0] + '_' + key.slice(1), redraw())) render();
}

/* A deal done: pay up, pop the number off the button, redraw that card alone. */
function settle(cardId, btnSel, popText, popCls, popIcon, rebuild) {
  play('coin');
  pop(document.querySelector(btnSel), popText, popCls, popIcon);
  updateRes();
  save();
  if (!refreshCard(cardId, rebuild())) render();
}

/* ---- actions ---- */
function sellGood(key, n) {
  const g = GOODS[key];
  const out = Math.min(S.goods[key], Math.max(1, +n || 1));
  if (out <= 0) return;
  S.goods[key] -= out;
  const paid = out * g.sell;
  S.gold += paid;
  qty['g' + key] = 1;
  settle('itm_g_' + key, `#itm_g_${key} [data-act="sell-good"]`,
    '+' + paid, 'gold', 'gold', () => goodCard(key));
}

function buyWarehouse() {
  if (S.wh >= MAX_WAREHOUSE) return;
  const c = warehouseCost(S.wh);
  if (!canPay(c)) { deny('Not enough for that'); return; }
  pay(c);
  S.wh++;
  play('upgrade');
  save();
  render();
}

function buyFig(k) {
  const d = FIGUREHEADS[k];
  if (!d || !d.cost || hasFig(k)) return;
  if (!canPay(d.cost)) { deny('Not enough for that'); return; }
  pay(d.cost);
  S.figureheads = S.figureheads || [];
  S.figureheads.push(k);
  /* Rigged straight away if the bowsprit is bare — buying a thing and then
     having to go and turn it on is a step that exists for no reason. */
  if (!S.figurehead) S.figurehead = k;
  play('upgrade');
  save();
  render();
}

function buyBell() {
  if (S.bell >= MAX_BELL) return;
  const c = bellCost(S.bell);
  if (!canPay(c)) return deny('Cannot pay for that');
  pay(c);
  S.bell++;
  /* The point of a deeper bell is deeper wrecks, so buying one puts them on the
     chart there and then rather than quietly widening a range nobody can see. */
  rechartDives();
  award({
    icon: 'bell', kind: 'Salvage Gear', title: BELL_NAMES[S.bell],
    text: `Works down to depth ${bellMaxDepth(S.bell)}. New wrecks are on the chart.`,
    sound: 'upgrade', ok: 'Continue'
  });
  render();
}

function setTab(t) {
  if (tab === t) return;
  tab = t;
  play('ui_tap');
  render();
}

actions({
  'mkt-tab': d => setTab(d.tab),
  'good-qty': d => bump('g' + d.key, +d.d, S.goods[d.key], () => goodCard(d.key)),
  'sell-good': d => sellGood(d.good, d.n),
  'buy-bell': buyBell,
  'buy-warehouse': buyWarehouse,
  'buy-fig': d => buyFig(d.key)
});
