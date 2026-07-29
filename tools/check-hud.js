/* Three things that are invisible until they are wrong:

     the purse shows on Port and Market and nowhere else, and carries gold and
     a door rather than a row of totals;
     the chart's key names every marker on it — the struck colours included —
     and folds away when you are done with it;
     the at-sea countdown runs on its own, patched in place by the world ticker
     rather than only moving when the screen happens to be rebuilt.

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

  console.log('1. the purse is two plates, on two screens');
  const seen = {};
  for (const [tab, key] of [['tabFleet','fleet'],['tabFlag','flag'],['tabRoutes','routes'],['tabVoy','voy'],['tabPort','port']]) {
    await p.click('#' + tab); await p.waitForTimeout(1300);
    seen[key] = await p.locator('#resStrip:not(.hide)').count() > 0;
  }
  console.log('   purse visible: ' + JSON.stringify(seen));
  if (!seen.fleet || !seen.port) errors.push('purse missing from Port or Market');
  if (seen.flag || seen.routes || seen.voy) errors.push('purse showing where it should not');

  await p.click('#tabFleet'); await p.waitForTimeout(1200);
  const plates = await p.locator('#resStrip .resitem').allTextContents();
  console.log('   plates: ' + JSON.stringify(plates.map(t => t.trim())));
  if (plates.length !== 2) errors.push('expected 2 plates, got ' + plates.length);
  if (/\d/.test(plates[1] || '')) errors.push('the stores plate carries a number: ' + plates[1]);
  /* The coin glyph says "gold"; the word next to it was only costing the number
     its room once the title bar went and three things had to share one row. */
  if (!/^\d+$/.test((plates[0] || '').replace(/\s+/g, ' ').trim())) {
    errors.push('gold plate is not just a number: ' + JSON.stringify(plates[0]));
  }
  if (!(await p.locator('#wStores[data-act="stores"]').count())) errors.push('stores plate does not open the stores');

  console.log('2. the key names the struck flag, and folds away');
  await p.click('#tabRoutes'); await p.waitForTimeout(1500);
  const words = (await p.locator('.maphint .key span').allTextContents()).map(t => t.trim());
  console.log('   key: ' + JSON.stringify(words));
  if (!words.includes('Beaten')) errors.push('the struck flag is not in the key');
  await p.click('[data-act="legend"]'); await p.waitForTimeout(1200);
  const hidden = await p.locator('.maphint').isVisible().catch(() => false);
  const legHidden = await p.locator('.legend').isVisible().catch(() => false);
  console.log('   after toggle — key visible: ' + hidden + ', legend visible: ' + legHidden);
  if (hidden || legHidden) errors.push('the toggle did not hide the key');
  await p.click('[data-act="legend"]'); await p.waitForTimeout(1200);
  if (!(await p.locator('.maphint').isVisible())) errors.push('the toggle did not bring the key back');

  console.log('3. the at-sea countdown runs on its own');
  await p.click('#node_c1'); await p.waitForSelector('#overlay.vis'); await p.waitForTimeout(800);
  await p.locator('#shipPicks .railcard.flag').click(); await p.waitForTimeout(500);
  await p.click('#sailBtn'); await p.waitForTimeout(900);
  await p.click('#tabVoy'); await p.waitForTimeout(1400);
  const t1 = (await p.locator('.item[data-voy] .clock').first().textContent()).trim();
  await p.waitForTimeout(3200);
  const t2 = (await p.locator('.item[data-voy] .clock').first().textContent()).trim();
  const w1 = await p.locator('.item[data-voy] .vbar i').first().evaluate(e => e.style.width);
  console.log('   clock ' + t1 + ' -> ' + t2 + ' (bar ' + w1 + ')');
  if (t1 === t2) errors.push('the countdown did not move: stuck at ' + t1);

  await b.close();
  errors.forEach(e => console.log(' * ' + e));
  console.log(errors.length ? '=== ' + errors.length + ' problem(s) ===' : 'clean run');
  process.exit(errors.length ? 1 : 0);
})();
