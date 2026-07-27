/* Nothing may scroll sideways.

   A screen that scrolls on both axes is almost always a decoration laid out
   wider than its box, and it is invisible until someone swipes — so it gets
   measured rather than eyeballed. Names the offending element, not just the tab.

   Needs playwright-core and the game served; see the README. */
let chromium = null;
for (const where of ['playwright-core', require('path').join(process.cwd(), 'node_modules', 'playwright-core')]) {
  try { chromium = require(where).chromium; break; } catch (e) { /* try the next */ }
}
const bad = [];

(async () => {
  if (!chromium) {
    console.log('skipped — needs playwright-core and the game served (see README)');
    return;
  }
  const b = await chromium.launch({
    executablePath: process.env.SP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => console.log('[pageerror] ' + e.message));
  await p.goto(process.env.SP_URL || 'http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-new"]');
  await p.waitForTimeout(900);
  if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.gold = 90000; s.docks = 6; s.bell = 3;
    ['wood','metal','cloth'].forEach(k => s.mats[k] = 120);
    s.flagBoons = ['diamond'];
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on'); await p.waitForTimeout(900);

  for (const tab of ['tabFleet','tabFlag','tabRoutes','tabVoy','tabPort']) {
    await p.click('#' + tab); await p.waitForTimeout(1600);
    const r = await p.evaluate(() => {
      const m = document.getElementById('main');
      const out = { tab: '', scrollW: m.scrollWidth, clientW: m.clientWidth, wide: [] };
      if (m.scrollWidth > m.clientWidth + 1) {
        const mb = m.getBoundingClientRect();
        document.querySelectorAll('#main *').forEach(el => {
          const b = el.getBoundingClientRect();
          const over = Math.max(b.right - mb.right, mb.left - b.left, el.scrollWidth - el.clientWidth);
          if (over > 1) {
            out.wide.push(el.tagName.toLowerCase() + '.' + (el.className||'').toString().slice(0,44)
              + ' over ' + over.toFixed(0) + ' [' + b.left.toFixed(0) + '..' + b.right.toFixed(0) + ']');
          }
        });
      }
      out.wide = [...new Set(out.wide)].slice(0, 8);
      /* also: does the body itself scroll sideways? */
      out.bodyScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return out;
    });
    if (r.scrollW > r.clientW + 1 || r.bodyScroll) {
      bad.push(tab + ': ' + r.scrollW + ' wide in ' + r.clientW
        + (r.wide.length ? ' — ' + r.wide.join('; ') : ''));
    }
  }
  await b.close();
  bad.forEach(x => console.log(' * ' + x));
  console.log(bad.length ? '=== ' + bad.length + ' screen(s) scroll sideways ===' : 'nothing scrolls sideways');
  process.exit(bad.length ? 1 : 0);
})();
