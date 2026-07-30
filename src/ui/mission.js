/* The mission sheet.

   A cargo run and a wreck dive are voyages; a patrol, escort, raid, blockade,
   charter or admiral is a fight. Trade is never gated behind a battle.

   A voyage sails under one ship — the question a cargo run asks is whether any
   single hull you own is up to it, on all three counts: cargo space to carry the
   consignment, power to see off the water, speed to make the passage. A fight
   takes a line of up to three.

   A cargo lane that has drifted above Safe is two jobs, and the sheet offers both
   as tabs at the top: run it as it stands, or fight it first and knock a step of
   danger off. Neither is compulsory. Running a bad lane anyway is always allowed
   — danger only decides how roughly the passage goes.

   You face the ships that are out there. They are generated from the water
   itself — the region's tier and that lane's danger right now — and there is no
   looking again for an easier line-up: the answer to a match-up you cannot win
   is a better fleet, and a button that rerolls the enemy is a button that makes
   building one pointless.

   The sheet has one shape and every mission uses it:

     head   what the job asks for, as have/need chips. Never scrolls.
     body   the ships you can send, on a rail. Then who is waiting.
     foot   Cancel, and the one button that commits. Never scrolls.

   Everything numeric is a chip: one glyph, one number. Where a number is a test
   rather than a reading it is written have/need, so the left-hand figure is what
   you have and the right is what the job wants. */

import { $, esc } from '../core/dom.js';
import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { VOY_MAX_ACTIVE, VOY_SHIPS, BATTLE_SHIPS, CARGO_PER_CHEST } from '../core/config.js';
import { DNAMES, DCOLORS, MTYPE, REGIONS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { BELL_NAMES, DEPTH_NAMES } from '../data/salvage.js';
import {
  routeById, allShips, findShip, busyIds, isBusy, diveOut, tname, power, fleetPower, holdCap,
  effDanger, patrolActive, patrolLeft, canVoyage, voyDuration, tradeChance,
  notoGain, chartersAt, fmtDur, goodsHeld, diveReachable, diveChests, chestValue,
  bellDepth, laneRiseIn, laneFight, lanePay, battleOdds, routeRating
} from '../core/selectors.js';
import { bountyLeft } from '../core/bounties.js';
import { BOUNTY_GOLD_PER_RATING } from '../core/config.js';
/* Rate of fire is a battle number, but it is a reason to pick one hull over
   another, so the picker needs it. battle/state.js only reads config, so there
   is no cycle back into the fight from here. */
import { reloadMs } from '../battle/state.js';
import { iconHTML } from '../art/icons.js';
import { shipHTML } from '../art/ships.js';
import { chip, have, chipRow, bagChips, shipTiles } from './format.js';
import { rail, railCard, reqBar } from './components.js';
import { openSheet, closeSheet, setSheetFoot } from './sheet.js';
import { deny } from '../fx/pop.js';
import { play } from '../fx/sound.js';
import { wipe } from '../fx/wipe.js';
import { tutEvent, tutActive, tutAllowsMission, refreshTut } from './tutorial.js';
import { launchVoyage } from '../systems/voyages.js';
import { startBattle } from '../battle/loop.js';
import { bossEnemies, charterEnemies, genEnemies, tutEnemies, drawBand } from '../systems/enemies.js';
import {
  battleVictory, charterVictory, bossVictory, battleLoss, laneVictory, laneLoss
} from '../systems/outcomes.js';

let sel = [];               // chosen ship ids, in tap order
let curRoute = null;
let foes = null;            // who is out there, drawn once and faced as drawn
let fighting = false;       // a cargo lane's sheet is showing the fight, not the run
/* Whether the enemy line-up is expanded. Screen state, not save state, and it
   is deliberately remembered between sheets: a player who wants the detail
   wants it every time, and one who does not should never see it again. */
let foesOpen = false;

/* A run sails under one hull; a fight — including a fight for a cargo lane —
   takes a line of three. */
const crewSize = r => ((fighting || !canVoyage(r)) ? BATTLE_SHIPS : VOY_SHIPS);

/* Who is out there. Drawn once when the sheet opens, and that is who you fight. */
function drawFoes(r) {
  if (r.type === 'boss') return bossEnemies(r.bossDef);
  if (r.type === 'charter') return charterEnemies(r.charterDef);
  if (tutActive() && r.id === 'c3') return tutEnemies();
  return genEnemies(r);
}

export function openMission(id) {
  if (!tutAllowsMission(id)) {
    deny('Follow the marker');
    return;
  }
  const r = routeById(id);
  if (!r) return;

  curRoute = r;
  sel = [];
  fighting = false;
  foes = (canVoyage(r) && !laneFight(r)) ? null : drawFoes(r);
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
   the fleet for a hull that meets it. */
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
      /* What a hull's speed BUYS depends on the job, and the picker has to say
         which one is being bought here — the same number is two different
         arguments. On a run it is how long she would be gone, which is the other
         half of the trade against her hold: a schooner is back in a third of the
         time and carries a fifth as much. In a fight it is how often she fires,
         because the guns run on their own clock now, so a fast hull with light
         guns is a real answer and not just a worse frigate. */
      sub: dis ? tname(s)
        : voyage
          ? tname(s) + ' · ' + fmtDur(voyDuration(curRoute, [s]))
          : tname(s) + ' · fires every ' + (reloadMs(s) / 1000).toFixed(1) + 's',
      chips: shipTiles(s, power(s), need)
    });
  }).join(''), 'shipPicks');
}

