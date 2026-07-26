/* FLAGSHIP — the one ship that is permanently yours. Upgrades and fittings. */

import { $, esc } from '../../core/dom.js';
import { S, syncFlag } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions } from '../../core/actions.js';
import { MAXTIER } from '../../core/config.js';
import { FLAGTIERS, FITTINGS, BOONS, tierCost } from '../../data/flagship.js';
import { SETS, SET_KEYS } from '../../data/collectibles.js';
import {
  cond, condColor, power, repairCost, isBusy, canPay, pay, hasFit,
  piecesOf, setComplete, totalPieces, completedSets
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, chip, chipRow, priceChips } from '../format.js';
import { toast } from '../../fx/toast.js';
import { play } from '../../fx/sound.js';
import { promptDlg } from '../dialog.js';
import { doRepair } from './port.js';

/* Hero stat: the glyph carries the meaning, the word is only a caption. */
const hstat = (icon, val, label) =>
  `<div class="hstat">${iconHTML(icon, 0, 'hstatic')}<b>${val}</b><span>${label}</span></div>`;

export function renderFlagship() {
  const f = S.flag, c = cond(f), bz = isBusy('FLAG');
  let i = 2;

  let h = `<div class="hero">
      <div class="heroStage">${shipHTML('flagship', 'flag', 2.6, bz ? 'sea' : '')}</div>
      <div class="hname">${esc(f.name)}</div>
      <div class="hsub">${bz ? 'Presently at sea under your colours' : 'Riding at anchor, awaiting your word'}</div>
      <div class="hstats">
        ${hstat('speed', f.speed, 'Speed')}
        ${hstat('guns', f.guns, 'Guns')}
        ${hstat('hull', `${Math.max(0, f.hull)}<span class="of">/${f.max}</span>`, 'Hull')}
        ${hstat('cargo', f.cargo, 'Cargo')}
        ${hstat('power', power(f), 'Power')}
      </div></div>
    <div class="card flagcard" style="--i:1">
      <div class="row"><h3 style="color:var(--goldhi)">Condition</h3>
        <span class="statechip" style="color:${bz ? 'var(--blu)' : condColor(c)}">${bz ? 'AT SEA' : c}</span></div>
      ${hullBar(f)}
      <div class="row" style="margin-top:11px">
        <button class="btn sm" ${f.hull >= f.max || bz ? 'disabled' : ''} data-act="repair" data-id="FLAG">${f.hull >= f.max ? 'No Repairs' : 'Repair'}</button>
        ${f.hull >= f.max ? '' : priceChips({ gold: repairCost(f) })}
        <button class="btn sm" data-act="rename-flag">Rename</button>
      </div></div>`;

  if (S.flagBoons.length) {
    h += `<div class="card flagcard" style="--i:${i++}"><h3 style="color:var(--goldhi)">Legendary Refits</h3>
      ${S.flagBoons.map(b => `<div class="upline"><b>${esc(BOONS[b].n)}</b><span>${esc(BOONS[b].desc)}</span></div>`).join('')}</div>`;
  }

  /* ---- upgrades: name, what one level gives, pips, price, button ---- */
  h += `<div class="sect" style="--i:${i++}">Upgrades</div>`;
  Object.entries(FLAGTIERS).forEach(([k, d]) => {
    const t = f.tiers[k], maxed = t >= MAXTIER, cost = tierCost(k, t), can = !maxed && canPay(cost);
    h += `<div class="card uprow" style="--i:${i++}">
      <div class="row">
        <h3>${iconHTML(d.icon, 30)} ${d.n}</h3>
        <span class="pips">${'●'.repeat(t)}${'○'.repeat(MAXTIER - t)}</span>
      </div>
      <div class="row">
        ${chipRow([chip(d.stat, d.eff, 'ok', 'Per level')], 'tight')}
        <button class="btn sm gold" ${can ? '' : 'disabled'} data-act="up-flag" data-key="${k}">${maxed ? 'MAX' : 'Upgrade'}</button>
      </div>
      ${maxed ? '' : priceChips(cost)}</div>`;
  });

  h += `<div class="sect" style="--i:${i++}">Fittings</div>`;
  Object.entries(FITTINGS).forEach(([k, d]) => {
    const owned = hasFit(k), can = !owned && canPay(d.cost);
    h += `<div class="card uprow ${owned ? 'owned' : ''}" style="--i:${i++}">
      <div class="row">
        <h3 style="${owned ? 'color:var(--goldhi)' : ''}">${d.n}</h3>
        <button class="btn sm gold" ${can ? '' : 'disabled'} data-act="buy-fit" data-key="${k}">${owned ? 'FITTED' : 'Fit'}</button>
      </div>
      <div class="upline"><span>${d.desc}</span></div>
      ${owned ? '' : priceChips(d.cost)}</div>`;
  });

  /* ---- Captain's Quarters: the collection ---- */
  h += `<div class="sect" style="--i:${i++}">Captain's Quarters — ${totalPieces()} pieces · ${completedSets()}/${SET_KEYS.length} sets</div>`;

  SET_KEYS.forEach(key => {
    const set = SETS[key];
    const have = piecesOf(key);
    const done = setComplete(key);
    h += `<div class="card ${done ? 'setdone' : ''}" style="--i:${i++}">
      <div class="row"><h3${done ? ' style="color:var(--goldhi)"' : ''}>${esc(set.n)}</h3>
        <span class="tag ${done ? 'gold' : ''}">${have.length}/${set.pieces.length}</span></div>
      <div class="setbar ${done ? 'full' : ''}"><i style="width:${have.length / set.pieces.length * 100}%"></i></div>
      <div class="pieces">${set.pieces.map(pc => {
        const got = have.includes(pc);
        return `<div class="piece ${got ? 'got' : ''}">${iconHTML('relic', 20)}<span>${got ? esc(pc) : '???'}</span></div>`;
      }).join('')}</div></div>`;
  });

  const loose = S.collected.loose || [];
  if (loose.length) {
    h += `<div class="card" style="--i:${i++}"><h3>Oddments</h3>
      <div class="pieces">${loose.map(pc => `<div class="piece got">${iconHTML('relic', 20)}<span>${esc(pc)}</span></div>`).join('')}</div></div>`;
  }

  $('main').innerHTML = h;
}

function upFlag(k) {
  const t = S.flag.tiers[k];
  if (t >= MAXTIER) return;
  const c = tierCost(k, t);
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
