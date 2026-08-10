/* PORT — your ships: condition, repairs, scuttling. */

import { $, esc } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions, actionSource } from '../../core/actions.js';
import { SCRAP_YIELD } from '../../data/materials.js';
import {
  cond, tname, power, repairCost, isBusy, voyageOf, findShip, fmtDur, grant,
  freeRepairOffered, canPay, pay
} from '../../core/selectors.js';
import { dockCost } from '../../core/economy.js';
import { FREE_REPAIR_TO } from '../../core/config.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, shipTiles, chip, chipRow, outOf, bagChips, priceChips, bag } from '../format.js';
import { itemCard, itemAction, itemGrid, sect, emptyCard } from '../components.js';
import { say, deny, pop } from '../../fx/pop.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { now } from '../../core/dom.js';

export function renderPort() {
  const f = S.flag, fc = cond(f), fBusy = isBusy('FLAG');
  let i = 0;

  /* The free repair only exists when the paid one is out of reach. A captain
     with a holed fleet, an empty purse and nothing in the hold would otherwise
     have a dead save, since nothing in the game buys materials back. It appears
     when it is needed and is invisible the rest of the time. */
  const freeFix = !fBusy && freeRepairOffered()
    ? itemAction('Free Repair', 'free-repair', {}, { cls: 'grn' })
    : '';

  /* No purse of its own any more: gold, the stores and the settings wheel
     are on the scene bar, which every screen has and which does not scroll. */
  let h = itemCard({
    icon: 'flag', name: f.name, sub: 'Flagship',
    held: chipRow([chip('hull', fBusy ? 'AT SEA' : fc, fBusy ? 'dim' : (fc === 'CRIPPLED' ? 'bad' : fc === 'DAMAGED' ? 'warn' : 'ok'))], 'tight'),
    body: shipTiles(f, power(f)) + hullBar(f),
    price: f.hull >= f.max ? '' : priceChips({ gold: repairCost(f) }),
    action: freeFix + itemAction('Upgrade', 'goto', { tab: 'flag' }),
    cls: 'owned' + (fBusy ? ' atsea' : '')
  });

  /* Room for another ship is bought here rather than at a market counter,
     because the thing it changes is right underneath it.

     It used to be a full item card of its own — a glyph, a name, a subtitle and
     a price row, all to say "+1". That is a lot of screen for a number that is
     already on the line above it, and it pushed the fleet itself below the fold
     on a phone. It is a button on the counter now: the count and the way to
     raise it in the same place, which is where a player looking at "4/4" is
     already looking. */
  const dc = dockCost();
  const full = S.ships.length >= S.docks;
  h += sect('Your Ships', i++,
    outOf('crew', S.ships.length, S.docks, full ? 'warn' : '', 'Docks in use')
    /* Buying a berth is a top-up, not the thing you came here for, so it is
       the quiet face at the end of the heading with its price beside it —
       not a full-size gold key, which made the loudest object on the Port
       screen a button nobody presses twice a session. It goes gold only when
       every dock is full, which is the moment it stops being a top-up and
       starts being the thing in the way. */
    + `<button class="btn sm ${full ? 'gold urge' : 'quiet'} dockbuy" data-act="buy-dock"
        ${canPay(dc) ? '' : 'disabled'}
        title="Another dock — ${dc.gold} gold">Berth
        <span class="dockprice">${dc.gold}</span></button>`, 'sectctl');

  if (!S.ships.length) {
    h += emptyCard('anchor', 'No ships in port. A hull joins your fleet only by being taken off an enemy.', i++);
  }

  h += itemGrid(S.ships.map(s => {
    const c = cond(s), bz = isBusy(s.id), v = bz ? voyageOf(s.id) : null;
    const whole = s.hull >= s.max;
    return itemCard({
      name: s.name, sub: tname(s) + (bz ? ' · ' + v.routeName : ''),
      held: chipRow([chip('hull', bz ? 'AT SEA' : c,
        bz ? 'dim' : (c === 'CRIPPLED' ? 'bad' : c === 'DAMAGED' ? 'warn' : 'ok'))], 'tight'),
      body: `<div class="shiprow">
          <div class="fleetship">${shipHTML(s.type, 'player', 1.0, bz ? 'sea' : '')}</div>
          <div class="shipmeta">${shipTiles(s, power(s))}${hullBar(s)}</div>
        </div>`,
      price: bz
        ? chipRow([chip('time', fmtDur((v.endsAt - now()) / 1000), 'dim', 'Home in')], 'tight')
        : (whole ? '' : priceChips({ gold: repairCost(s) })),
      /* Scuttle is always the lesser of the two, so Repair keeps the primary
         slot on the right whether or not she needs it. */
      action: bz
        ? `<span class="clock" data-endsat="${v.endsAt}">${fmtDur((v.endsAt - now()) / 1000)}</span>`
        : itemAction('Scuttle', 'scuttle', { id: s.id }, { cls: 'red' })
          + itemAction(whole ? 'No Repairs' : 'Repair', 'repair', { id: s.id }, { disabled: whole }),
      cls: bz ? 'atsea' : ''
    });
  }).join(''), 'rail');

  $('main').innerHTML = h;
}

export function doRepair(id) {
  const s = findShip(id);
  if (!s) return;
  if (isBusy(id)) return deny('She is at sea');
  if (s.hull >= s.max) return;
  const c = repairCost(s);
  if (S.gold < c) return deny(`Needs ${c} gold`);
  const mend = s.max - s.hull;
  S.gold -= c;
  s.hull = s.max;
  play('repair');
  say('+' + mend, 'ok', 'hull');
  render();
}

async function doScuttle(id) {
  if (id === 'FLAG') return;
  if (isBusy(id)) return deny('She is at sea');
  /* Grabbed before the dialog: by the time it resolves the card is going. */
  const from = actionSource();
  const s = findShip(id);
  if (!s) return;
  const yld = SCRAP_YIELD[s.type];
  const ok = await confirmDlg({
    title: 'Scuttle the ' + s.name + '?',
    text: `She is struck from the register. This cannot be undone.`,
    chips: chipRow([bagChips(yld)], 'big'),
    ok: 'Scuttle', cancel: 'Cancel', danger: true
  });
  if (!ok) return;
  grant(yld);
  S.ships = S.ships.filter(x => x.id !== id);
  pop(from, bag(yld, 40), 'ok');
  render();
}

/* Patch her up with what is already aboard. Partial, free, and only ever
   reachable when paying for a proper repair is not. */
function doFreeRepair() {
  const f = S.flag;
  if (isBusy('FLAG')) return deny('She is at sea');
  if (!freeRepairOffered()) return deny('She is sound');

  const to = Math.max(f.hull, Math.round(f.max * FREE_REPAIR_TO));
  const mend = to - f.hull;
  f.hull = to;
  play('repair');
  say('+' + mend, 'ok', 'hull');
  render();
}

/* Another dock. Each one costs more than the last, so a big fleet is a real
   decision rather than something that just accumulates. */
function buyDock() {
  const c = dockCost();
  if (!canPay(c)) return deny('Cannot pay for that');
  pay(c);
  S.docks++;
  play('upgrade');
  say('+1', 'ok', 'crew');
  render();
}

actions({
  'buy-dock': buyDock,
  repair: d => doRepair(d.id),
  scuttle: d => doScuttle(d.id),
  'free-repair': doFreeRepair
});