/* Who is waiting, and the odds against the line you have picked. This is who you
   fight — there is no other line-up on offer. */
/* Who is out there, and — when they are more or less than this water is rated
   for — what kind of trouble it is. The band is named up front because walking
   away is a legitimate answer and you cannot choose it from behind a number. */
/* The enemy, as chips for the one strip the head carries.

   This used to be a bordered card of its own, under the requirement bar, with
   its own heading, its own padding and its own copy of the odds — the same 83%
   the bar above it was already showing. Two slabs saying overlapping things,
   one on top of the other, is most of why the sheet needed a screen and a half.
   Now it is three more chips on the one row everything else is on. */
function foeChips() {
  if (!foes || !foes.length) return [];
  const drawn = curRoute ? drawBand(curRoute) : null;
  const guns = foes.reduce((a, e) => a + e.guns, 0);
  const hull = foes.reduce((a, e) => a + e.max, 0);
  const band = drawn && drawn.label ? ' — ' + drawn.label : '';

  return [
    /* `danger`, not `target` — target is the odds chip sitting right beside it,
       and two chips wearing the same picture is two chips saying the same
       thing as far as a glance is concerned. */
    `<button class="chip foechip${foesOpen ? ' on' : ''}" data-act="toggle-foes"
       title="Who is out there${esc(band)}. Tap for the line-up.">
       ${iconHTML('danger', 0, 'chipic')}<b>${foes.length}</b><i class="caret"></i></button>`,
    chip('guns', guns, 'dim', 'Their guns, all told'),
    chip('hull', hull, 'dim', 'Their hulls, all told'),
    foes.some(e => e.chest)
      ? chip('chest', 'BOX', 'gold', "One of them is carrying a captain's strongbox") : ''
  ];
}

/* And the line-up itself, only when asked for. It is the first thing in the
   body rather than in the head, so opening it never pushes the head down over
   what the player is reading. */
function foeList() {
  if (!foes || !foes.length || !foesOpen) return '';
  const drawn = curRoute ? drawBand(curRoute) : null;
  const tag = drawn && drawn.label
    ? `<span class="tag ${drawn.band === 'straggler' ? 't0' : 'bad'}">${esc(drawn.label)}</span>` : '';
  return `<div class="foelist" style="--i:0">
    ${tag ? `<div class="foeband">${tag}</div>` : ''}
    ${foes.map(e => `<div class="foe"><b>${esc(e.name)}</b>${chipRow([
      chip('speed', e.speed, 'dim'), chip('guns', e.guns, 'dim'), chip('hull', e.max, 'dim'),
      e.chest ? chip('chest', 'BOX', 'gold', "She is carrying a captain's strongbox") : ''
    ], 'tight')}</div>`).join('')}
  </div>`;
}

