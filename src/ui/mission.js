/* The mission sheet.

   A cargo run and a wreck dive are voyages; a patrol, escort, raid, blockade,
   charter or admiral is a fight. Trade is never gated behind a battle.

   A voyage sails under one ship — the question a cargo run asks is whether any
   single hull you own can take the consignment, and pooling three of them would
   answer it for free. A fight takes a line of up to three.

   A cargo lane whose danger has drifted above Safe also offers a SWEEP — take a
   battle line out and push that lane's danger back down a step. It is an escort
   job you choose to do, not a toll you have to pay: the lane was always open,
   sweeping just makes the next run through it a better bet. A Safe lane offers
   nothing to fight, which is the whole point.

   Everything numeric on this sheet is a chip: one glyph, one number. Where a
   number is a test rather than a reading it is written have/need, so the
   left-hand figure is what you have and the right is what the job wants. */

import { $, esc } from '../core/dom.js';
import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { VOY_MAX_ACTIVE, VOY_SHIPS, BATTLE_SHIPS, CARGO_PER_CHEST } from '../core/config.js';
import { DNAMES, DCOLORS, MTYPE, REGIONS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { BELL_NAMES, DEPTH_NAMES } from '../data/salvage.js';
import {
  routeById, allShips, findShip, busyIds, tname, fleetPower, holdCap,
  effDanger, patrolActive, patrolLeft, canVoyage, voyDuration, tradeChance,
  notoGain, chartersAt, fmtDur, goodsHeld, diveReachable, diveChests, chestValue,
  chestCap, bellDepth, laneRiseIn, needsSweep, battleOdds
} from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { chip, have, chipRow, bagChips, shipChips } from './format.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { wipe } from '../fx/wipe.js';
import { tutEvent, tutActive, tutAllowsMission, refreshTut } from './tutorial.js';
import { launchVoyage } from '../systems/voyages.js';
import { startBattle } from '../battle/loop.js';
import { bossEnemies, charterEnemies, genEnemies, tutEnemies } from '../systems/enemies.js';
import {
  battleVictory, charterVictory, bossVictory, battleLoss, sweepVictory, sweepLoss
} from '../systems/outcomes.js';

let sel = [];               // chosen ship ids, in tap order
let curRoute = null;
let foes = null;            // the line-up currently on offer, so odds can be shown
let sweeping = false;       // a cargo lane's sheet is showing the sweep, not the run

/* How many ships the job on screen takes. A run sails under one hull; a fight —
   including a sweep of the same lane — takes a line of three. */
const crewSize = r =>
  (sweeping || !canVoyage(r)) ? BATTLE_SHIPS : VOY_SHIPS;

/* Who is out there. Drawn once when the sheet opens and redrawn on request —
   an unwinnable match-up should be something you can walk away from and look
   again, not something you have to take. */
function drawFoes(r) {
  if (r.type === 'boss') return bossEnemies(r.bossDef);
  if (r.type === 'charter') return charterEnemies(r.charterDef);
  if (tutActive() && r.id === 'c3') return tutEnemies();
  return genEnemies(r);
}
/* Fixed line-ups cannot be rerolled — an admiral brings what she brings. */
const canReroll = r => r && r.type !== 'boss' && r.type !== 'charter';

export function openMission(id) {
  if (!tutAllowsMission(id)) {
    toast('Follow the highlighted marker to continue.', 'bad');
    return;
  }
  const r = routeById(id);
  if (!r) return;

  curRoute = r;
  sel = [];
  sweeping = false;
  foes = (canVoyage(r) && !needsSweep(r)) ? null : drawFoes(r);
  tutEvent('route:' + id);
  if (r.type === 'boss') play('boss_horn');
  if (r.type === 'charter') play('relic');

  drawMission();
  openSheet();
}

/* Tapping a ship. A voyage takes one, so a second tap swaps rather than being
   refused — there is only one seat and you are choosing who sits in it. */
function togSel(id) {
  const max = curRoute ? crewSize(curRoute) : BATTLE_SHIPS;
  const i = sel.indexOf(id);
  if (i > -1) sel.splice(i, 1);
  else if (max === 1) sel = [id];
  else if (sel.length < max) sel.push(id);
  else return;

  if (sel.length >= 2) tutEvent('ships:2');
  if (sel.length >= 1) tutEvent('ships:1');
  drawMission();
}

/* Ship picker, shared by both panels. `need` is the cargo a cargo run wants, so
   every hull carries a green or red 📦 have/need chip and the right ship for the
   job can be picked without reading a word. */
function shipPicks(voyage, need) {
  const bz = busyIds();
  const slots = voyage
    ? ['SAILS']
    : ['FRONT', 'CENTRE', 'REAR'];

  return allShips().map(s => {
    const i = sel.indexOf(s.id);
    const crip = s.hull <= 0, atSea = bz.has(s.id), dis = crip || atSea, isF = s.id === 'FLAG';
    const state = crip
      ? chip('hull', 'CRIPPLED', 'bad')
      : atSea ? chip('time', 'AT SEA', 'dim') : '';
    return `<div class="pick ${i > -1 ? 'sel' : ''} ${dis ? 'dis' : ''} ${isF ? 'flag' : ''}"
        ${dis ? '' : `data-act="pick-ship" data-id="${s.id}"`}>
      <div class="row"><b>${isF ? iconHTML('flag', 21) + ' ' : ''}${esc(s.name)}</b>
        <span class="picktail">${state}${i > -1 ? `<span class="slot ${voyage ? 'blu' : ''}">${slots[i]}</span>` : ''}</span></div>
      <div class="picksub">${tname(s)}</div>
      ${shipChips(s, '', need)}</div>`;
  }).join('');
}

/* The line-up on offer, with the odds of beating it using the ships picked so
   far. Backing out and looking again is a real move, not a cheat. */
function foesCard(r, fleet) {
  if (!foes || !foes.length) return '';
  const odds = battleOdds(fleet, foes);
  const cls = !fleet.length ? '' : odds >= 90 ? 'good' : odds >= 60 ? 'fair' : 'poor';
  const list = foes.map(e =>
    `<div class="foe"><b>${esc(e.name)}</b>${chipRow([
      chip('speed', e.speed, 'dim'), chip('guns', e.guns, 'dim'), chip('hull', e.max, 'dim')
    ], 'tight')}</div>`).join('');

  return `<div class="card oddscard" style="--i:0">
      <div class="row"><h3>${iconHTML('target', 22)} Sails Sighted</h3>
        <span class="odds ${cls}">${fleet.length ? odds + '%' : '— —'}</span></div>
      <div class="foelist">${list}</div>
      ${canReroll(r) ? `<button class="btn sm wide" style="margin-top:10px" data-act="reroll">Stand Off and Look Again</button>` : ''}
    </div>`;
}

function drawMission() {
  const r = curRoute;
  const d = effDanger(r);
  const isBoss = r.type === 'boss', isCh = r.type === 'charter';

  /* ---- head ---- */
  const tagText = isBoss ? r.bossDef.title.toUpperCase()
    : isCh ? 'TIER ' + r.charterDef.t
    : r.type === 'dive' ? (DEPTH_NAMES[r.depth] || 'DEEP').toUpperCase()
    : DNAMES[d];
  const tagCls = isCh ? 'gold' : (r.type === 'dive' ? 'blu' : 't' + d);

  /* Danger only means something where cargo can be taken off you. */
  const showDanger = r.type === 'cargo' || (!isBoss && !isCh && r.type !== 'dive');

  let head = `<div class="row"><h3>${esc(r.n)}</h3><span class="tag ${tagCls}">${tagText}</span></div>`;
  if (showDanger) {
    head += `<div class="dbar"><i style="width:${(d + 1) * 25}%;background:${DCOLORS[d]}"></i></div>`;
    /* Which way the water is heading, and how long the patrol holds it down. */
    const rise = r.type === 'cargo' ? laneRiseIn(r) : 0;
    head += chipRow([
      r.type === 'cargo'
        ? chip('danger', rise ? '↑ ' + fmtDur(rise / 1000) : 'CAPPED', rise ? 'warn' : 'bad',
            rise ? 'This lane worsens a step in ' + fmtDur(rise / 1000) + ' unless it is swept'
                 : 'This lane is as bad as it gets until it is swept')
        : '',
      patrolActive(r.region)
        ? chip('flag', fmtDur(patrolLeft(r.region) / 1000), 'ok',
            REGIONS[r.region].n + ' is under patrol — everything here is a step quieter')
        : ''
    ], 'tight');
  }
  head += `<div class="row" style="margin-top:8px"><span class="mtype ${isBoss ? 'boss' : (isCh ? 'gold' : '')}">${MTYPE[r.type].n}</span></div>
    <div class="sub quote" style="margin-top:6px">${esc(isBoss ? r.bossDef.desc : MTYPE[r.type].tip)}</div>`;
  $('sheetHead').innerHTML = head;

  /* ---- body ---- */
  $('sheetBody').innerHTML = sweeping ? sweepBody(r)
    : canVoyage(r) ? voyageBody(r)
    : battleBody(r, isBoss, isCh);
  refreshTut();
}

/* One line of instruction above the picker, and the count it asks for. */
function pickHint(n, extra) {
  return `<div class="pickhint"><span class="crewn">${iconHTML('crew', 20)}<b>${n}</b></span>`
    + `<span>${n === 1 ? 'One ship sails this. Pick the hull for the job.' : 'Up to three, in line order — tap order sets the line.'}${extra || ''}</span></div>`;
}

/* ---- cargo runs and dives ---- */
function voyageBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  const cap = holdCap(fleet);
  const already = S.voyages.find(v => v.routeId === r.id);
  const slotOK = S.voyages.length < VOY_MAX_ACTIVE;
  const dur = fleet.length ? voyDuration(r, fleet) : r.len * 90;

  let manifest = '', warn = '', ready = false, label = 'Send Ship';
  const need = r.type === 'cargo' ? r.qty : null;

  if (r.type === 'cargo') {
    const g = GOODS[r.good];
    const held = goodsHeld(r.good);
    const haveGoods = held >= r.qty;
    const holdOK = cap >= r.qty;
    const odds = tradeChance(r, fleetPower(fleet));
    ready = haveGoods && holdOK && !!fleet.length;
    label = 'Load & Sail';

    manifest = `<div class="card manifest" style="--i:0">
        ${chipRow([
          have(r.good, held, r.qty, `${g.n} in store, of ${r.qty} the contract wants`),
          have('cargo', cap, r.qty, 'Cargo space on the ship you picked'),
          chip('dest', esc(r.dest), '', 'Destination'),
          chip('time', fleet.length ? fmtDur(dur) : '—', '', 'Time away'),
          chip('target', fleet.length ? odds + '%' : '—',
            fleet.length ? (odds >= 85 ? 'ok' : odds >= 65 ? 'warn' : 'bad') : '', 'Chance it arrives intact'),
          chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on delivery')
        ], 'big')}
        ${chipRow([bagChips(r.rew)], 'tight')}
      </div>`;

    if (!haveGoods) warn = `Buy ${g.n.toLowerCase()} in the Market — ${r.qty - held} short.`;
    else if (!holdOK && fleet.length) warn = 'That hull is too small. Pick a bigger one, or add a cargo hold to the flagship.';
    else if (already) warn = 'A ship is already running this contract.';
  } else {
    const reach = diveReachable(r);
    const chests = fleet.length ? diveChests(r, fleet) : 0;
    const value = chestValue(r);
    ready = reach && !!fleet.length;
    label = 'Send Divers';

    manifest = `<div class="card manifest" style="--i:0">
        ${chipRow([
          have('depth', bellDepth(), r.depth, `${BELL_NAMES[S.bell]} — reaches depth ${bellDepth()}, this wreck lies at ${r.depth}`),
          chip('target', '100%', 'ok', 'No enemies here — a wreck dive is never a fight'),
          chip('chest', fleet.length ? chests : '—', 'gold', 'Chests expected'),
          chip('gold', fleet.length ? chests * value : value, 'gold',
            fleet.length ? 'Sold on the quay as they come up' : 'Per chest'),
          chip('cargo', fleet.length ? chestCap(fleet) : '—', '',
            `Chests this hull can carry — ${CARGO_PER_CHEST} cargo space each`),
          chip('time', fleet.length ? fmtDur(dur) : '—', '', 'Time away'),
          chip('noto', '+' + notoGain(r), 'gold', 'Notoriety')
        ], 'big')}
        ${chipRow([bagChips(r.rew)], 'tight')}
      </div>`;

    if (!reach) warn = `Your bell reaches depth ${bellDepth()}. Upgrade it in the Market.`;
  }

  return `${manifest}
    ${pickHint(VOY_SHIPS)}
    <div id="shipPicks">${shipPicks(true, need)}</div>
    ${warn ? `<div class="sub center warnline">${esc(warn)}</div>` : ''}
    <div class="grid2">
      <button class="btn" data-act="close-sheet">Cancel</button>
      <button class="btn blu" id="sailBtn" ${ready && slotOK && !already ? '' : 'disabled'} data-act="send-ships">${label}</button>
    </div>
    ${!slotOK ? `<div class="sub center warnline">${VOY_MAX_ACTIVE} fleets are already at sea. Collect one first.</div>` : ''}
    ${sweepOffer(r)}`;
}

