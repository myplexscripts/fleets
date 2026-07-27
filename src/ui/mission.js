/* The mission sheet.

   A cargo run and a wreck dive are voyages; a patrol, escort, raid, blockade,
   charter or admiral is a fight. Trade is never gated behind a battle.

   A voyage sails under one ship — the question a cargo run asks is whether any
   single hull you own can take the consignment, and pooling three of them would
   answer it for free. A fight takes a line of up to three.

   A cargo lane whose danger has drifted above Safe is two jobs, and the sheet
   offers both as tabs at the top: run it as it stands, or sweep it first — take a
   battle line out and push that lane's danger back down a step. Sweeping is an
   escort job you choose to do, not a toll you have to pay: the lane was always
   open, sweeping just makes the next run through it a better bet. A Safe lane
   has no second tab, because there is nothing out there to fight.

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
  chestCap, bellDepth, laneRiseIn, needsSweep, sweepPay, battleOdds
} from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { shipHTML } from '../art/ships.js';
import { chip, have, chipRow, bagChips, shipChips } from './format.js';
import { rail, railCard, reqBar } from './components.js';
import { openSheet, closeSheet, setSheetFoot } from './sheet.js';
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

/* Ship picker. A rail, not a column: the ships scroll sideways under the
   requirement bar, so what the job needs stays on screen while you look through
   the fleet for a hull that meets it. `need` is the cargo a cargo run wants, so
   every card carries a green or red have/need chip. */
function shipPicks(voyage, need) {
  const bz = busyIds();
  const slots = voyage ? ['SAILS'] : ['FRONT', 'CENTRE', 'REAR'];

  return rail(allShips().map(s => {
    const i = sel.indexOf(s.id);
    const crip = s.hull <= 0, atSea = bz.has(s.id), dis = crip || atSea, isF = s.id === 'FLAG';
    return railCard({
      cls: (i > -1 ? 'sel ' : '') + (dis ? 'dis ' : '') + (isF ? 'flag' : ''),
      attrs: dis ? '' : ` data-act="pick-ship" data-id="${s.id}"`,
      art: shipHTML(isF ? 'flagship' : s.type, isF ? 'flag' : 'player', 0.62),
      name: s.name,
      tag: crip ? 'CRIPPLED' : atSea ? 'AT SEA' : (i > -1 ? slots[i] : ''),
      tagCls: crip ? 'bad' : atSea ? 'blu' : (voyage ? 'blu' : ''),
      sub: tname(s),
      chips: shipChips(s, '', need)
    });
  }).join(''), 'shipPicks');
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
      ${canReroll(r) ? `<button class="btn sm wide" style="margin-top:10px" data-act="reroll">Look Again</button>` : ''}
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
  /* A bad lane is two jobs, not one job with a footnote: run it as it stands, or
     fight it quieter first. Both are offered up front as tabs, because a choice
     the player has to scroll to find is a choice they never knew they had. */
  if (canVoyage(r) && needsSweep(r)) {
    head += `<div class="mtabs">
      <button class="mtab ${sweeping ? '' : 'on'}" data-act="run-mode">${iconHTML(r.type === 'dive' ? 'chest' : 'cargo', 20)}${MTYPE[r.type].n}</button>
      <button class="mtab ${sweeping ? 'on' : ''}" data-act="sweep-mode">${iconHTML('danger', 20)}Sweep</button>
    </div>`;
  } else {
    head += `<div class="row" style="margin-top:8px"><span class="mtype ${isBoss ? 'boss' : (isCh ? 'gold' : '')}">${MTYPE[r.type].n}</span></div>`;
  }
  /* What the job asks for goes in the head, above the rail and outside the
     scroller. Checking a requirement should never cost a scroll. */
  head += requirements(r, isBoss, isCh);
  $('sheetHead').innerHTML = head;

  /* ---- body and the action that commits it ---- */
  const panel = sweeping ? sweepBody(r)
    : canVoyage(r) ? voyageBody(r)
    : battleBody(r, isBoss, isCh);
  $('sheetBody').innerHTML = panel.body;
  setSheetFoot(`<div class="grid2">
      <button class="btn" data-act="close-sheet">Cancel</button>
      <button class="btn ${panel.cls}" id="${panel.id}" ${panel.ready ? '' : 'disabled'} data-act="${panel.act}">${esc(panel.label)}</button>
    </div>`);
  refreshTut();
}

/* What this job asks of you, in the head where it stays put. Everything here is
   a test or a headline number — the small print stays in the body. */
