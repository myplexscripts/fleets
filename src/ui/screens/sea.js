/* AT SEA — fleets on trade runs, with countdowns. */

import { $, esc, now } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions, actionSource } from '../../core/actions.js';
import { VOY_MAX_ACTIVE } from '../../core/config.js';
import { GOODS } from '../../data/goods.js';
import { findShip, voyReady, rushCost, fmtDur } from '../../core/selectors.js';
import { chip, chipRow, outOf, bagChips, priceChips } from '../format.js';
import { itemCard, itemAction, itemGrid, sect } from '../components.js';
import { say, deny, pop } from '../../fx/pop.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { collectVoyage } from '../../systems/voyages.js';

export function renderSea() {
  let i = 0;
  let h = sect('Ships at Sea', i++, chipRow([
    outOf('sea', S.voyages.length, VOY_MAX_ACTIVE, '', 'Fleets at sea')], 'tight'));

  if (!S.voyages.length) {
    h += `<div class="card" style="--i:${i++}"><div class="sub center">No ships at sea.</div></div>`;
    $('main').innerHTML = h;
    return;
  }

  const cards = [];
  S.voyages.slice().sort((a, b) => a.endsAt - b.endsAt).forEach(v => {
    const rdy = voyReady(v);
    const tot = (v.endsAt - v.startedAt) / 1000, left = (v.endsAt - now()) / 1000;
    const pct = Math.max(0, Math.min(100, (1 - left / tot) * 100));
    const crew = v.ships.map(id => { const s = findShip(id); return s ? s.name : '—'; }).join(', ');

    cards.push(itemCard({
      /* data-voy lets the world ticker patch this card's clock and bar every
         second without re-rendering the screen under the player's finger. */
      attrs: ` data-voy="${v.id}"`,
      icon: v.type === 'dive' ? 'chest' : v.good, name: v.routeName, sub: crew,
      held: chipRow([chip(rdy ? 'anchor' : 'sea', rdy ? 'IN PORT' : 'AT SEA',
        rdy ? 'ok' : 'dim')], 'tight'),
      body: `${manifest(v)}
        <div class="vbar ${rdy ? 'done' : ''}"><i style="width:${rdy ? 100 : pct}%"></i></div>
        ${chipRow([
          v.type === 'dive'
            ? chip('target', '100%', 'ok', 'A dive is never a fight')
            : chip('target', v.odds + '%', v.odds >= 85 ? 'ok' : v.odds >= 65 ? 'warn' : 'bad', 'Chance it arrives intact'),
          /* A live element, patched in place by the ticker — a countdown that
             only moves when the screen is rebuilt is not a countdown. */
          chip('time', `<span class="clock${rdy ? ' done' : ''}" data-endsat="${v.endsAt}">`
            + `${rdy ? 'READY' : fmtDur(left)}</span>`, rdy ? 'ok' : '', 'Time left')
        ], 'tight')}`,
      price: rdy ? '' : priceChips({ gold: rushCost(v) }),
      action: rdy
        ? itemAction('Collect', 'collect-voy', { id: v.id }, { cls: 'grn' })
        : itemAction('Recall', 'recall-voy', { id: v.id }, { cls: 'red' })
          + itemAction('Speed Up', 'rush-voy', { id: v.id }, { cls: 'blu' }),
      cls: rdy ? 'ready owned' : 'atsea'
    }));
  });

  h += itemGrid(cards.join(''));
  $('main').innerHTML = h;
}

/* What this fleet is actually out there doing, as chips. */
function manifest(v) {
  if (v.type === 'dive') {
    const takings = (v.chests || 0) * (v.chestValue || 0);
    return chipRow([
      chip('chest', v.chests, '', 'Chests raised'),
      chip('gold', takings, 'gold', 'Sold on the quay when they land'),
      bagChips(v.rew)
    ]);
  }
  const g = GOODS[v.good];
  return chipRow([
    chip(v.good, v.qty, '', g ? g.n + ' aboard' : 'Aboard'),
    chip('dest', esc(v.dest || '—'), '', 'Destination'),
    bagChips(v.rew)
  ]);
}

function rushVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v) return;
  const c = rushCost(v);
  if (S.gold < c) return deny(`Needs ${c} gold`);
  S.gold -= c;
  v.endsAt = now();
  play('arrive');
  say('Docking', 'ok', 'anchor');
  render();
}

async function recallVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v) return;
  const from = actionSource();
  const ok = await confirmDlg({
    title: 'Signal Them Home?',
    text: 'The cargo is lost and there is no payment.',
    ok: 'Recall', cancel: 'Cancel', danger: true
  });
  if (!ok) return;
  S.voyages = S.voyages.filter(x => x.id !== id);
  pop(from, 'Cargo lost', 'bad', 'cargo');
  render();
}

actions({
  'collect-voy': d => collectVoyage(d.id),
  'rush-voy': d => rushVoyage(d.id),
  'recall-voy': d => recallVoyage(d.id)
});