/* The offer to sweep, shown under a run on a lane that has gone bad. Tapping it
   swaps the sheet over to the fight — a different job with a different crew
   size, so it gets its own picker rather than sharing the run's one seat. */
function sweepOffer(r) {
  if (!needsSweep(r)) return '';
  const d = effDanger(r);
  return `<div class="sect" style="--i:2">Or Sweep It First</div>
    <div class="card" style="--i:3">
      ${chipRow([
        chip('danger', DNAMES[d], d >= 2 ? 'bad' : 'warn', 'This lane now'),
        chip('danger', DNAMES[Math.max(0, d - 1)], 'ok', 'After a won sweep'),
        chip('crew', BATTLE_SHIPS, '', 'A sweep is a fight — it takes a line of three')
      ], 'big')}
      <div class="sub">Trading it is allowed and always was — danger only decides how roughly a run is handled. Sweeping pushes it down a step, and what your line takes off the enemy comes home with them.</div>
      <button class="btn gold wide" style="margin-top:10px" data-act="sweep-mode">Sweep the Lane</button>
    </div>`;
}

/* The sweep itself: a battle line against whatever is working this water. */
function sweepBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  const d = effDanger(r);
  return `<div class="card" style="--i:0">
      ${chipRow([
        chip('danger', DNAMES[d], d >= 2 ? 'bad' : 'warn', 'This lane now'),
        chip('danger', DNAMES[Math.max(0, d - 1)], 'ok', 'After a won sweep'),
        chip('power', fleetPower(fleet), '', 'Fleet power of the line you have picked'),
        chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory')
      ], 'big')}
    </div>
    ${pickHint(BATTLE_SHIPS)}
    <div id="shipPicks">${shipPicks(false)}</div>
    ${foesCard(r, fleet)}
    <div class="grid2">
      <button class="btn" data-act="run-mode">Back to the Run</button>
      <button class="btn gold" id="sweepBtn" ${fleet.length ? '' : 'disabled'} data-act="sweep">Sweep the Lane</button>
    </div>`;
}

