/* FLAGSHIP — the one ship that is permanently yours. Upgrades and fittings. */

import { $, esc } from '../../core/dom.js';
import { S, syncFlag, save } from '../../core/state.js';
import { render } from '../../core/bus.js';
import { actions, actionSource } from '../../core/actions.js';
import { MAXTIER } from '../../core/config.js';
import { FLAGTIERS, FITTINGS, BOONS, tierCost } from '../../data/flagship.js';
import { FIGUREHEADS, FIG_KEYS } from '../../data/figureheads.js';
import { SETS, SET_KEYS } from '../../data/collectibles.js';
import {
  cond, condColor, power, repairCost, isBusy, canPay, pay, hasFit, hasFig,
  piecesOf, setComplete, totalPieces, completedSets
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { shipHTML } from '../../art/ships.js';
import { hullBar, chip, chipRow, outOf, priceChips } from '../format.js';
import { itemCard, itemAction, itemGrid, sect } from '../components.js';
import { say, deny, pop } from '../../fx/pop.js';
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
    ${itemCard({
      icon: 'flag', name: 'Condition', sub: bz ? 'At sea' : c,
      held: chipRow([chip('hull', Math.max(0, f.hull) + '<i>/</i>' + f.max,
        f.hull < f.max * 0.6 ? 'warn' : 'ok', 'Hull')], 'tight'),
      body: hullBar(f),
      price: f.hull >= f.max ? '' : priceChips({ gold: repairCost(f) }),
      action: itemAction('Rename', 'rename-flag', {}, { cls: '' })
        + itemAction(f.hull >= f.max ? 'No Repairs' : 'Repair', 'repair', { id: 'FLAG' },
            { disabled: f.hull >= f.max || bz }),
      cls: 'owned'
    })}`;

  if (S.flagBoons.length) {
    h += sect('Legendary Refits', i++);
    h += itemGrid(S.flagBoons.map(b => itemCard({
      icon: 'relic', name: BOONS[b].n, sub: BOONS[b].desc, cls: 'owned'
    })).join(''));
  }

  /* ---- upgrades: name, level, what one more gives, price, button ---- */
  h += sect('Upgrades', i++);
  h += itemGrid(Object.entries(FLAGTIERS).map(([k, d]) => {
    const t = f.tiers[k], maxed = t >= MAXTIER, cost = tierCost(k, t);
    return itemCard({
      icon: d.icon, name: d.n, sub: maxed ? 'Fully fitted' : 'Per level',
      held: `<span class="pips">${'●'.repeat(t)}${'○'.repeat(MAXTIER - t)}</span>`,
      body: chipRow([chip(d.stat, d.eff, 'ok', 'What one more level gives')], 'tight'),
      price: maxed ? '' : priceChips(cost),
      action: itemAction(maxed ? 'Max' : 'Upgrade', 'up-flag', { key: k },
        { disabled: maxed || !canPay(cost) }),
      cls: maxed ? 'owned' : ''
    });
  }).join(''));

  h += sect('Fittings', i++);
  h += itemGrid(Object.entries(FITTINGS).map(([k, d]) => {
    const owned = hasFit(k);
    return itemCard({
      icon: 'plate', name: d.n, sub: d.desc,
      held: owned ? chipRow([chip('flag', 'FITTED', 'gold')], 'tight') : '',
      price: owned ? '' : priceChips(d.cost),
      action: itemAction(owned ? 'Fitted' : 'Fit', 'buy-fit', { key: k },
        { disabled: owned || !canPay(d.cost) }),
      cls: owned ? 'owned' : ''
    });
  }).join(''));

  /* ---- Figureheads ----

     The one thing on this screen you SWAP rather than buy once. Everything
     above it is a ratchet — a tier bought is a tier owned — so this is the only
     place the flagship asks a question that stays open, and the owned carvings
     are shown together so the answer is a comparison rather than a purchase. */
  const owned = FIG_KEYS.filter(hasFig);
  h += sect('Figurehead', i++, chipRow([
    outOf('figure', owned.length, FIG_KEYS.length, 'gold', 'Carvings owned')], 'tight'));

  if (!owned.length) {
    h += `<div class="card" style="--i:${i++}"><div class="sub center">
      Her bowsprit is bare. The chandler at the Market carves plain ones; an
      admiral's is taken off her stern.</div></div>`;
  } else {
    h += itemGrid([
      /* Sailing without one is a real choice, so it is a card like the rest
         rather than an X on the one that is fitted. */
      itemCard({
        icon: 'flag', name: 'Bare Bowsprit', sub: 'No carving at all',
        held: !S.figurehead ? chipRow([chip('flag', 'RIGGED', 'gold')], 'tight') : '',
        action: itemAction(!S.figurehead ? 'Rigged' : 'Take Down', 'set-fig', { key: '' },
          { disabled: !S.figurehead, cls: 'quiet' }),
        cls: !S.figurehead ? 'owned' : ''
      }),
      ...owned.map(k => {
        const d = FIGUREHEADS[k];
        const on = S.figurehead === k;
        return itemCard({
          icon: 'figure', name: d.n, sub: d.sub,
          held: on ? chipRow([chip('flag', 'RIGGED', 'gold')], 'tight') : '',
          body: `<div class="sub">${esc(d.desc)}</div>`,
          action: itemAction(on ? 'Rigged' : 'Rig Her', 'set-fig', { key: k }, { disabled: on }),
          cls: on ? 'owned' : ''
        });
      })
    ].join(''));
  }

  /* ---- Captain's Quarters: the collection ---- */
  h += sect("Captain's Quarters", i++, chipRow([
    chip('relic', totalPieces(), 'gold', 'Pieces found'),
    outOf('star', completedSets(), SET_KEYS.length, 'gold', 'Sets completed')], 'tight'));

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
        return `<div class="piece ${got ? 'got' : ''}">${iconHTML('relic', 40)}<span>${got ? esc(pc) : '???'}</span></div>`;
      }).join('')}</div></div>`;
  });

  const loose = S.collected.loose || [];
  if (loose.length) {
    h += `<div class="card" style="--i:${i++}"><h3>Oddments</h3>
      <div class="pieces">${loose.map(pc => `<div class="piece got">${iconHTML('relic', 40)}<span>${esc(pc)}</span></div>`).join('')}</div></div>`;
  }

  $('main').innerHTML = h;
}

function upFlag(k) {
  const t = S.flag.tiers[k];
  if (t >= MAXTIER) return;
  const c = tierCost(k, t);
  if (!canPay(c)) return deny('Cannot pay for that');
  pay(c);
  S.flag.tiers[k]++;
  syncFlag();
  play('upgrade');
  say(FLAGTIERS[k].eff, 'ok', FLAGTIERS[k].icon);
  render();
}

/* One at a time. Swapping is free and instant — a figurehead you have to pay
   to change is a figurehead nobody ever changes. */
function setFig(k) {
  const key = k || null;
  if (key && !hasFig(key)) return;
  if (S.figurehead === key) return;
  S.figurehead = key;
  play('upgrade');
  save();
  render();
}

function buyFit(k) {
  if (hasFit(k)) return;
  const d = FITTINGS[k];
  if (!canPay(d.cost)) return deny('Cannot pay for that');
  pay(d.cost);
  S.flag.fittings.push(k);
  play('upgrade');
  say('Fitted', 'ok', 'relic');
  render();
}

async function renameFlag() {
  const from = actionSource();
  const n = await promptDlg({
    title: 'Name Your Flagship',
    text: 'A ship answers to her name. Choose well.',
    value: S.flag.name, ok: 'Rename', max: 20
  });
  if (n == null) return;
  const trimmed = n.trim().slice(0, 20);
  if (!trimmed) return;
  S.flag.name = trimmed;
  pop(from, 'Renamed', 'gold', 'flag');
  render();
}

actions({
  'up-flag': d => upFlag(d.key),
  'buy-fit': d => buyFit(d.key),
  'set-fig': d => setFig(d.key),
  'rename-flag': renameFlag
});

/* port.js owns repair; re-exported so the flagship card can reuse the action. */
export { doRepair };
