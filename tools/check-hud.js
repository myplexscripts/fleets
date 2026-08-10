/* Three things that are invisible until they are wrong:

     the SCENE BAR is on every screen, names the screen you are on, carries
     gold and the way into settings, and offers the door to the stores only
     where you deal in goods — it is one strip drawn by the shell, not five
     screens each deciding for themselves;
     the chart's key names every marker on it — the struck colours included —
     and folds away when you are done with it;
     the at-sea countdown and its meter run on their own, patched in place by
     the world ticker rather than only moving when the screen is rebuilt.

   The first of these used to assert the opposite: a purse drawn by Port and
   Market only, with no header anywhere. That was the design when five screens
   each drew their own chrome, and it is exactly what made them read as five
   separate builds — so the check now guards the rule that replaced it. A
   checker that outlives the decision it was written for only ever fails
   correct work.

   Needs playwright-core and the game served; see the README. */
let chromium = null;
for (const where of ['playwright-core', require('path').join(process.cwd(), 'node_modules', 'playwright-core')]) {
  try { chromium = require(where).chromium; break; } catch (e) { /* try the next */ }
}
const errors = [];
(async () => {
  if (!chromium) {
    console.log('skipped — needs playwright-core and the game served (see README)');
    return;
  }
  const b = await chromium.launch({
    executablePath: process.env.SP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => console.log('[pageerror] ' + e.message));
  await p.goto(process.env.SP_URL || 'http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-new"]'); await p.waitForTimeout(900);
  if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.gold = 4200; s.bossBeaten = { caribbean: true }; s.unlocked = ['caribbean','gulf'];
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on'); await p.waitForTimeout(900);

  console.log('1. the scene bar is on every screen, and names it');

  /* Every screen gets the bar, every screen gets its name on it, and every
     screen gets gold and the wheel. Those four are the frame — if one of them
     is conditional the screens have started disagreeing again. */
  const EXPECT = { fleet:'Port', flag:'Flagship', routes:'Chart', voy:'At Sea', port:'Market' };
  const seen = {};
  for (const [tab, key] of [['tabFleet','fleet'],['tabFlag','flag'],['tabRoutes','routes'],['tabVoy','voy'],['tabPort','port']]) {
    await p.click('#' + tab); await p.waitForTimeout(1300);
    seen[key] = {
      title: (await p.locator('#topbar .scenetitle').textContent().catch(() => '')).trim(),
      gold:  await p.locator('#topbar #wGold').count() > 0,
      wheel: await p.locator('#topbar #pauseBtn').count() > 0,
      stores:await p.locator('#topbar #wStores').count() > 0,
      /* nothing may float its own chrome inside the scroller any more */
      purse: await p.locator('main .purse').count() > 0
    };
  }
  console.log('   scene bar: ' + JSON.stringify(seen));
  for (const key of Object.keys(EXPECT)) {
    const s = seen[key];
    if (s.title !== EXPECT[key]) errors.push(key + ' names itself "' + s.title + '", expected "' + EXPECT[key] + '"');
    if (!s.gold)  errors.push('no gold on the scene bar on ' + key);
    if (!s.wheel) errors.push('no way into settings on ' + key);
    if (s.purse)  errors.push(key + ' is drawing chrome of its own inside the scroller');
  }
  /* The stores door is not universal — it belongs where goods are handled. */
  if (!seen.fleet.stores || !seen.port.stores) errors.push('stores door missing from Port or Market');
  if (seen.flag.stores || seen.routes.stores || seen.voy.stores) errors.push('stores door showing where nothing is traded');

  await p.click('#tabFleet'); await p.waitForTimeout(1200);
  const gold = (await p.locator('#topbar #wGold').textContent()).replace(/\s+/g, ' ').trim();
  const stores = (await p.locator('#topbar #wStores').textContent()).replace(/\s+/g, ' ').trim();
  console.log('   plates: ' + JSON.stringify([gold, stores]));
  if (!/^\d+$/.test(gold)) errors.push('gold plate is not just a number: ' + JSON.stringify(gold));
  if (/\d/.test(stores)) errors.push('the stores plate carries a number: ' + stores);
  if (!(await p.locator('#wStores[data-act="stores"]').count())) errors.push('stores plate does not open the stores');

  console.log('2. the key names the struck flag, and opens on request');
  await p.click('#tabRoutes'); await p.waitForTimeout(1500);
  /* The key is a dialog now — it was a permanent panel taking a third of the
     chart to answer a question the player asks twice. */
  if (await p.locator('.keygrid').count()) errors.push('the key is on the chart, not behind the button');
  await p.click('[data-act="legend"]'); await p.waitForTimeout(900);
  const words = (await p.locator('.keygrid .key span').allTextContents()).map(t => t.trim());
  console.log('   key: ' + JSON.stringify(words));
  if (!words.length) errors.push('the map button opened no key');
  if (!words.includes('Beaten')) errors.push('the struck flag is not in the key');
  await p.click('[data-dlg="ok"]'); await p.waitForTimeout(900);
  if (await p.locator('.keygrid').count()) errors.push('the key did not close');

  /* And the region strip carries the one thing the chart cannot show. */
  const seas = (await p.locator('.mapbar .sea b').allTextContents()).map(t => t.trim());
  const fleet = (await p.locator('.mapfleet').textContent().catch(() => '')).replace(/\s+/g, '');
  console.log('   strip: ' + JSON.stringify(seas) + ' free hulls ' + fleet);
  if (!seas.length) errors.push('no seas on the strip');
  if (!/\d+\/\d+/.test(fleet)) errors.push('the strip does not say how many hulls are free');

  console.log('3. the at-sea countdown and its meter run on their own');
  await p.click('#node_c1'); await p.waitForSelector('#overlay.vis'); await p.waitForTimeout(800);
  await p.locator('#shipPicks .pickrow.flag').click(); await p.waitForTimeout(500);
  await p.click('#sailBtn'); await p.waitForTimeout(900);
  await p.click('#tabVoy'); await p.waitForTimeout(1400);
  const t1 = (await p.locator('[data-voy] .clock').first().textContent()).trim();
  await p.waitForTimeout(3200);
  const t2 = (await p.locator('[data-voy] .clock').first().textContent()).trim();
  /* The meter is driven through --p, never through an inline width: an inline
     width would outrank the stylesheet's clamp() and hand the bar's one
     guarantee — that it cannot leave its own track — back to arithmetic. */
  const bar = p.locator('[data-voy] .meter').first();
  const m = await bar.evaluate(e => ({
    p: e.style.getPropertyValue('--p'),
    width: e.style.width,
    fill: getComputedStyle(e.querySelector('i')).width,
    track: getComputedStyle(e).width,
    h: getComputedStyle(e).height,
    fillH: getComputedStyle(e.querySelector('i')).height
  }));
  console.log('   clock ' + t1 + ' -> ' + t2 + ' (meter --p ' + m.p + ', fill ' + m.fill + ' of ' + m.track + ')');
  if (t1 === t2) errors.push('the countdown did not move: stuck at ' + t1);
  if (!m.p) errors.push('the voyage meter carries no --p');
  if (m.width) errors.push('the voyage meter is being driven by an inline width: ' + m.width);
  if (parseFloat(m.fill) > parseFloat(m.track) + 0.5) {
    errors.push('the meter fill is wider than its track: ' + m.fill + ' > ' + m.track);
  }
  if (parseFloat(m.fillH) > parseFloat(m.h) + 0.5) {
    errors.push('the meter fill is taller than its track: ' + m.fillH + ' > ' + m.h);
  }

  await b.close();
  errors.forEach(e => console.log(' * ' + e));
  console.log(errors.length ? '=== ' + errors.length + ' problem(s) ===' : 'clean run');
  process.exit(errors.length ? 1 : 0);
})();
