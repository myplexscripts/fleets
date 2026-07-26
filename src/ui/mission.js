/* The mission sheet.

   Every mission is one thing only. A cargo run and a wreck dive are voyages and
   show a "send ships" panel; a patrol, escort, raid, blockade, charter or
   admiral is a fight and shows a "form the line" panel. Nothing offers both any
   more — that coupling was what made a safe lane still demand a battle. */

import { $, esc } from '../core/dom.js';
import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { VOY_MAX_ACTIVE } from '../core/config.js';
import { DNAMES, DCOLORS, MTYPE, REGIONS } from '../data/world.js';
import { PORTS } from '../data/ports.js';
import { GOODS } from '../data/goods.js';
import { BELL_NAMES, DEPTH_NAMES, bellMaxDepth } from '../data/salvage.js';
import {
  routeById, allShips, findShip, busyIds, tname, power, fleetPower, holdCap,
  effDanger, patrolActive, patrolLeft, canVoyage, voyDuration, tradeChance,
  notoGain, chartersAt, fmtDur, goodsHeld, diveReachable, diveChests, chestValue,
  bellDepth
} from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { fmt, goodsLine } from './format.js';
import { openSheet, closeSheet } from './sheet.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { wipe } from '../fx/wipe.js';
import { tutEvent, tutActive, tutAllowsMission, refreshTut } from './tutorial.js';
import { launchVoyage } from '../systems/voyages.js';
import { startBattle } from '../battle/loop.js';
import { bossEnemies, charterEnemies, genEnemies, tutEnemies } from '../systems/enemies.js';
import { battleVictory, charterVictory, bossVictory, battleLoss } from '../systems/outcomes.js';

let sel = [];               // chosen ship ids, in tap order
let curRoute = null;

export function openMission(id) {
  if (!tutAllowsMission(id)) {
    toast('Follow the highlighted marker to continue.', 'bad');
    return;
  }
  const r = routeById(id);
  if (!r) return;

  curRoute = r;
  sel = [];
  tutEvent('route:' + id);
  if (r.type === 'boss') play('boss_horn');
  if (r.type === 'charter') play('relic');

  drawMission();
  openSheet();
}

function togSel(id) {
  const i = sel.indexOf(id);
  if (i > -1) sel.splice(i, 1);
  else {
    if (sel.length >= 3) return;
    sel.push(id);
  }
  if (sel.length >= 2) tutEvent('ships:2');
  if (sel.length >= 1) tutEvent('ships:1');
  drawMission();
}

/* Ship picker, shared by both panels. */
function shipPicks(voyage) {
  const bz = busyIds();
  const slots = voyage
    ? ['LEAD', 'CONSORT', 'CONSORT']
    : ['FRONT · FIRES FIRST', 'CENTER · +25% DAMAGE', 'REAR · TAKES 25% LESS'];

  return allShips().map(s => {
    const i = sel.indexOf(s.id);
    const crip = s.hull <= 0, atSea = bz.has(s.id), dis = crip || atSea, isF = s.id === 'FLAG';
    return `<div class="pick ${i > -1 ? 'sel' : ''} ${dis ? 'dis' : ''} ${isF ? 'flag' : ''}"
        ${dis ? '' : `data-act="pick-ship" data-id="${s.id}"`}>
      <div class="row"><b>${isF ? iconHTML('flag', 21) + ' ' : ''}${esc(s.name)}</b>${i > -1 ? `<span class="slot ${voyage ? 'blu' : ''}">${slots[i]}</span>` : ''}</div>
      <div class="sub">${tname(s)} · pwr ${power(s)} · hull ${Math.max(0, s.hull)}/${s.max} · hold ${s.cargo}${crip ? ' · CRIPPLED' : ''}${atSea ? ' · AT SEA' : ''}</div></div>`;
  }).join('');
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
    head += patrolActive(r.region)
      ? `<div class="sub" style="margin-top:4px">${REGIONS[r.region].n} is under patrol for another <b>${fmtDur(patrolLeft(r.region) / 1000)}</b> — one step of danger off every mission here.</div>`
      : `<div class="sub" style="margin-top:4px">${REGIONS[r.region].n} has no patrol in force. Win one here and the danger drops a step for a while.</div>`;
  }
  head += `<div class="row" style="margin-top:8px"><span class="mtype ${isBoss ? 'boss' : (isCh ? 'gold' : '')}">${MTYPE[r.type].n}</span></div>
    <div class="sub quote" style="margin-top:6px">${esc(isBoss ? r.bossDef.desc : MTYPE[r.type].tip)}</div>`;
  $('sheetHead').innerHTML = head;

  /* ---- body ---- */
  $('sheetBody').innerHTML = canVoyage(r) ? voyageBody(r, d) : battleBody(r, isBoss, isCh);
  refreshTut();
}

