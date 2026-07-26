/* The mission sheet: pick a line of up to three ships, then Attack or Trade. */

import { $, esc } from '../core/dom.js';
import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { VOY_MAX_ACTIVE, VOY_SEC_PER_DAY, SEC_PER_WIN, SEC_DECAY_PER_MIN } from '../core/config.js';
import { DNAMES, DCOLORS, MTYPE, REGIONS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { TYPES } from '../data/ships.js';
import {
  routeById, allShips, findShip, busyIds, tname, power, fleetPower, fleetHull,
  effDanger, secNow, canVoyage, voyageOpen, voyDuration, tradeChance, salvageChance,
  notoGain, chartersAt, fmtDur
} from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { fmt, prizeDesc } from './format.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { wipe } from '../fx/wipe.js';
import { tutEvent, tutActive, refreshTut } from './tutorial.js';
import { launchVoyage } from '../systems/voyages.js';
import { startBattle } from '../battle/loop.js';
import { bossEnemies, charterEnemies, genEnemies, tutEnemies } from '../systems/enemies.js';
import { battleVictory, charterVictory, bossVictory, battleLoss } from '../systems/outcomes.js';

let sel = [];               // chosen ship ids, in tap order
let curRoute = null;
let sheetMode = 'battle';

export function openMission(id) {
  /* During the scripted opening, only the tutorial lane may be opened. */
  if (tutActive() && S.tut <= 3 && id !== 'c1') {
    toast('Tap the green marker near home port to continue.', 'bad');
    return;
  }
  const r = routeById(id);
  if (!r) return;

  curRoute = r;
  sel = [];
  sheetMode = 'battle';
  tutEvent('route:' + id);
  if (r.type === 'boss') play('boss_horn');
  if (r.type === 'charter') play('relic');

  drawMission();
  openSheet();
}

function setMode(m) {
  sheetMode = m;
  sel = [];
  drawMission();
}

function togSel(id) {
  const i = sel.indexOf(id);
  if (i > -1) sel.splice(i, 1);
  else {
    if (sel.length >= 3) return;
    sel.push(id);
  }
  if (sel.length >= 2) tutEvent('ships:2');
  drawMission();
}

function drawMission() {
  const r = curRoute, d = effDanger(r), sec = secNow(r.id);
  const isBoss = r.type === 'boss', isCh = r.type === 'charter', voyable = canVoyage(r);
  const already = S.voyages.find(v => v.routeId === r.id);
  const fleet = sel.map(findShip).filter(Boolean);
  const fp = fleetPower(fleet), fh = fleetHull(fleet);
  const cap = fleet.reduce((a, s) => a + s.cargo, 0);
  const slots = sheetMode === 'battle'
    ? ['FRONT · FIRES FIRST', 'CENTER · +25% DAMAGE', 'REAR · TAKES 25% LESS']
    : ['LEAD', 'ESCORT', 'ESCORT'];
  const bz = busyIds();

  let picks = '';
  allShips().forEach(s => {
    const i = sel.indexOf(s.id);
    const crip = s.hull <= 0, atSea = bz.has(s.id), dis = crip || atSea, isF = s.id === 'FLAG';
    picks += `<div class="pick ${i > -1 ? 'sel' : ''} ${dis ? 'dis' : ''} ${isF ? 'flag' : ''}"
        ${dis ? '' : `data-act="pick-ship" data-id="${s.id}"`}>
      <div class="row"><b>${isF ? iconHTML('flag', 21) + ' ' : ''}${esc(s.name)}</b>${i > -1 ? `<span class="slot ${sheetMode === 'voyage' ? 'blu' : ''}">${slots[i]}</span>` : ''}</div>
      <div class="sub">${tname(s)} · pwr ${power(s)} · hull ${Math.max(0, s.hull)}/${s.max} · cargo ${s.cargo}${crip ? ' · CRIPPLED' : ''}${atSea ? ' · AT SEA' : ''}</div></div>`;
  });

  /* Charter extras: what it opens, what it pays, what else is on offer here. */
  const c = r.charterDef;
  let extraLine = '';
  if (isCh) {
    const others = chartersAt(c.loc).filter(x => x.id !== c.id);
    extraLine =
      (c.dest ? `Carry it through and the port of <b>${PORTS[c.dest].n}</b> opens to you for good. ` : '') +
      (c.prize ? `<b style="color:var(--goldhi)">${esc(prizeDesc(c.prize))}</b>. ` : '') +
      (others.length
        ? `<span class="sub">Also on offer here: ${others.map(o =>
            `<button class="linkbtn" data-act="mission" data-id="ch_${o.id}">${esc(o.n)}</button>`).join(', ')}</span>`
        : '');
  }

  $('sheetHead').innerHTML = `<div class="row"><h3>${esc(r.n)}</h3>
      <span class="tag ${isCh ? 'gold' : 't' + d}">${isBoss ? esc(r.bossDef.title.toUpperCase()) : (isCh ? 'TIER ' + c.t : DNAMES[d])}</span></div>
    <div class="dbar"><i style="width:${(d + 1) * 25}%;background:${DCOLORS[d]}"></i></div>
    ${!isBoss && !isCh
      ? `<div class="secbar ${d <= 1 ? 'clear' : ''}"><i style="width:${sec}%"></i></div>
         <div class="sub" style="margin-top:4px">Lane security ${Math.round(sec)}% — falls ${SEC_DECAY_PER_MIN}% every minute. Higher security means lower danger.</div>`
      : ''}
    <div class="row" style="margin-top:8px"><span class="mtype ${isBoss ? 'boss' : (isCh ? 'gold' : '')}">${MTYPE[r.type].n}</span></div>
    <div class="sub quote" style="margin-top:6px">${esc(isBoss ? r.bossDef.desc : MTYPE[r.type].tip)}</div>`;

  let body = '';
  if (voyable && !isBoss && !isCh) {
    body += `<div class="modetabs">
      <button id="modeBat" class="${sheetMode === 'battle' ? 'on' : ''}" data-act="mission-mode" data-mode="battle">Attack</button>
      <button id="modeVoy" class="${sheetMode === 'voyage' ? 'on' : ''}" data-act="mission-mode" data-mode="voyage">Trade</button></div>`;
  }
  if (extraLine) body += `<div class="card chartercard" style="--i:0"><div class="sub">${extraLine}</div></div>`;

  if (sheetMode === 'voyage') {
    const dur = fleet.length ? voyDuration(r, fleet) : r.len * VOY_SEC_PER_DAY;
    const odds = r.type === 'salvage' ? salvageChance(r, fh) : tradeChance(r, fp);
    const cargoOK = !r.cargo || (cap >= r.cargo && S.cargo >= r.cargo);
    const slotOK = S.voyages.length < VOY_MAX_ACTIVE;
    const open = voyageOpen(r);

    body += `<div class="sub" style="margin-bottom:10px">Pick up to three ships to send trading. They leave your fleet for the time shown below and cannot fight until they return.</div>
      <div id="shipPicks">${picks}</div>
      <div class="card" style="--i:1"><div class="sub">
        ${!open ? `<b style="color:var(--org)">Traders will not sail here while the lane rates ${DNAMES[d].toLowerCase()}. Attack it first to bring the danger down.</b><br>` : ''}
        ${already ? `<b style="color:var(--blu)">You already have a fleet trading this lane.</b><br>` : ''}
        Time away: <b>${fleet.length ? fmtDur(dur) : '—'}</b>${fleet.length ? ' of real time — faster ships get back sooner' : ''}<br>
        ${r.cargo ? `Cargo: needs ${r.cargo} units · your ships can hold ${cap} · you own ${S.cargo}<br>` : ''}
        ${r.type === 'salvage'
          ? `Chance of raising the wreck: <b>${odds}%</b> (your fleet hull ${fh} against ${r.hullreq} needed)<br>`
          : `Chance of arriving safely: <b>${fleet.length ? odds + '%' : '—'}</b> — fail and you lose the cargo<br>`}
        Notoriety on return: <b style="color:var(--gold)">+${notoGain(r)}</b> — fills the regional bar that summons the admiral<br>
        Reward: <b style="color:var(--goldhi)">${fmt(r.rew)}</b>${r.ship ? ` · you may also raise a wrecked ${TYPES[r.ship.type].n}` : ''}${r.final ? ' · THE FINAL VOYAGE' : ''}</div></div>
      <div class="grid2">
        <button class="btn" data-act="close-sheet">Cancel</button>
        <button class="btn blu" id="sailBtn" ${sel.length && cargoOK && open && !already && slotOK ? '' : 'disabled'} data-act="send-ships">Send Ships</button></div>
      ${!slotOK ? `<div class="sub center warnline">You can only have ${VOY_MAX_ACTIVE} fleets trading at once. Collect one first.</div>` : ''}
      ${r.cargo && !cargoOK ? `<div class="sub center warnline">Not enough cargo goods, or not enough hold space to carry them. Buy goods in the Market.</div>` : ''}`;
  } else {
    const flagOK = !isBoss || sel.includes('FLAG');
    body += `<div class="sub" style="margin-bottom:10px">Pick up to three ships. The order you pick sets their position in the line — tap order matters.${isBoss ? ' <b style="color:var(--goldhi)">Your flagship sails or nobody does.</b>' : ''}</div>
      <div id="shipPicks">${picks}</div>
      <div class="card ${isBoss ? 'bosscard' : ''}" style="--i:1"><div class="sub">
        Your fleet power <b style="color:${fp >= r.power ? 'var(--grn)' : 'var(--yel)'}">${fp}</b>${r.power ? ' — ' + r.power + ' recommended' : ''}<br>
        ${!isBoss && !isCh ? `Winning adds <b style="color:var(--gold)">+${SEC_PER_WIN}%</b> lane security, which lowers the danger rating<br>` : ''}
        Notoriety on victory: <b style="color:var(--gold)">+${notoGain(r)}</b> — fills the regional bar that summons the admiral<br>
        Reward: <b style="color:var(--goldhi)">${fmt(r.rew)}</b>${isBoss && r.bossDef.unlocks ? ' · opens ' + REGIONS[r.bossDef.unlocks].n : ''}</div></div>
      <div class="grid2">
        <button class="btn" data-act="close-sheet">Cancel</button>
        <button class="btn ${isBoss ? 'red' : 'gold'}" id="sailBtn" ${sel.length && flagOK ? '' : 'disabled'} data-act="attack">${isCh ? 'Accept' : 'Attack'}</button></div>
      ${!flagOK ? '<div class="sub center warnline">Admirals only fight your flagship. Add it to the line.</div>' : ''}`;
  }

  $('sheetBody').innerHTML = body;
  refreshTut();
}

function doSendShips() {
  const fleet = sel.map(findShip).filter(Boolean);
  if (!launchVoyage(curRoute, fleet)) return;
  tutEvent('voyage:launch');
  closeSheet();
}

function doAttack() {
  const r = curRoute;
  const fleet = sel.map(findShip).filter(Boolean);
  /* The tutorial's first fight is fixed and winnable. */
  const forcedTut = tutActive() && S.tut <= 6 && r.id === 'c1';
  tutEvent('launch');

  const o = $('overlay');
  o.classList.remove('vis');
  o.classList.remove('on');

  if (r.type === 'boss') {
    const b = r.bossDef;
    wipe(() => startBattle(fleet, bossEnemies(b), false,
      (win, enemies) => (win ? bossVictory(b, enemies) : battleLoss(r, b)), b));
    return;
  }
  if (r.type === 'charter') {
    wipe(() => startBattle(fleet, charterEnemies(r.charterDef), false,
      (win, enemies) => (win ? charterVictory(r, enemies) : battleLoss(r))));
    return;
  }
  wipe(() => startBattle(fleet, forcedTut ? tutEnemies() : genEnemies(r), r.type === 'escort' && !forcedTut,
    (win, enemies) => (win ? battleVictory(r, enemies) : battleLoss(r))));
}

actions({
  mission: d => openMission(d.id),
  'mission-mode': d => setMode(d.mode),
  'pick-ship': d => togSel(d.id),
  'send-ships': doSendShips,
  attack: doAttack,
  'close-sheet': closeSheet
});
