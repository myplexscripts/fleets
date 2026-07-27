/* PORT — your ships: condition, repairs, scuttling. */

import { $, esc } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { SCRAP_YIELD } from '../../data/materials.js';
import {
  cond, condColor, tname, power, repairCost, isBusy, voyageOf, findShip, fmtDur, grant
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, shipChips, chip, chipRow, outOf, bagChips, priceChips } from '../format.js';
import { itemCard, itemAction, itemGrid, sect } from '../components.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { now } from '../../core/dom.js';

export function renderPort() {
  const f = S.flag, fc = cond(f), fBusy = isBusy('FLAG');
  let i = 0;

  let h = itemCard({
    icon: 'flag', name: f.name, sub: 'Flagship',
    held: chipRow([chip('hull', fBusy ? 'AT SEA' : fc, fBusy ? 'dim' : (fc === 'CRIPPLED' ? 'bad' : fc === 'DAMAGED' ? 'warn' : 'ok'))], 'tight'),
    body: shipChips(f, chip('power', power(f), '', 'Power')) + hullBar(f),
    action: itemAction('Upgrade', 'goto', { tab: 'flag' }),
    cls: 'owned' + (fBusy ? ' atsea' : '')
  });

  h += sect('Your Ships', i++, chipRow([
    outOf('crew', S.ships.length, S.docks, S.ships.length >= S.docks ? 'warn' : '', 'Berths in use')], 'tight'));

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
          <div class="shipmeta">${shipChips(s, chip('power', power(s), '', 'Power'))}${hullBar(s)}</div>
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
  if (isBusy(id)) return toast('That ship is away trading. Wait for it to return.', 'bad');
  if (s.hull >= s.max) return;
  const c = repairCost(s);
  if (S.gold < c) return toast('Not enough gold to repair that ship.', 'bad');
  S.gold -= c;
  s.hull = s.max;
  play('repair');
  toast('The ' + s.name + ' is fully repaired.');
  render();
}

async function doScuttle(id) {
  if (id === 'FLAG') return;
  if (isBusy(id)) return toast('That ship is away trading. Wait for it to return.', 'bad');
  const s = findShip(id);
  if (!s) return;
  const yld = SCRAP_YIELD[s.type];
  const ok = await confirmDlg({
    title: 'Scuttle the ' + s.name + '?',
    text: `She is struck from the register. This cannot be undone.`,
    chips: chipRow([bagChips(yld)], 'big'),
    ok: 'Scuttle', cancel: 'Keep Her', danger: true
  });
  if (!ok) return;
  grant(yld);
  S.ships = S.ships.filter(x => x.id !== id);
  toast('The ' + s.name + ' scuttled.');
  render();
}

actions({
  repair: d => doRepair(d.id),
  scuttle: d => doScuttle(d.id)
});
