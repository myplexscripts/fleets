/* PORT — your ships: condition, repairs, scuttling. */

import { $, esc } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions, actionSource } from '../../core/actions.js';
import { SCRAP_YIELD } from '../../data/materials.js';
import {
  cond, condColor, tname, power, repairCost, isBusy, voyageOf, findShip, fmtDur, grant,
  freeRepairOffered, canPay, pay
} from '../../core/selectors.js';
import { dockCost } from '../../core/economy.js';
import { FREE_REPAIR_TO } from '../../core/config.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, shipTiles, chip, chipRow, outOf, bagChips, priceChips, bag } from '../format.js';
import { itemCard, itemAction, itemGrid, sect } from '../components.js';
import { purseHTML } from '../hud.js';
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

  let h = purseHTML({ settings: true });

  h += itemCard({
    icon: 'flag', name: f.name, sub: 'Flagship',
    held: chipRow([chip('hull', fBusy ? 'AT SEA' : fc, fBusy ? 'dim' : (fc === 'CRIPPLED' ? 'bad' : fc === 'DAMAGED' ? 'warn' : 'ok'))], 'tight'),
    body: shipTiles(f, power(f)) + hullBar(f),
    price: f.hull >= f.max ? '' : priceChips({ gold: repairCost(f) }),
    action: freeFix + itemAction('Upgrade', 'goto', { tab: 'flag' }),
    cls: 'owned' + (fBusy ? ' atsea' : '')
  });

  /* Room for another ship is bought here rather than at a market counter,
     because the thing it changes is right underneath it. */
  const dc = dockCost();
  const full = S.ships.length >= S.docks;
  h += sect('Your Ships', i++, chipRow([
    outOf('crew', S.ships.length, S.docks, full ? 'warn' : '', 'Docks in use')], 'tight'));

  h += itemCard({
    icon: 'crew', name: 'Extra Dock', sub: 'Room for one more ship',
    body: chipRow([chip('crew', '+1', 'ok', 'One more ship can be kept')], 'tight'),
    price: priceChips(dc),
    action: itemAction('Buy', 'buy-dock', {}, { disabled: !canPay(dc) }),
    cls: 'dockcard'
  });

  if (!S.ships.length) {
    h += `<div class="card" style="--i:${i++}"><div class="sub center">No ships in port. Take one off an enemy.</div></div>`;
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
  }).join(''));

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
