/* PORT — your ships: condition, repairs, scuttling. */

import { $, esc } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions, actionSource } from '../../core/actions.js';
import { SCRAP_YIELD } from '../../data/materials.js';
import {
  cond, condColor, tname, power, repairCost, isBusy, voyageOf, findShip, fmtDur, grant,
  careenReady, careenLeft, careenNeeded
} from '../../core/selectors.js';
import { CAREEN_COOLDOWN_MS, CAREEN_TO } from '../../core/config.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, shipTiles, chip, chipRow, outOf, bagChips, priceChips, bag } from '../format.js';
import { itemCard, itemAction, itemGrid, sect } from '../components.js';
import { say, deny, pop } from '../../fx/pop.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { now } from '../../core/dom.js';

export function renderPort() {
  const f = S.flag, fc = cond(f), fBusy = isBusy('FLAG');
  let i = 0;

  /* Careening: run her up the beach and work on the hull yourself. Free, slow,
     flagship only, and never as good as paying a shipwright — which is exactly
     what an emergency exit should be. Without it a captain with a holed fleet,
     an empty purse and nothing in the hold had a dead save, because no counter
     in the game buys materials back. */
  const canCareen = !fBusy && careenNeeded();
  /* On cooldown the button carries a live clock — the world ticker patches any
     .clock[data-endsat] in place, so it counts down without this screen having
     to rebuild itself once a second under the player's finger. */
  const careenBtn = careenReady()
    ? itemAction('Careen', 'careen', {}, { cls: 'grn', disabled: !canCareen })
    : `<button class="btn sm grn itemact" disabled>`
      + `<span class="clock" data-endsat="${S.careenAt}">${fmtDur(careenLeft() / 1000)}</span></button>`;

  let h = itemCard({
    icon: 'flag', name: f.name, sub: 'Flagship',
    held: chipRow([chip('hull', fBusy ? 'AT SEA' : fc, fBusy ? 'dim' : (fc === 'CRIPPLED' ? 'bad' : fc === 'DAMAGED' ? 'warn' : 'ok'))], 'tight'),
    body: shipTiles(f, power(f)) + hullBar(f),
    price: f.hull >= f.max ? '' : priceChips({ gold: repairCost(f) }),
    action: careenBtn + itemAction('Upgrade', 'goto', { tab: 'flag' }),
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
    ok: 'Scuttle', cancel: 'Keep Her', danger: true
  });
  if (!ok) return;
  grant(yld);
  S.ships = S.ships.filter(x => x.id !== id);
  pop(from, bag(yld, 40), 'ok');
  render();
}

/* Beach her, scrape her, and put her back in the water half sound. It costs
   real time rather than coin, so it can rescue a bankrupt captain without ever
   being the thing a solvent one would choose. */
function doCareen() {
  const f = S.flag;
  if (isBusy('FLAG')) return deny('She is at sea');
  if (!careenReady()) return deny('Not yet — she is still on the beach');
  if (f.hull >= f.max) return deny('She is sound');

  const to = Math.max(f.hull, Math.round(f.max * CAREEN_TO));
  const mend = to - f.hull;
  f.hull = to;
  S.careenAt = now() + CAREEN_COOLDOWN_MS;
  play('repair');
  say('+' + mend, 'ok', 'hull');
  render();
}

actions({
  repair: d => doRepair(d.id),
  scuttle: d => doScuttle(d.id),
  careen: doCareen
});