function drawMission() {
  const r = curRoute;
  const d = effDanger(r);
  const isBoss = r.type === 'boss', isCh = r.type === 'charter';

  /* ---- head: what this asks of you ---- */
  const tagText = isBoss ? r.bossDef.title.toUpperCase()
    : isCh ? 'TIER ' + r.charterDef.t
    : r.type === 'dive' ? (DEPTH_NAMES[r.depth] || 'DEEP').toUpperCase()
    : DNAMES[d];
  const tagCls = isCh ? 'gold' : (r.type === 'dive' ? 'blu' : 't' + d);

  /* Danger only means something where cargo can be taken off you. */
  const showDanger = r.type === 'cargo' || (!isBoss && !isCh && r.type !== 'dive');

  let head = `<div class="row"><h3>${esc(r.n)}</h3><span class="tag ${tagCls}">${tagText}</span></div>`;
  if (showDanger) {
    head += `<div class="dbar"><i style="width:${(d + 1) / DNAMES.length * 100}%;background:${DCOLORS[d]}"></i></div>`;
  }

  /* A lane that has gone bad is two jobs, and both are offered up front. Neither
     is compulsory — you may always just sail it. */
  if (canVoyage(r) && laneFight(r)) {
    head += `<div class="mtabs">
      <button class="mtab ${fighting ? '' : 'on'}" data-act="run-mode">${iconHTML(r.type === 'dive' ? 'chest' : 'cargo', 40)}${MTYPE[r.type].n}</button>
      <button class="mtab ${fighting ? 'on' : ''}" data-act="fight-mode">${iconHTML('danger', 40)}Battle</button>
    </div>`;
  } else {
    head += `<div class="row" style="margin-top:8px"><span class="mtype ${isBoss ? 'boss' : (isCh ? 'gold' : '')}">${MTYPE[r.type].n}</span></div>`;
  }
  head += requirements(r, isBoss);
  $('sheetHead').innerHTML = head;

  /* ---- body: who is waiting, then the ships to send ---- */

  /* Picking a ship redraws the whole sheet, which used to throw the rail back
     to its first card — so choosing your third hull meant scrolling the fleet
     from the beginning again, every time. Where the player had scrolled to is
     their place in a list, not a side effect of the render. */
  const rail0 = $('shipPicks');
  const railLeft = rail0 ? rail0.scrollLeft : 0;
  const bodyTop = $('sheetBody') ? $('sheetBody').scrollTop : 0;

  const panel = fighting ? laneBody(r)
    : canVoyage(r) ? voyageBody(r)
    : battleBody(r, isBoss, isCh);
  $('sheetBody').innerHTML = panel.body;

  if (railLeft) {
    const rail1 = $('shipPicks');
    if (rail1) rail1.scrollLeft = railLeft;
  }
  if (bodyTop) $('sheetBody').scrollTop = bodyTop;

  /* ---- foot: the one button that commits ---- */
  setSheetFoot(`<div class="grid2">
      <button class="btn quiet" data-act="close-sheet">Cancel</button>
      <button class="btn ${panel.cls}" id="${panel.id}" ${panel.ready ? '' : 'disabled'} data-act="${panel.act}">${esc(panel.label)}</button>
    </div>`);
  refreshTut();
}

/* Everything the job asks for and everything it pays, in the head where it stays
   put. Nothing numeric lives anywhere else on the sheet. */