function requirements(r, isBoss, isCh) {
  const fleet = sel.map(findShip).filter(Boolean);

  if (sweeping) {
    const d = effDanger(r);
    return reqBar([
      chip('danger', `${DNAMES[d]} <em>&rarr;</em> ${DNAMES[Math.max(0, d - 1)]}`, 'ok', 'What a won sweep does to this lane'),
      chip('crew', BATTLE_SHIPS, '', 'Ships this takes'),
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory'),
      bagChips(sweepPay(r))
    ], 'Beat them and this lane drops a step. What they carry comes home with you.');
  }

  if (r.type === 'cargo') {
    const g = GOODS[r.good];
    const held = goodsHeld(r.good);
    const cap = holdCap(fleet);
    return reqBar([
      have(r.good, held, r.qty, `${g.n} in store, of ${r.qty} the contract wants`),
      have('cargo', cap, r.qty, 'Cargo space on the ship you have picked'),
      chip('dest', esc(r.dest), '', 'Destination'),
      chip('crew', VOY_SHIPS, '', 'Ships this takes')
    ], esc(MTYPE.cargo.tip));
  }

  if (r.type === 'dive') {
    return reqBar([
      have('depth', bellDepth(), r.depth, `${BELL_NAMES[S.bell]} reaches depth ${bellDepth()}; this wreck lies at ${r.depth}`),
      chip('crew', VOY_SHIPS, '', 'Ships this takes'),
      chip('target', '100%', 'ok', 'No enemies here — a wreck dive is never a fight')
    ], esc(MTYPE.dive.tip));
  }

  const fp = fleetPower(fleet);
  return reqBar([
    r.power ? have('power', fp, r.power, 'Fleet power against what this fight is rated for')
            : chip('power', fp, '', 'Fleet power'),
    chip('crew', BATTLE_SHIPS, '', 'Ships this takes'),
    foes && fleet.length
      ? chip('target', battleOdds(fleet, foes) + '%',
          battleOdds(fleet, foes) >= 85 ? 'ok' : battleOdds(fleet, foes) >= 60 ? 'warn' : 'bad', 'Estimated odds')
      : '',
    chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory')
  ], isBoss
    ? esc(r.bossDef.desc) + ' <span class="bad">Your flagship sails or nobody does.</span>'
    : esc(MTYPE[r.type].tip));
}

/* One line above the rail: how many ships, and what the order means. */
function pickHint(n) {
  return `<div class="pickhint"><span class="crewn">${iconHTML('crew', 20)}<b>${n}</b></span>`
    + `<span>${n === 1 ? 'Pick one ship.' : 'Pick up to three — tap order sets the line.'}</span></div>`;
}

/* ---- cargo runs and dives ---- */
function voyageBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  const cap = holdCap(fleet);
  const already = S.voyages.find(v => v.routeId === r.id);
  const slotOK = S.voyages.length < VOY_MAX_ACTIVE;
  const dur = fleet.length ? voyDuration(r, fleet) : r.len * 90;
  const need = r.type === 'cargo' ? r.qty : null;

  let detail = '', warn = '', ready = false, label = 'Send Ship';

  if (r.type === 'cargo') {
    const g = GOODS[r.good];
    const held = goodsHeld(r.good);
    const haveGoods = held >= r.qty;
    const holdOK = cap >= r.qty;
    const odds = tradeChance(r, fleetPower(fleet));
    ready = haveGoods && holdOK && !!fleet.length;
    label = 'Load & Sail';

    detail = chipRow([
      chip('time', fleet.length ? fmtDur(dur) : '—', '', 'Time away'),
      chip('target', fleet.length ? odds + '%' : '—',
        fleet.length ? (odds >= 85 ? 'ok' : odds >= 65 ? 'warn' : 'bad') : '', 'Chance it arrives intact'),
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on delivery'),
      bagChips(r.rew)
    ], 'big');

    if (!haveGoods) warn = `${r.qty - held} short — run more contracts or take some off the enemy.`;
    else if (!holdOK && fleet.length) warn = 'That hull is too small.';
    else if (already) warn = 'Already running this contract.';
  } else {
    const reach = diveReachable(r);
    const chests = fleet.length ? diveChests(r, fleet) : 0;
    const value = chestValue(r);
    ready = reach && !!fleet.length;
    label = 'Send Divers';

    detail = chipRow([
      chip('chest', fleet.length ? chests : '—', 'gold', 'Chests expected'),
      chip('gold', fleet.length ? chests * value : value, 'gold',
        fleet.length ? 'Sold on the quay as they come up' : 'Per chest'),
      chip('cargo', fleet.length ? chestCap(fleet) : '—', '',
        `Chests this hull can carry — ${CARGO_PER_CHEST} cargo space each`),
      chip('time', fleet.length ? fmtDur(dur) : '—', '', 'Time away'),
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety'),
      bagChips(r.rew)
    ], 'big');

    if (!reach) warn = `Upgrade the bell in the Market — yours reaches ${bellDepth()}.`;
  }

  if (!slotOK) warn = `All ${VOY_MAX_ACTIVE} fleets are at sea.`;

  return {
    body: `${pickHint(VOY_SHIPS)}
      ${shipPicks(true, need)}
      <div class="card" style="--i:1">${detail}</div>
      ${warn ? `<div class="sub center warnline">${esc(warn)}</div>` : ''}`,
    label, act: 'send-ships', id: 'sailBtn', cls: 'blu',
    ready: ready && slotOK && !already
  };
}

/* The sweep: a battle line against whatever is working this water. */
function sweepBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  return {
    body: `${pickHint(BATTLE_SHIPS)}
      ${shipPicks(false)}
      ${foesCard(r, fleet)}`,
    label: 'Sweep the Lane', act: 'sweep', id: 'sweepBtn', cls: 'gold',
    ready: !!fleet.length
  };
}

/* ---- battle missions ---- */
function battleBody(r, isBoss, isCh) {
  const fleet = sel.map(findShip).filter(Boolean);
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

  return {
    body: `${extra}
      ${pickHint(BATTLE_SHIPS)}
      ${shipPicks(false)}
      ${foesCard(r, fleet)}
      <div class="card ${isBoss ? 'bosscard' : ''}" style="--i:1">
        ${chipRow([
          bagChips(r.rew),
          isBoss && r.bossDef.unlocks ? chip('map', esc(REGIONS[r.bossDef.unlocks].n), 'gold', 'Unlocked on victory') : ''
        ], 'big')}
      </div>`,
    label: isCh ? 'Accept' : 'Attack', act: 'attack', id: 'sailBtn',
    cls: isBoss ? 'red' : 'gold',
    ready: !!sel.length && flagOK
  };
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
