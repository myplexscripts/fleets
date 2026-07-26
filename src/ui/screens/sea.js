/* AT SEA — fleets on trade runs, with countdowns. */

import { $, esc, now } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { VOY_MAX_ACTIVE } from '../../core/config.js';
import { findShip, voyReady, rushCost, fmtDur } from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { fmt, goodsLine } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { collectVoyage } from '../../systems/voyages.js';

export function renderSea() {
  let i = 0;
  let h = `<div class="sect" style="--i:${i++}">Ships at Sea — ${S.voyages.length}/${VOY_MAX_ACTIVE}</div>`;

  if (!S.voyages.length) {
    h += `<div class="card" style="--i:${i++}"><div class="sub">Nothing at sea. Ships only sail for two reasons: to carry a <b>cargo contract</b> to its destination, or to <b>dive a wreck</b>. Both are on the Map — buy the goods a contract asks for in the Market first.</div></div>`;
    $('main').innerHTML = h;
    return;
  }

  S.voyages.slice().sort((a, b) => a.endsAt - b.endsAt).forEach(v => {
    const rdy = voyReady(v);
    const tot = (v.endsAt - v.startedAt) / 1000, left = (v.endsAt - now()) / 1000;
    const pct = Math.max(0, Math.min(100, (1 - left / tot) * 100));
    const crew = v.ships.map(id => { const s = findShip(id); return s ? s.name : '—'; }).join(', ');

    h += `<div class="card ${rdy ? 'ready' : 'atsea'}" style="--i:${i++}" data-voy="${v.id}">
      <div class="row"><h3>${esc(v.routeName)}</h3><span class="tag ${rdy ? 't0' : 'blu'}">${rdy ? 'MADE PORT' : 'AT SEA'}</span></div>
      <div class="sub">${esc(crew)}</div>
      <div class="sub">${manifest(v)}</div>
      <div class="vbar ${rdy ? 'done' : ''}"><i style="width:${rdy ? 100 : pct}%"></i></div>
      <div class="row" style="margin-top:8px">
        <span class="sub">${v.type === 'dive' ? 'No risk at this depth' : 'Arrives intact <b>' + v.odds + '%</b>'}</span>
        <span class="clock ${rdy ? 'done' : ''}" data-endsat="${v.endsAt}">${rdy ? 'READY' : fmtDur(left)}</span></div>
      <div class="row" style="margin-top:11px">
        ${rdy
          ? `<button class="btn sm grn" data-act="collect-voy" data-id="${v.id}">Collect</button>`
          : `<button class="btn sm blu" data-act="rush-voy" data-id="${v.id}">Speed Up · ${iconHTML('gold', 19)}${rushCost(v)}</button>
             <button class="btn sm red" data-act="recall-voy" data-id="${v.id}">Call Back</button>`}
      </div></div>`;
  });

  $('main').innerHTML = h;
}

/* What this fleet is actually out there doing. */
function manifest(v) {
  if (v.type === 'dive') {
    const takings = (v.chests || 0) * (v.chestValue || 0);
    return `${iconHTML('chest', 20)} ${v.chests} chest${v.chests === 1 ? '' : 's'} raised · <b style="color:var(--goldhi)">${takings}</b> gold on landing`
      + (fmt(v.rew) ? ` · ${fmt(v.rew)}` : '');
  }
  return `${iconHTML(v.good, 20)} ${goodsLine(v.good, v.qty)} → <b>${esc(v.dest || '—')}</b> · <b style="color:var(--goldhi)">${fmt(v.rew)}</b>`;
}

function rushVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v) return;
  const c = rushCost(v);
  if (S.gold < c) return toast('Not enough gold to speed that up.', 'bad');
  S.gold -= c;
  v.endsAt = now();
  play('arrive');
  toast('Voyage rushed — the fleet is docking now.', 'blu');
  render();
}

async function recallVoyage(id) {
  const v = S.voyages.find(x => x.id === id);
  if (!v) return;
  const ok = await confirmDlg({
    title: 'Signal Them Home?',
    text: `The ${v.routeName} run is abandoned where it stands. You lose the cargo and there is no payment.`,
    ok: 'Recall', cancel: 'Let Them Sail', danger: true
  });
  if (!ok) return;
  S.voyages = S.voyages.filter(x => x.id !== id);
  toast('Fleet recalled. Cargo and payment lost.', 'bad');
  render();
}

actions({
  'collect-voy': d => collectVoyage(d.id),
  'rush-voy': d => rushVoyage(d.id),
  'recall-voy': d => recallVoyage(d.id)
});