function requirements(r, isBoss) {
  const fleet = sel.map(findShip).filter(Boolean);
  const picked = !!fleet.length;

  /* Fighting for a cargo lane. What it does to the lane, and what it pays. */
  if (fighting) {
    const d = effDanger(r);
    const odds = foes && picked ? battleOdds(fleet, foes) : 0;
    return reqBar([
      chip('danger', `${DNAMES[d]} <em>&rarr;</em> ${DNAMES[Math.max(0, d - 1)]}`, 'ok',
        'What winning does to this lane'),
      chip('crew', BATTLE_SHIPS, '', 'Ships this takes'),
      foes && picked
        ? chip('target', odds + '%', odds >= 85 ? 'ok' : odds >= 60 ? 'warn' : 'bad', 'Estimated odds')
        : '',
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory'),
      bagChips(lanePay(r))
    ], 'Knock a step of danger off this lane. You are never made to — the run is one tab away.');
  }

  if (r.type === 'cargo') {
    const g = GOODS[r.good];
    const dur = picked ? voyDuration(r, fleet) : r.len * 90;
    const fp = fleetPower(fleet);
    const spd = picked ? Math.round(fleet.reduce((a, s) => a + s.speed, 0) / fleet.length) : 0;
    const odds = tradeChance(r, fp);
    return reqBar([
      /* The three the ship herself has to answer, first and together. */
      have('cargo', holdCap(fleet), r.qty, 'Cargo space against the consignment'),
      have('power', fp, r.power, 'Power against the water she crosses'),
      have('speed', spd, r.speed, 'Speed against the passage'),
      /* Then what it costs you and what it pays. */
      have(r.good, goodsHeld(r.good), r.qty, `${g.n} in store`),
      chip('dest', esc(r.dest), '', 'Destination'),
      chip('time', picked ? fmtDur(dur) : '—', '', 'Time away'),
      chip('target', picked ? odds + '%' : '—',
        picked ? (odds >= 85 ? 'ok' : odds >= 65 ? 'warn' : 'bad') : '', 'Chance she arrives intact'),
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on delivery'),
      bagChips(r.rew)
    ], laneNote(r));
  }

  if (r.type === 'dive') {
    const dur = picked ? voyDuration(r, fleet) : r.len * 90;
    const chests = picked ? diveChests(r, fleet) : 0;
    const value = chestValue(r);
    return reqBar([
      have('depth', bellDepth(), r.depth, `${BELL_NAMES[S.bell]} reaches depth ${bellDepth()}`),
      have('cargo', holdCap(fleet), r.chestMin * CARGO_PER_CHEST,
        `Cargo space — ${CARGO_PER_CHEST} per chest raised`),
      chip('chest', picked ? chests : '—', 'gold', 'Chests expected'),
      chip('gold', picked ? chests * value : value, 'gold', picked ? 'Sold on the quay' : 'Per chest'),
      chip('time', picked ? fmtDur(dur) : '—', '', 'Time away'),
      chip('target', '100%', 'ok', 'A wreck dive is never a fight'),
      chip('noto', '+' + notoGain(r), 'gold', 'Notoriety'),
      bagChips(r.rew)
    ], esc(MTYPE.dive.tip)
      + (diveOut() ? ' <span class="bad">Your bell is already down on another wreck.</span>' : ''));
  }

  const fp = fleetPower(fleet);
  const odds = foes && picked ? battleOdds(fleet, foes) : 0;
  const isBt = r.type === 'bounty';
  /* A bounty's clock is the first thing on her bar and it is live, so a player
     reading the sheet can watch it run rather than having to remember what it
     said when they opened it. */
  const left = isBt ? bountyLeft(r) : 0;
  /* One strip, everything on it, and the odds on it exactly once.

     What this fight asks of you and what is out there waiting are the same
     question, and they used to be two bordered slabs stacked on top of each
     other — each with its own padding, its own heading, and its own copy of the
     odds. The player scrolled past four hundred pixels of chrome to reach the
     ships they were being asked to choose. */
  return reqBar([
    isBt ? chip('time',
      `<b class="clock" data-endsat="${r.endsAt}">${fmtDur(left / 1000)}</b>`,
      left < 3 * 60 * 1000 ? 'bad' : 'warn', 'Before she sails') : '',
    foes
      ? chip('target', picked ? odds + '%' : '— —',
        !picked ? 'dim' : odds >= 85 ? 'ok' : odds >= 60 ? 'warn' : 'bad', 'Estimated odds')
      : '',
    ...foeChips(),
    r.power ? have('power', fp, r.power, 'Fleet power against what this fight is rated for')
            : chip('power', fp, '', 'Fleet power'),
    chip('noto', '+' + notoGain(r), 'gold', 'Notoriety on victory'),
    isBt ? chip('gold', Math.round(routeRating(r) * BOUNTY_GOLD_PER_RATING), 'gold', 'The price on her')
         : bagChips(r.rew),
    isBoss && r.bossDef.unlocks
      ? chip('map', esc(REGIONS[r.bossDef.unlocks].n), 'gold', 'Unlocked on victory') : ''
  ], isBoss
    ? (isBusy('FLAG')
      ? '<span class="bad">Your flagship is at sea. Bring her home before you face an admiral.</span>'
      : '<span class="bad">Your flagship sails or nobody does.</span>')
    : isBt
      ? `${esc(r.station)}. <span class="bad">Above this water — her captain carries a strongbox.</span>`
      : esc(MTYPE[r.type].tip));
}

/* Which way this lane is heading, and the one thing that holds it down. */
function laneNote(r) {
  const rise = laneRiseIn(r);
  const bits = [esc(MTYPE.cargo.tip)];
  if (patrolActive(r.region)) {
    bits.push(`Patrolled for ${fmtDur(patrolLeft(r.region) / 1000)} — a step quieter.`);
  } else if (rise) {
    bits.push(`Worsens in ${fmtDur(rise / 1000)}. Patrol ${esc(REGIONS[r.region].n)} to push it back.`);
  } else {
    bits.push(`Patrol ${esc(REGIONS[r.region].n)} to push it back.`);
  }
  return bits.join(' ');
}

