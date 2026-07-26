/* FLAGSHIP — the one ship that is permanently yours. Upgrades and fittings. */

import { $, esc } from '../../core/dom.js';
import { S, syncFlag } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { MAXTIER } from '../../core/config.js';
import { FLAGTIERS, FITTINGS, BOONS, tierCost } from '../../data/flagship.js';
import { cond, condColor, power, repairCost, isBusy, canPay, pay, hasFit } from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, costStr } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';
import { promptDlg } from '../dialog.js';
import { doRepair } from './port.js';

export function renderFlagship() {
  const f = S.flag, c = cond(f), bz = isBusy('FLAG');
  let i = 2;

  let h = `<div class="hero">
      <div class="heroStage">${shipHTML('flagship', 'flag', 2.6, bz ? 'sea' : '')}</div>
      <div class="hname">${esc(f.name)}</div>
      <div class="hsub">${bz ? 'Presently at sea under your colours' : 'Riding at anchor, awaiting your word'}</div>
      <div class="hstats">
        <div class="hstat"><b>${f.speed}</b><span>Speed</span></div>
        <div class="hstat"><b>${f.guns}</b><span>Guns</span></div>
        <div class="hstat"><b>${Math.max(0, f.hull)}<span class="of">/${f.max}</span></b><span>Hull</span></div>
        <div class="hstat"><b>${f.cargo}</b><span>Cargo</span></div>
        <div class="hstat"><b>${power(f)}</b><span>Power</span></div>
      </div></div>
    <div class="card flagcard" style="--i:1">
      <div class="row"><h3 style="color:var(--goldhi)">Condition</h3>
        <span class="statechip" style="color:${bz ? 'var(--blu)' : condColor(c)}">${bz ? 'AT SEA' : c}</span></div>
      ${hullBar(f)}
      <div class="sub" style="margin-top:7px">Your flagship never takes up a berth and can never be scuttled. It is the only ship you can upgrade.</div>
      <div class="row" style="margin-top:11px">
        <button class="btn sm" ${f.hull >= f.max || bz ? 'disabled' : ''} data-act="repair" data-id="FLAG">${f.hull >= f.max ? 'No Repairs' : 'Repair · ' + iconHTML('reales', 19) + repairCost(f)}</button>
        <button class="btn sm" data-act="rename-flag">Rename</button>
      </div></div>`;

  if (S.flagBoons.length) {
    h += `<div class="card flagcard" style="--i:${i++}"><h3 style="color:var(--goldhi)">Legendary Refits</h3>
      <div class="sub">${S.flagBoons.map(b => `<b>${esc(BOONS[b].n)}</b> — ${esc(BOONS[b].desc)}`).join('<br>')}</div></div>`;
  }

  h += `<div class="sect" style="--i:${i++}">Upgrades</div>`;
  Object.entries(FLAGTIERS).forEach(([k, d]) => {
    const t = f.tiers[k], maxed = t >= MAXTIER, cost = tierCost(t), can = !maxed && canPay(cost);
    h += `<div class="card" style="--i:${i++}"><div class="row">
      <div style="flex:1"><h3>${iconHTML(d.icon, 30)} ${d.n}</h3>
        <div class="sub">${d.desc}<br><span class="pips">${'●'.repeat(t)}${'○'.repeat(MAXTIER - t)}</span></div></div>
      <button class="btn sm gold" ${can ? '' : 'disabled'} data-act="up-flag" data-key="${k}">${maxed ? 'MAX' : costStr(cost)}</button></div></div>`;
  });

  h += `<div class="sect" style="--i:${i++}">Fittings</div>`;
  Object.entries(FITTINGS).forEach(([k, d]) => {
    const owned = hasFit(k), can = !owned && canPay(d.cost);
    h += `<div class="card ${owned ? 'owned' : ''}" style="--i:${i++}"><div class="row">
      <div style="flex:1"><h3 style="${owned ? 'color:var(--goldhi)' : ''}">${d.n}</h3>
        <div class="sub">${d.desc}</div></div>
      <button class="btn sm gold" ${can ? '' : 'disabled'} data-act="buy-fit" data-key="${k}">${owned ? 'FITTED' : costStr(d.cost)}</button></div></div>`;
  });

  h += `<div class="sect" style="--i:${i++}">Captain's Quarters — ${S.relics.length} Relic${S.relics.length !== 1 ? 's' : ''}</div>`;
  h += S.relics.length
    ? `<div class="relicgrid">${S.relics.map(r => `<div class="relic">${iconHTML('relic', 26)}${esc(r)}</div>`).join('')}</div>`
    : `<div class="card sub" style="--i:${i++}">No relics yet. Relics are rewards from charters — the gold stars on the map.</div>`;

  $('main').innerHTML = h;
}

function upFlag(k) {
  const t = S.flag.tiers[k];
  if (t >= MAXTIER) return;
  const c = tierCost(t);
  if (!canPay(c)) return toast('Not enough to pay for that upgrade.', 'bad');
  pay(c);
  S.flag.tiers[k]++;
  syncFlag();
  play('upgrade');
  toast(FLAGTIERS[k].n + ' brought up to tier ' + S.flag.tiers[k] + '.', 'gold');
  render();
}

function buyFit(k) {
  if (hasFit(k)) return;
  const d = FITTINGS[k];
  if (!canPay(d.cost)) return toast('Not enough to pay for that upgrade.', 'bad');
  pay(d.cost);
  S.flag.fittings.push(k);
  play('upgrade');
  toast(d.n + ' fitted aboard the ' + S.flag.name + '.', 'gold');
  render();
}

async function renameFlag() {
  const n = await promptDlg({
    title: 'Name Your Flagship',
    text: 'A ship answers to her name. Choose well.',
    value: S.flag.name, ok: 'Christen Her', max: 20
  });
  if (n == null) return;
  const trimmed = n.trim().slice(0, 20);
  if (!trimmed) return;
  S.flag.name = trimmed;
  toast('Flagship renamed to ' + S.flag.name + '.');
  render();
}

actions({
  'up-flag': d => upFlag(d.key),
  'buy-fit': d => buyFit(d.key),
  'rename-flag': renameFlag
});

/* port.js owns repair; re-exported so the flagship card can reuse the action. */
export { doRepair };