/* ---- battle missions ---- */
function battleBody(r, isBoss, isCh) {
  const fleet = sel.map(findShip).filter(Boolean);
  const fp = fleetPower(fleet);
  const flagOK = !isBoss || sel.includes('FLAG');

  /* Charter extras: what it opens, what it pays, what else is on offer here. */
  let extra = '';
  if (isCh) {
    const c = r.charterDef;
    const others = chartersAt(c.loc).filter(x => x.id !== c.id);
    const prizes = chipRow([
      c.dest ? chip('port', esc(PORTS[c.dest].n), 'gold', 'This port opens for good, with contracts of its own') : '',
      c.prize && c.prize.piece ? chip('relic', esc(c.prize.piece), 'gold', 'Collectible') : '',
      c.prize && c.prize.boon ? chip('flag', 'REFIT', 'gold', 'A permanent flagship refit') : '',
      c.prize && c.prize.gold ? chip('gold', c.prize.gold, 'gold', 'Treasure map') : ''
    ], 'big');
    const more = others.length
      ? `<div class="sub">Also here: ${others.map(o =>
          `<button class="linkbtn" data-act="mission" data-id="ch_${o.id}">${esc(o.n)}</button>`).join(', ')}</div>`
      : '';
    if (prizes || more) extra = `<div class="card chartercard" style="--i:0">${prizes}${more}</div>`;
  }

  const odds = foes ? battleOdds(fleet, foes) : 0;

  return `${extra}
    ${pickHint(BATTLE_SHIPS, isBoss ? ' Your flagship sails or nobody does.' : '')}
    <div id="shipPicks">${shipPicks(false)}</div>
    ${foesCard(r, fleet)}
    <div class="card ${isBoss ? 'bosscard' : ''}" style="--i:1">
      ${chipRow([
        r.power ? have('power', fp, r.power, 'Fleet power against what this fight is rated for')
                : chip('power', fp, '', 'Fleet power'),
        foes && fleet.length ? chip('target', odds + '%',
          odds >= 85 ? 'ok' : odds >= 60 ? 'warn' : 'bad', 'Estimated odds') : '',
        chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory — fills the bar that summons the admiral')
      ], 'big')}
      ${chipRow([bagChips(r.rew)], 'tight')}
      ${r.type === 'patrol' ? `<div class="sub">Winning pushes every lane in ${esc(REGIONS[r.region].n)} down a step and holds the region quieter for a while.</div>` : ''}
      ${isBoss && r.bossDef.unlocks ? `<div class="sub">${iconHTML('map', 18)} Opens ${esc(REGIONS[r.bossDef.unlocks].n)}.</div>` : ''}
    </div>
    <div class="grid2">
      <button class="btn" data-act="close-sheet">Cancel</button>
      <button class="btn ${isBoss ? 'red' : 'gold'}" id="sailBtn" ${sel.length && flagOK ? '' : 'disabled'} data-act="attack">${isCh ? 'Accept' : 'Attack'}</button>
    </div>
    ${!flagOK ? '<div class="sub center warnline">Admirals only fight your flagship. Add it to the line.</div>' : ''}`;
}

