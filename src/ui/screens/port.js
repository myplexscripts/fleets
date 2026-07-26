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
import { hullBar } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';
import { confirmDlg } from '../dialog.js';
import { now } from '../../core/dom.js';

export function renderPort() {
  const f = S.flag, fc = cond(f), fBusy = isBusy('FLAG');
  let i = 0;

  let h = `<div class="card flagcard ${fBusy ? 'atsea' : ''}" style="--i:${i++}"><div class="row">
      <div><h3 style="color:var(--goldhi)">${iconHTML('flag', 24)} ${esc(f.name)}</h3>
      <div class="sub">Flagship · hull ${Math.max(0, f.hull)}/${f.max} · <span style="color:${condColor(fc)}">${fc}</span>${fBusy ? ' · <b style="color:var(--blu)">AT SEA</b>' : ''}</div></div>
      <button class="btn sm gold" data-act="goto" data-tab="flag">Upgrade</button></div></div>`;

  h += `<div class="sect" style="--i:${i++}">Your Ships — ${S.ships.length}/${S.docks} berths</div>`;

  if (!S.ships.length) {
    h += `<div class="card sub" style="--i:${i++}">No ships in port. Buy one in the Market.</div>`;
  }

  S.ships.forEach(s => {
    const c = cond(s), bz = isBusy(s.id), v = bz ? voyageOf(s.id) : null;
    i++;
    h += `<div class="card ${bz ? 'atsea' : ''}" style="--i:${i}"><div class="shiprow">
      <div class="fleetship">${shipHTML(s.type, 'player', 1.0, bz ? 'sea' : '')}</div>
      <div class="shipmeta">
        <div class="row"><h3>${esc(s.name)}</h3>
          <span class="statechip" style="color:${bz ? 'var(--blu)' : condColor(c)}">${bz ? 'AT SEA' : c}</span></div>
        <div class="sub">${tname(s)} · Power ${power(s)}${bz ? ' · ' + esc(v.routeName) : ''}</div>
        ${hullBar(s)}
        <div class="stats"><span>SPD <b>${s.speed}</b></span><span>GUNS <b>${s.guns}</b></span><span>HULL <b>${Math.max(0, s.hull)}/${s.max}</b></span><span>CARGO <b>${s.cargo}</b></span></div>
        ${bz
          ? `<div class="row" style="margin-top:11px"><span class="sub">Home in</span>
             <span class="clock" data-endsat="${v.endsAt}">${fmtDur((v.endsAt - now()) / 1000)}</span></div>`
          : `<div class="row" style="margin-top:11px">
             <button class="btn sm" ${s.hull >= s.max ? 'disabled' : ''} data-act="repair" data-id="${s.id}">${s.hull >= s.max ? 'No Repairs' : 'Repair · ' + iconHTML('gold', 19) + repairCost(s)}</button>
             <button class="btn sm red" data-act="scuttle" data-id="${s.id}">Break Up</button></div>`}
      </div></div></div>`;
  });

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
    title: 'Break Her Up?',
    text: `The ${s.name} comes apart for ${yld.wood} timber, ${yld.metal} ingots and ${yld.cloth} bolts of cloth, and is struck from the register. This cannot be undone.`,
    ok: 'Break Her Up', cancel: 'Keep Her', danger: true
  });
  if (!ok) return;
  grant(yld);
  S.ships = S.ships.filter(x => x.id !== id);
  toast('The ' + s.name + ' broken up for timber, metal and cloth.');
  render();
}

actions({
  repair: d => doRepair(d.id),
  scuttle: d => doScuttle(d.id)
});
