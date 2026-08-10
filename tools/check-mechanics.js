/* The rules the game must not quietly stop obeying.

   These are all things that were true when they were written and are exactly
   the kind of thing a later change breaks without anybody noticing, because
   nothing on screen looks different when they fail.

     1. A drawn line-up is drawn ONCE. Closing a mission and opening it again
        must not produce different ships — with a band in play that would be a
        slot machine, and rerolling was removed on purpose.
     2. There is always a fight. Clearing a hunting ground empties it for a
        while, so the guarantee is three tappable fights per region at all
        times — never "the hunt is always there".
     3. There is always a way back from zero. A holed flagship, an empty purse
        and an empty hold must still leave a ship that can sail.
     4. Every prize choice pays exactly one kind of thing, and there is no
        walking away from one.
     5. Switching tabs lands you at the top of the new screen.
     6. A better bell puts deeper wrecks on the chart, and a wreck you have
        emptied comes off it.
     7. The chart zooms, and every port sits on land.
     8. Every region offers a convoy, and no two ships in a fleet share a name.
     9. One diving bell means one wreck at a time — refused in the systems layer,
        and said on the button before it is pressed.
    10. Everything a fight was worth reaches the account, and only the account.
    11. A bounty is offered only while her clock runs, and leaves when it stops.

   Run:  node tools/check-mechanics.js [url] */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-mechanics: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  const bad = [];
  p.on('pageerror', e => bad.push('[pageerror] ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/404|Failed to load resource/.test(t)) bad.push('[console] ' + t);
  });

  const fresh = async patch => {
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('#titleScr.on');
    await p.click('[data-act="title-new"]');
    await p.waitForTimeout(800);
    if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
    await p.waitForTimeout(500);
    if (patch) {
      await p.evaluate(o => {
        const s = JSON.parse(localStorage.getItem('saltpowder'));
        Object.assign(s, o);
        localStorage.setItem('saltpowder', JSON.stringify(s));
      }, patch);
      await p.reload({ waitUntil: 'networkidle' });
      await p.waitForSelector('#titleScr.on');
      await p.click('[data-act="title-continue"]');
    }
    await p.waitForSelector('#app.on');
    await p.waitForTimeout(700);
  };

  /* The enemy line-up folds up by default now — a card four hundred pixels tall
     pushed the fleet off the bottom of the sheet. Expand it before reading it,
     because who is out there by NAME is the thing this rule is about. */
  /* The line-up is a card a hull now, not a text row — the identity of a draw
     is her name and what she rates at. Odds are deliberately left out: they
     move with the ships you have picked, and what this is checking is that the
     ENEMIES do not. */
  const foeLine = () => p.evaluate(async () => {
    if (!document.querySelectorAll('.foelist .foecard').length) {
      const t = document.querySelector('[data-act="toggle-foes"]');
      if (t) { t.click(); await new Promise(r => setTimeout(r, 300)); }
    }
    return [...document.querySelectorAll('.foelist .foecard')].map(f => {
      const name = f.querySelector('b');
      const pow = f.querySelector('.foestat b');
      return (name ? name.textContent.trim() : '') + ' ' + (pow ? pow.textContent.trim() : '');
    }).join(' | ');
  });

  /* ---- 1. the draw is drawn once ---- */
  console.log('1. a line-up is drawn once, not every time you look at it');
  await fresh({ gold: 9000 });
  await p.click('#tabRoutes');
  await p.waitForTimeout(1300);
  await p.click('#node_c4');                       // a raid: always a fight
  await p.waitForSelector('#overlay.vis');
  await p.waitForTimeout(600);
  const first = await foeLine();
  let same = true;
  for (let i = 0; i < 5; i++) {
    await p.click('[data-act="close-sheet"]');
    await p.waitForTimeout(450);
    await p.click('#node_c4');
    await p.waitForSelector('#overlay.vis');
    await p.waitForTimeout(450);
    if (await foeLine() !== first) { same = false; break; }
  }
  console.log('   drawn: ' + first);
  console.log('   identical across 6 openings: ' + same);
  if (!first) bad.push('no enemies drawn for a raid at all');
  if (!same) bad.push('reopening a mission redrew the enemies — that is a reroll');
  await p.click('[data-act="close-sheet"]');
  await p.waitForTimeout(400);

  /* ---- 2. there is always a fight, even with the hunt cleared ---- */
  console.log('2. three fights per region even while a hunting ground is empty');
  const hunts = await p.evaluate(async () => {
    const routes = await import('/src/data/routes.js');
    const world = await import('/src/data/world.js');
    const rs = routes.makeRoutes();
    const out = {};
    for (const rk in world.REGIONS) {
      const mine = rs.filter(r => r.region === rk && !r.requiresBoss);
      const fights = mine.filter(r => world.BATTLE_TYPES.includes(r.type));
      out[rk] = {
        hunt: fights.some(r => r.type === 'hunt'),
        total: fights.length,
        /* what is left standing while the hunting ground is quiet */
        without: fights.filter(r => r.type !== 'hunt').length
      };
    }
    return out;
  });
  for (const rk in hunts) {
    console.log(`   ${rk}: ${hunts[rk].total} fights, ${hunts[rk].without} of them with the hunt cleared`);
    if (!hunts[rk].hunt) bad.push(`${rk} has no hunting ground at all`);
    if (hunts[rk].without < 3) {
      bad.push(`${rk} drops to ${hunts[rk].without} fights once the hunt is cleared — needs 3`);
    }
  }

  /* clearing one takes it off the chart, and it comes back */
  const huntBefore = await p.locator('#node_ch1').count();
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.hunts = { ch1: Date.now() + 5 * 60 * 1000 };
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on');
  await p.click('#tabRoutes');
  await p.waitForTimeout(1300);
  const huntCooling = await p.locator('#node_ch1').count();
  const stillFightable = await p.locator('[id^="node_"]').count();
  console.log(`   hunting ground on the chart: ${!!huntBefore} → cleared → ${!!huntCooling}`
    + ` (${stillFightable} markers still there)`);
  if (!huntBefore) bad.push('the Caribbean hunting ground was never on the chart');
  if (huntCooling) bad.push('a cleared hunting ground is still on the chart');

  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.hunts = {};
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on');
  await p.click('#tabRoutes');
  await p.waitForTimeout(1300);
  if (!(await p.locator('#node_ch1').count())) bad.push('the hunting ground never came back');
  else console.log('   and the next one turns up when the cooldown is out');

  /* ---- 3. a way back from zero ---- */
  console.log('3. broke, holed and empty is still not a dead save');
  await fresh();
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.gold = 0;
    s.goods = { sugar: 0, rum: 0, tobacco: 0, wine: 0, spice: 0 };
    s.mats = { wood: 0, metal: 0, cloth: 0 };
    s.ships.forEach(x => { x.hull = 0; });
    s.flag.hull = 0;
    s.careenAt = 0;
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on');
  await p.waitForTimeout(900);

  const careen = p.locator('[data-act="free-repair"]:not([disabled])');
  if (!(await careen.count())) bad.push('no free repair offered — the save is dead');
  else {
    await careen.click();
    await p.waitForTimeout(700);
    const hull = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('saltpowder'));
      return { hull: s.flag.hull, max: s.flag.max };
    });
    console.log(`   free repair: flagship ${hull.hull}/${hull.max}`);
    if (hull.hull <= 0) bad.push('the free repair left the flagship unable to sail');
    if (hull.hull >= hull.max) bad.push('the free repair fixed her completely — it must be worse than paying');
    /* and the offer is gone the moment the player can pay for a real one */
    const offered = await p.evaluate(async () => {
      const s = await import('/src/core/state.js');
      const sel = await import('/src/core/selectors.js');
      s.S.gold = 999999;
      return sel.freeRepairOffered();
    });
    console.log('   still offered once the purse can cover it: ' + offered);
    if (offered) bad.push('the free repair is offered to a player who can afford a real one');

    /* and with that hull she can actually take the hunt */
    await p.click('#tabRoutes');
    await p.waitForTimeout(1200);
    await p.click('#node_ch1');
    await p.waitForSelector('#overlay.vis');
    await p.waitForTimeout(600);
    await p.locator('#shipPicks .pickrow:not(.dis)').first().click();
    await p.waitForTimeout(400);
    const canSail = !(await p.locator('#sailBtn').isDisabled());
    console.log('   and she can sail the hunting ground: ' + canSail);
    if (!canSail) bad.push('careened flagship still cannot take a fight — the save is dead');
    await p.click('[data-act="close-sheet"]');
    await p.waitForTimeout(400);
  }

  /* ---- 4. prize choices ---- */
  console.log('4. prizes pay one thing each, and cannot be declined');
  const src = await p.evaluate(() => fetch('/src/ui/result.js').then(r => r.text()));
  if (/Let Go/.test(src)) bad.push('the Let Go option is still there');
  if (/SCRAP_GOLD/.test(src)) bad.push('scuttling still pays gold as well as supplies');
  for (const need of ["'capture'", "'salvage'", "'ransom'", "'chest'"]) {
    if (!src.includes(need)) bad.push('prize mode missing: ' + need);
  }
  console.log('   modes: keep / scuttle / ransom / chest, no walk-away');

  /* ---- 5. scroll ---- */
  console.log('5. a new screen starts at the top of itself');
  await fresh({ gold: 90000, docks: 6 });
  await p.click('#tabFleet');
  await p.waitForTimeout(900);
  await p.evaluate(() => { document.getElementById('main').scrollTop = 400; });
  await p.waitForTimeout(200);
  const before = await p.evaluate(() => document.getElementById('main').scrollTop);
  await p.click('#tabFlag');
  await p.waitForTimeout(1100);
  const after = await p.evaluate(() => document.getElementById('main').scrollTop);
  console.log(`   scrolled to ${before}, switched tab, now at ${after}`);
  if (before <= 0) console.log('   (could not scroll far enough to prove it — screen was short)');
  else if (after !== 0) bad.push(`tab switch kept the old scroll position (${after})`);

  /* ---- 6. wrecks follow the bell, and are consumed ---- */
  console.log('6. a better bell charts deeper wrecks; an emptied one comes off');
  await fresh({ gold: 90000 });
  const before6 = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    return (s.dives || []).map(d => d.n + '@' + d.depth);
  });
  await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const dv = await import('/src/core/dives.js');
    st.S.bell = 3;
    dv.rechartDives();
    st.save();
  });
  const after6 = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    return (s.dives || []).map(d => d.n + '@' + d.depth);
  });
  console.log('   bell 0: ' + JSON.stringify(before6));
  console.log('   bell 3: ' + JSON.stringify(after6));
  const deepest = Math.max(0, ...after6.map(x => +x.split('@')[1]));
  if (!before6.length) bad.push('no wrecks charted at all');
  if (deepest < 4) bad.push(`a bell reaching depth 4 charted nothing deeper than ${deepest}`);

  const gone = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const dv = await import('/src/core/dives.js');
    const target = st.S.dives[0];
    dv.clearDive(target.id);
    st.save();
    return { emptied: target.n, left: st.S.dives.map(d => d.n), count: st.S.dives.length };
  });
  console.log(`   emptied "${gone.emptied}" — ${gone.count} wrecks still charted`);
  if (gone.left.includes(gone.emptied)) {
    bad.push('the wreck that was just emptied was immediately re-charted');
  }
  if (!gone.count) bad.push('emptying a wreck left nowhere to dive');

  /* ---- 7. the chart zooms, and there is land under it ---- */
  console.log('7. the chart zooms, and the ports are on a coast');
  /* Several ports charted, so there are port markers to check against the
     coast — a brand new save has one port and a charter standing on it. */
  await fresh({ gold: 9000, unlocked: ['caribbean', 'gulf'],
    ports: ['staug', 'charlestowne', 'jamestown', 'veracruz', 'boston', 'newyork'] });
  await p.click('#tabRoutes');
  await p.waitForTimeout(1600);

  /* Measured off the transform, not the scrolled size: once the chart is
     smaller than the window, scrollWidth stops shrinking with it. */
  const zoomed = await p.evaluate(() => {
    const sc = document.getElementById('mapscroll');
    const box = document.getElementById('mapzoom');
    const r = sc.getBoundingClientRect();
    const scale = () => {
      const m = /scale\(([\d.]+)\)/.exec(box.style.transform || '');
      return m ? +m[1] : 1;
    };
    const fire = (dy, n) => { for (let i = 0; i < n; i++) sc.dispatchEvent(new WheelEvent('wheel', {
      deltaY: dy, ctrlKey: true, bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); };
    const before = scale();
    fire(120, 6);
    const out = scale();
    fire(-120, 12);
    const inn = scale();
    return { before, out, inn, land: document.querySelectorAll('#mapsvg .land').length };
  });
  console.log(`   zoom ${zoomed.before} → ${zoomed.out.toFixed(2)} out → ${zoomed.inn.toFixed(2)} in`);
  console.log('   landmasses drawn: ' + zoomed.land);
  if (zoomed.out >= zoomed.before) bad.push('pinching out did not shrink the chart');
  if (zoomed.inn <= zoomed.out) bad.push('pinching in did not grow the chart');
  if (!zoomed.land) bad.push('no land under the chart — every port is a dot in open water');

  /* A port must sit on land, or a delivery is a delivery to the sea. */
  const ashore = await p.evaluate(() => {
    const svg = document.getElementById('mapsvg');
    const lands = [...svg.querySelectorAll('.land')];
    const out = [];
    svg.querySelectorAll('g.mapnode[id^="node_k_"]').forEach(g => {
      const c = g.querySelector('circle');
      if (!c) return;
      const pt = svg.createSVGPoint();
      pt.x = +c.getAttribute('cx'); pt.y = +c.getAttribute('cy');
      out.push({ id: g.id, on: lands.some(L => L.isPointInFill(pt)) });
    });
    return out;
  });
  const adrift = ashore.filter(x => !x.on);
  console.log(`   ports on a coast: ${ashore.length - adrift.length}/${ashore.length}`);
  if (!ashore.length) bad.push('no port markers found to check against the coast');
  if (adrift.length) bad.push('ports drawn in open water: ' + adrift.map(x => x.id).join(', '));

  /* ---- 8. convoys, and names that are actually names ---- */
  console.log('8. every region carries a convoy, and no two hulls share a name');
  const convoys = await p.evaluate(async () => {
    const routes = await import('/src/data/routes.js');
    const world = await import('/src/data/world.js');
    const rs = routes.makeRoutes();
    const out = {};
    for (const rk in world.REGIONS) {
      out[rk] = rs.filter(r => r.region === rk && r.type === 'convoy' && !r.requiresBoss).length;
    }
    return out;
  });
  console.log('   convoys: ' + JSON.stringify(convoys));
  for (const rk in convoys) if (!convoys[rk]) bad.push(rk + ' has no convoy to take');

  /* A convoy is worth taking because of what is in it. */
  const holds = await p.evaluate(async () => {
    const loot = await import('/src/systems/loot.js');
    const st = await import('/src/core/state.js');
    const before = Object.values(st.S.goods).reduce((a, n) => a + n, 0);
    const got = loot.convoyHaul('caribbean', 1);
    const after = Object.values(st.S.goods).reduce((a, n) => a + n, 0);
    return { kinds: got.length, gained: after - before };
  });
  console.log(`   a Caribbean convoy carries ${holds.kinds} kinds, ${holds.gained} units`);
  if (holds.kinds < 2) bad.push('a convoy carried fewer than two kinds of goods');
  if (holds.gained < 8) bad.push('a convoy carried only ' + holds.gained + ' units — not worth the fight');

  /* Twenty captures, no repeated names. */
  const names = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    st.S.ships = [];
    for (let i = 0; i < 20; i++) st.S.ships.push(st.newShip('brig', 1));
    const all = [st.S.flag.name, ...st.S.ships.map(s => s.name)];
    return { all, uniq: new Set(all).size };
  });
  console.log(`   ${names.all.length} hulls, ${names.uniq} distinct names`);
  if (names.uniq !== names.all.length) bad.push('two ships in one fleet share a name');

  /* ---- 9. one bell, one wreck ----

     The player owns exactly one diving bell, so exactly one wreck can be worked
     at a time. That has to be refused in the systems layer — a UI that only
     greys a button is a rule anybody can walk around — AND said on the button,
     because being allowed to choose a ship and then told no is the same
     information delivered as a telling-off. */
  console.log('9. one diving bell, one dive');
  const bell = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const voy = await import('/src/systems/voyages.js');
    const sel = await import('/src/core/selectors.js');
    const dives = await import('/src/core/dives.js');

    /* Steps 6 and 8 above emptied a wreck and rebuilt the fleet, so this starts
       from a clean chart of its own rather than whatever they left behind. */
    const world = await import('/src/data/world.js');
    st.S.unlocked = Object.keys(world.REGIONS);
    st.S.bell = 3;
    st.S.voyages = [];
    st.S.dives = [];
    st.S.diveUsed = [];
    st.S.ships = [st.newShip('brig'), st.newShip('brig')];
    dives.rechartDives();

    /* Wrecks are a live set built on top of the static route table, so they only
       exist in allRoutes() — the `routes` export never carries them. */
    const wrecks = sel.allRoutes().filter(r => r.type === 'dive' && sel.diveReachable(r));
    if (wrecks.length < 2) return { wrecks: wrecks.length };

    const ship = st.S.ships[0] || st.S.flag;
    const first = voy.launchVoyage(wrecks[0], [ship]);
    const outNow = sel.diveOut();
    /* A second bell going down on a second wreck, with a second ship, so the
       only thing that can refuse it is the bell rule itself. */
    const other = st.S.ships[1] || st.S.flag;
    const second = voy.launchVoyage(wrecks[1], [other]);
    return { wrecks: wrecks.length, first, outNow, second, running: st.S.voyages.length };
  });
  if (bell.wrecks < 2) {
    bad.push('fewer than two reachable wrecks — cannot test the one-bell rule');
  } else {
    console.log(`   first dive launched: ${bell.first}, bell reads as out: ${bell.outNow}, `
      + `second refused: ${!bell.second} (${bell.running} voyage running)`);
    if (!bell.first) bad.push('the first dive would not launch at all');
    if (!bell.outNow) bad.push('a dive is running but the bell does not read as out');
    if (bell.second) bad.push('a second wreck was worked while the bell was already down');
    if (bell.running !== 1) bad.push(`${bell.running} voyages running after one dive and one refusal`);
  }

  /* And the sheet has to say so before the button is pressed. */
  const said = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const sel = await import('/src/core/selectors.js');
    const wreck = sel.allRoutes().find(r => r.type === 'dive' && sel.diveReachable(r)
      && !st.S.voyages.some(v => v.routeId === r.id));
    if (!wreck) return null;
    /* Step 7 already left us on the chart, so clicking the tab is a no-op and
       the map would still be showing the wrecks from before this step rewrote
       them. Repaint it directly. */
    const shell = await import('/src/ui/shell.js');
    shell.gotoTab('routes', true);
    shell.render();
    await new Promise(r => setTimeout(r, 700));
    const node = document.querySelector(`.mapnode[data-id="${wreck.id}"]`);
    if (!node) return null;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    const pick = document.querySelector('[data-act="pick-ship"]');
    if (pick) { pick.click(); await new Promise(r => setTimeout(r, 500)); }
    const btn = document.getElementById('sailBtn');
    return {
      disabled: !btn || btn.disabled,
      warn: (document.querySelector('#sheetBody .warnline') || {}).textContent || ''
    };
  });
  if (!said) bad.push('could not open a second wreck to check what the sheet says');
  else {
    console.log('   second wreck: button disabled ' + said.disabled + ', says "' + said.warn.trim() + '"');
    if (!said.disabled) bad.push('the second wreck still offers a live Send Divers button');
    if (!/bell/i.test(said.warn)) bad.push('the sheet does not explain that the bell is already down');
  }

  /* ---- 10. everything a fight was worth lands on one screen ----

     The haul used to be reported in four places: a reward row on the victory
     banner, a strongbox at the top of the report, a modal of its own for a
     collectible, and the prizes paying out one at a time underneath. None of
     them was the total, and three had to be dismissed to reach the next.

     So the rule is that the account is the only account: whatever a fight
     produced — coin, materials, goods, the barrel a win is worth, hulls kept,
     a piece for the great cabin, an admiral's title — is on it, and the banner
     it came from lists none of it. */
  console.log('10. every kind of winnings reaches the account');
  const acct = await p.evaluate(async () => {
    const res = await import('/src/ui/result.js');
    const st = await import('/src/core/state.js');
    st.S.docks = 9;

    /* The things the fight hands over before the report exists. */
    res.carry({ barrels: 1, title: 'Scourge of the Windward' });
    res.carry({ piece: { name: 'Brass Astrolabe', setName: 'Kit', have: 2, of: 4 } });

    res.showResult({
      route: { id: 'x', region: 'caribbean', n: 'Test Water', type: 'boss',
        rew: { gold: 900, wood: 10 } },
      success: true, msg: 'Test.', noto: 10,
      spoils: { mats: { metal: 5 }, goods: { good: 'rum', n: 7, name: 'Rum' } },
      holds: [{ good: 'sugar', n: 12, name: 'Sugar' }],
      captives: []
    });
    await new Promise(r => setTimeout(r, 400));

    const names = [...document.querySelectorAll('.tcard .tname')].map(e => e.textContent.trim().toLowerCase());
    return {
      names,
      grid: getComputedStyle(document.querySelector('.tally')).display,
      /* Nothing may be reported on the banner that the account also reports. */
      bannerHTML: document.getElementById('banner').innerHTML
    };
  });
  console.log('   account carries: ' + acct.names.join(', '));
  const want = ['gold', 'wood', 'metal', 'rum', 'sugar', 'fire barrels', 'brass astrolabe', 'title earned'];
  want.forEach(w => {
    if (!acct.names.some(n => n === w)) bad.push(`the account does not carry "${w}"`);
  });
  if (acct.grid !== 'grid') bad.push('the account is not laid out as a grid');
  if (/barrel/i.test(acct.bannerHTML)) {
    bad.push('the victory banner still lists the barrel — it belongs to the account alone');
  }

  /* ---- 11. a bounty turns up, and a bounty leaves ----

     The one thing on the chart with a clock on it. Everything else is a place
     and will still be there tomorrow; she is a person working a region for a
     while. The rules that make that fair rather than merely stressful:

       she is offered as a route only while her window is open;
       when it closes she leaves the save, and her draw leaves with her;
       taking her also takes her off, and the region waits before another;
       never more than one per region, so the marker stays an event. */
  console.log('11. a bounty turns up, runs on a clock, and goes');
  const bty = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const bo = await import('/src/core/bounties.js');
    const sel = await import('/src/core/selectors.js');
    const cfg = await import('/src/core/config.js');
    const world = await import('/src/data/world.js');

    st.S.unlocked = Object.keys(world.REGIONS);
    st.S.bounties = []; st.S.bountyNext = {}; st.S.draws = {};
    bo.ensureBounties();
    const charted = st.S.bounties.length;

    /* Running it again must not double up — it is called on every render. */
    bo.ensureBounties(); bo.ensureBounties();
    const afterRepeats = st.S.bounties.length;
    const perRegion = {};
    st.S.bounties.forEach(x => { perRegion[x.region] = (perRegion[x.region] || 0) + 1; });

    const asRoutes = sel.allRoutes().filter(r => r.type === 'bounty');
    const one = asRoutes[0];
    const live = one ? { id: one.id, mult: one.ratingMult, station: !!one.station } : null;
    /* Her draw, so we can prove it is dropped when she goes. */
    if (one) { const en = await import('/src/systems/enemies.js'); en.genEnemies(one); }
    const hadDraw = !!(one && st.S.draws[one.id]);

    /* Wind every clock past its end and look again. */
    st.S.bounties.forEach(x => { x.endsAt = Date.now() - 1; });
    const routesWhenDead = sel.allRoutes().filter(r => r.type === 'bounty').length;
    const leftInSave = st.S.bounties.filter(x => x.endsAt < Date.now() - 0).length;
    const drawGone = one ? !st.S.draws[one.id] : true;

    return {
      charted, afterRepeats, perRegion, live, hadDraw,
      routesWhenDead, leftInSave, drawGone,
      max: cfg.BOUNTY_MAX, lifeMin: cfg.BOUNTY_LIFE_MS / 60000, gapMin: cfg.BOUNTY_GAP_MS / 60000
    };
  });
  console.log(`   charted ${bty.charted}, still ${bty.afterRepeats} after re-running; `
    + `${bty.lifeMin} min windows, ${bty.gapMin} min gap`);
  console.log('   per region: ' + JSON.stringify(bty.perRegion));
  if (!bty.charted) bad.push('no bounty was ever charted');
  if (bty.afterRepeats !== bty.charted) bad.push('ensureBounties is not idempotent — it charts more each call');
  Object.keys(bty.perRegion).forEach(rk => {
    if (bty.perRegion[rk] > bty.max) bad.push(`${rk} carries ${bty.perRegion[rk]} bounties at once`);
  });
  if (!bty.live) bad.push('a charted bounty is not offered as a route');
  else if (!(bty.live.mult > 1)) bad.push('a bounty is not drawn above her water — she is no harder than a raid');
  if (!bty.hadDraw) bad.push('a bounty draws no line-up');
  console.log(`   after her window: ${bty.routesWhenDead} routes, ${bty.leftInSave} left in the save, `
    + `draw dropped ${bty.drawGone}`);
  if (bty.routesWhenDead) bad.push('an expired bounty is still offered');
  if (bty.leftInSave) bad.push('an expired bounty stays in the save for ever');
  if (!bty.drawGone) bad.push("an expired bounty's line-up is kept — the next captain inherits her ships");

  await b.close();
  console.log('\n=== ' + bad.length + ' problem(s) ===');
  bad.forEach(x => console.log(' * ' + x));
  if (!bad.length) console.log('every rule the game quietly depends on still holds');
  process.exit(bad.length ? 1 : 0);
})();