/* ---- launching ---- */
function doSendShips() {
  const fleet = sel.map(findShip).filter(Boolean);
  if (!launchVoyage(curRoute, fleet)) return;
  tutEvent('voyage:launch');
  closeSheet();
}

/* Look at a different set of sails. Free, and the point of showing odds. */
function doReroll() {
  if (!curRoute || !canReroll(curRoute)) return;
  foes = drawFoes(curRoute);
  play('sail');
  drawMission();
}

function closeForBattle() {
  const o = $('overlay');
  o.classList.remove('vis');
  o.classList.remove('on');
}

function doAttack() {
  const r = curRoute;
  const fleet = sel.map(findShip).filter(Boolean);
  const line = foes || drawFoes(r);
  const forcedTut = tutActive() && r.id === 'c3';
  tutEvent('launch');
  closeForBattle();

  if (r.type === 'boss') {
    const b = r.bossDef;
    wipe(() => startBattle(fleet, line, false,
      (win, enemies) => (win ? bossVictory(b, enemies) : battleLoss(r, b)), b));
    return;
  }
  if (r.type === 'charter') {
    wipe(() => startBattle(fleet, line, false,
      (win, enemies) => (win ? charterVictory(r, enemies) : battleLoss(r))));
    return;
  }
  wipe(() => startBattle(fleet, line, r.type === 'escort' && !forcedTut,
    (win, enemies) => (win ? battleVictory(r, enemies) : battleLoss(r))));
}

/* Sweeping a cargo lane. Same picker, same line-up preview, different outcome. */
function doSweep() {
  const r = curRoute;
  const fleet = sel.map(findShip).filter(Boolean);
  if (!fleet.length || !needsSweep(r)) return;
  const line = foes || drawFoes(r);
  closeForBattle();
  wipe(() => startBattle(fleet, line, false,
    (win, enemies) => (win ? sweepVictory(r, enemies) : sweepLoss(r))));
}

/* Swapping the sheet between the run and the sweep. They want different crews,
   so the selection is cleared rather than carried across. */
function setMode(on) {
  sweeping = on;
  sel = [];
  if (on && !foes) foes = drawFoes(curRoute);
  play('sail');
  drawMission();
}

actions({
  mission: d => openMission(d.id),
  'pick-ship': d => togSel(d.id),
  'send-ships': doSendShips,
  attack: doAttack,
  sweep: doSweep,
  'sweep-mode': () => setMode(true),
  'run-mode': () => setMode(false),
  reroll: doReroll,
  'close-sheet': closeSheet
});