/* One line above the rail: how many ships, and what the order means. */
function pickHint(n) {
  return `<div class="pickhint"><span class="crewn">${iconHTML('crew', 40)}<b>${n}</b></span>`
    + `<span>${n === 1 ? 'Pick one ship.' : 'Pick up to three — tap order sets the line.'}</span></div>`;
}

/* ---- cargo runs and dives ---- */
function voyageBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  const already = S.voyages.find(v => v.routeId === r.id);
  const slotOK = S.voyages.length < VOY_MAX_ACTIVE;
  const isCargo = r.type === 'cargo';
  const need = isCargo ? r.qty : null;

  let warn = '', ready = false;
  if (isCargo) {
    const held = goodsHeld(r.good);
    const holdOK = holdCap(fleet) >= r.qty;
    ready = held >= r.qty && holdOK && !!fleet.length;
    if (held < r.qty) warn = `${r.qty - held} short — run more contracts or take some off the enemy.`;
    else if (!holdOK && fleet.length) warn = 'That hull is too small.';
    else if (already) warn = 'Already running this contract.';
  } else {
    /* One bell, one wreck. The button has to say so before it is pressed —
       being refused after choosing a ship is the same information delivered
       as a telling-off. */
    const bellFree = !diveOut();
    ready = diveReachable(r) && bellFree && !!fleet.length;
    if (!diveReachable(r)) warn = `Upgrade the bell in the Market — yours reaches ${bellDepth()}.`;
    else if (!bellFree) warn = 'Your diving bell is already down on another wreck.';
  }
  if (!slotOK) warn = `All ${VOY_MAX_ACTIVE} fleets are at sea.`;

  return {
    body: `${pickHint(VOY_SHIPS)}
      ${shipPicks(true, need)}
      ${warn ? `<div class="sub center warnline">${esc(warn)}</div>` : ''}`,
    label: isCargo ? 'Send Ship' : 'Send Divers',
    act: 'send-ships', id: 'sailBtn', cls: 'blu',
    ready: ready && slotOK && !already
  };
}

/* ---- fighting for a cargo lane ---- */
function laneBody(r) {
  const fleet = sel.map(findShip).filter(Boolean);
  return {
    body: `${foeList()}
      ${pickHint(BATTLE_SHIPS)}
      ${shipPicks(false)}`,
    label: 'Clear Lane', act: 'lane-attack', id: 'sailBtn', cls: 'gold',
    ready: !!fleet.length
  };
}

/* ---- battle missions ---- */
function battleBody(r, isBoss, isCh) {
  const fleet = sel.map(findShip).filter(Boolean);
  const flagOK = !isBoss || sel.includes('FLAG');

  /* A charter is also worth taking for what it opens; those numbers sit in the
     head with everything else, so all that is left here is where else to look. */
  let extra = '';
  if (isCh) {
    const c = r.charterDef;
    const others = chartersAt(c.loc).filter(x => x.id !== c.id);
    const prizes = chipRow([
      c.dest ? chip('port', esc(PORTS[c.dest].n), 'gold', 'This port opens for good') : '',
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
    /* Who is out there, THEN who to send. It used to be the other way round,
       which put the enemy line-up below a rail of ship cards and off the bottom
       of a phone — so the one thing you are choosing against was the one thing
       you had to go looking for. */
    body: `${extra}
      ${foeList()}
      ${pickHint(BATTLE_SHIPS)}
      ${shipPicks(false)}`,
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

/* Fighting for a lane. Same picker, same odds, a different outcome. */
function doLaneAttack() {
  const r = curRoute;
  const fleet = sel.map(findShip).filter(Boolean);
  if (!fleet.length || !laneFight(r)) return;
  const line = foes || drawFoes(r);
  closeForBattle();
  wipe(() => startBattle(fleet, line, false,
    (win, enemies) => (win ? laneVictory(r, enemies) : laneLoss(r))));
}

/* Swapping between the run and the fight. They want different crews, so the
   selection is cleared rather than carried across. */
function setMode(on) {
  fighting = on;
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
  'lane-attack': doLaneAttack,
  'fight-mode': () => setMode(true),
  'run-mode': () => setMode(false),
  'toggle-foes': () => { foesOpen = !foesOpen; play('ui_tap'); drawMission(); },
  'close-sheet': closeSheet
});
