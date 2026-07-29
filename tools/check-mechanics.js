/* The rules the game must not quietly stop obeying.

   These are all things that were true when they were written and are exactly
   the kind of thing a later change breaks without anybody noticing, because
   nothing on screen looks different when they fail.

     1. A drawn line-up is drawn ONCE. Closing a mission and opening it again
        must not produce different ships — with a band in play that would be a
        slot machine, and rerolling was removed on purpose.
     2. There is always a fight. Every unlocked region carries a hunting ground
        that never runs out and never gates.
     3. There is always a way back from zero. A holed flagship, an empty purse
        and an empty hold must still leave a ship that can sail.
     4. Every prize choice pays exactly one kind of thing, and there is no
        walking away from one.
     5. Switching tabs lands you at the top of the new screen.

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

  const foeLine = () => p.evaluate(() =>
    [...document.querySelectorAll('.foelist .foe')]
      .map(f => f.textContent.replace(/\s+/g, ' ').trim()).join(' | '));

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

  /* ---- 2. there is always a fight ---- */
  console.log('2. every unlocked region has a hunting ground');
  const hunts = await p.evaluate(async () => {
    const routes = await import('/src/data/routes.js');
    const world = await import('/src/data/world.js');
    const rs = routes.makeRoutes();
    const out = {};
    for (const rk in world.REGIONS) {
      const mine = rs.filter(r => r.region === rk);
      out[rk] = {
        hunt: mine.some(r => r.type === 'hunt' && !r.requiresBoss),
        fights: mine.filter(r => world.BATTLE_TYPES.includes(r.type) && !r.requiresBoss).length
      };
    }
    return out;
  });
  for (const rk in hunts) {
    console.log(`   ${rk}: ${hunts[rk].fights} ungated fights, hunting ground: ${hunts[rk].hunt}`);
    if (!hunts[rk].hunt) bad.push(`${rk} has no ungated hunting ground`);
    if (hunts[rk].fights < 3) bad.push(`${rk} has only ${hunts[rk].fights} ungated fights`);
  }
  const huntNode = await p.locator('#node_ch1').count();
  if (!huntNode) bad.push('the Caribbean hunting ground is not on the chart');

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

  const careen = p.locator('[data-act="careen"]:not([disabled])');
  if (!(await careen.count())) bad.push('nothing to careen with — the save is dead');
  else {
    await careen.click();
    await p.waitForTimeout(700);
    const hull = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('saltpowder'));
      return { hull: s.flag.hull, max: s.flag.max, cooldown: s.careenAt > Date.now() };
    });
    console.log(`   careened: flagship ${hull.hull}/${hull.max}, back on cooldown: ${hull.cooldown}`);
    if (hull.hull <= 0) bad.push('careening left the flagship unable to sail');
    if (hull.hull >= hull.max) bad.push('careening repaired her completely — it must be worse than paying');
    if (!hull.cooldown) bad.push('careening did not go on cooldown — it is free repairs forever');

    /* and with that hull she can actually take the hunt */
    await p.click('#tabRoutes');
    await p.waitForTimeout(1200);
    await p.click('#node_ch1');
    await p.waitForSelector('#overlay.vis');
    await p.waitForTimeout(600);
    await p.locator('#shipPicks .railcard:not(.dis)').first().click();
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

  await b.close();
  console.log('\n=== ' + bad.length + ' problem(s) ===');
  bad.forEach(x => console.log(' * ' + x));
  if (!bad.length) console.log('every rule the game quietly depends on still holds');
  process.exit(bad.length ? 1 : 0);
})();