/* ---- cargo runs and dives ---- */
function voyageBody(r, d) {
  const fleet = sel.map(findShip).filter(Boolean);
  const cap = holdCap(fleet);
  const already = S.voyages.find(v => v.routeId === r.id);
  const slotOK = S.voyages.length < VOY_MAX_ACTIVE;
  const dur = fleet.length ? voyDuration(r, fleet) : r.len * 90;

  /* The job first, then the ships, then whether it can actually sail. */
  let manifest = '', checks = '', ready = false, label = 'Send Ships';

  if (r.type === 'cargo') {
    const g = GOODS[r.good];
    const have = goodsHeld(r.good);
    const haveGoods = have >= r.qty;
    const holdOK = cap >= r.qty;
    const odds = tradeChance(r, fleetPower(fleet));
    ready = haveGoods && holdOK && !!fleet.length;
    label = 'Load & Sail';

    manifest = `<div class="manifest">
        <div class="mrow"><span>Deliver</span><b>${iconHTML(r.good, 22)} ${goodsLine(r.good, r.qty)}</b></div>
        <div class="mrow"><span>To</span><b>${esc(r.dest)}</b></div>
        <div class="mrow"><span>Payment</span><b style="color:var(--goldhi)">${fmt(r.rew)}</b></div>
        <div class="mrow"><span>In store</span><b style="color:${haveGoods ? 'var(--grn)' : 'var(--red)'}">${have} ${g.unit}${haveGoods ? '' : ' — ' + (r.qty - have) + ' short'}</b></div>
      </div>`;

    checks = `<div class="card" style="--i:1"><div class="sub">
        Hold offered: <b style="color:${holdOK ? 'var(--grn)' : 'var(--yel)'}">${cap}</b> of ${r.qty} needed${fleet.length ? '' : ' — pick ships above'}<br>
        Arrives intact: <b>${fleet.length ? odds + '%' : '—'}</b> — a heavier escort and a quieter region both help<br>
        Time away: <b>${fleet.length ? fmtDur(dur) : '—'}</b><br>
        Notoriety on delivery: <b style="color:var(--gold)">+${notoGain(r)}</b>
        ${already ? '<br><b style="color:var(--blu)">A fleet is already running this contract.</b>' : ''}
      </div></div>`;
    if (!haveGoods) {
      checks += `<div class="sub center warnline">Buy ${g.n.toLowerCase()} in the Market before this can sail.</div>`;
    } else if (!holdOK && fleet.length) {
      checks += `<div class="sub center warnline">Those ships hold ${cap}; the consignment is ${r.qty}. Add another ship or upgrade the flagship's hold.</div>`;
    }
  } else {
    const reach = diveReachable(r);
    const chests = fleet.length ? diveChests(r, fleet) : 0;
    const value = chestValue(r);
    ready = reach && !!fleet.length;
    label = 'Send Divers';

    manifest = `<div class="manifest">
        <div class="mrow"><span>Depth</span><b>${DEPTH_NAMES[r.depth]} · ${r.depth}</b></div>
        <div class="mrow"><span>Your bell</span><b style="color:${reach ? 'var(--grn)' : 'var(--red)'}">${esc(BELL_NAMES[S.bell])} · reaches ${bellDepth()}</b></div>
        <div class="mrow"><span>Chest value</span><b style="color:var(--goldhi)">${iconHTML('chest', 22)} ${value} each</b></div>
      </div>`;

    checks = `<div class="card" style="--i:1"><div class="sub">
        No enemies here — a wreck dive is never a fight.<br>
        Chests expected: <b>${fleet.length ? '≈ ' + chests : '—'}</b>${fleet.length ? ` · about <b style="color:var(--goldhi)">${chests * value}</b> reales, sold on the quay` : ' — pick ships above'}<br>
        A bell deeper than the site needs brings up more; your hold caps the haul.<br>
        Also aboard: <b style="color:var(--goldhi)">${fmt(r.rew) || '—'}</b><br>
        Time away: <b>${fleet.length ? fmtDur(dur) : '—'}</b><br>
        Notoriety: <b style="color:var(--gold)">+${notoGain(r)}</b>
      </div></div>`;
    if (!reach) {
      checks += `<div class="sub center warnline">This wreck lies at depth ${r.depth} and your bell reaches ${bellDepth()}. Upgrade the diving bell in the Market.</div>`;
    }
  }

  return `${manifest}
    <div class="sub" style="margin-bottom:10px">Pick up to three ships. They leave your fleet for the time shown and cannot fight until they return.</div>
    <div id="shipPicks">${shipPicks(true)}</div>
    ${checks}
    <div class="grid2">
      <button class="btn" data-act="close-sheet">Cancel</button>
      <button class="btn blu" id="sailBtn" ${ready && slotOK && !already ? '' : 'disabled'} data-act="send-ships">${label}</button>
    </div>
    ${!slotOK ? `<div class="sub center warnline">You can only have ${VOY_MAX_ACTIVE} fleets at sea at once. Collect one first.</div>` : ''}`;
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
    const bits = [
      c.dest ? `Carry it through and the port of <b>${PORTS[c.dest].n}</b> opens to you for good, with contracts of its own.` : '',
      c.prize && c.prize.piece ? `<b style="color:var(--goldhi)">Collectible: ${esc(c.prize.piece)}</b>.` : '',
      c.prize && c.prize.boon ? `<b style="color:var(--goldhi)">A permanent flagship refit.</b>` : '',
      c.prize && c.prize.gems ? `<b style="color:var(--goldhi)">A treasure map worth ${c.prize.gems} gems.</b>` : '',
      others.length ? `<span class="sub">Also on offer here: ${others.map(o =>
        `<button class="linkbtn" data-act="mission" data-id="ch_${o.id}">${esc(o.n)}</button>`).join(', ')}</span>` : ''
    ].filter(Boolean).join(' ');
    if (bits) extra = `<div class="card chartercard" style="--i:0"><div class="sub">${bits}</div></div>`;
  }

  return `${extra}
    <div class="sub" style="margin-bottom:10px">Pick up to three ships. The order you pick sets their position in the line — tap order matters.${isBoss ? ' <b style="color:var(--goldhi)">Your flagship sails or nobody does.</b>' : ''}</div>
    <div id="shipPicks">${shipPicks(false)}</div>
    <div class="card ${isBoss ? 'bosscard' : ''}" style="--i:1"><div class="sub">
      Your fleet power <b style="color:${fp >= r.power ? 'var(--grn)' : 'var(--yel)'}">${fp}</b>${r.power ? ' — ' + r.power + ' recommended' : ''}<br>
      ${r.type === 'patrol' ? `Winning suppresses danger across <b>${REGIONS[r.region].n}</b> for a while, which makes every cargo run through it safer<br>` : ''}
      Notoriety on victory: <b style="color:var(--gold)">+${notoGain(r)}</b> — fills the regional bar that summons the admiral<br>
      Reward: <b style="color:var(--goldhi)">${fmt(r.rew)}</b>${isBoss && r.bossDef.unlocks ? ' · opens ' + REGIONS[r.bossDef.unlocks].n : ''}</div></div>
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

function doAttack() {
  const r = curRoute;
  const fleet = sel.map(findShip).filter(Boolean);
  /* The tutorial's first fight is fixed and winnable. */
  const forcedTut = tutActive() && r.id === 'c3';
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
  'pick-ship': d => togSel(d.id),
  'send-ships': doSendShips,
  attack: doAttack,
  'close-sheet': closeSheet
});
