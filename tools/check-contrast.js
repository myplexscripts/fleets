/* check-contrast — every rendered text/background pair against the palette rules.

   The palette document is explicit that harmony and legibility are different
   things, and it draws the line in three places:

     SAFE        >= 4.5:1   normal-size text and UI labels
     LARGE ONLY  >= 3.0:1   large or bold text, large icons, non-text graphics
     AVOID        < 3.0:1   never for meaningful content

   Reading the stylesheets cannot tell you which pairs actually meet on screen —
   a token's value depends on what it inherits and what is painted behind it. So
   this walks the real game in a real browser, finds every element with visible
   text, resolves the colour actually behind it through any transparent
   ancestors, and measures.

   "Large" follows WCAG: >= 24px, or >= 18.66px at weight 600+. Anything under
   that must clear 4.5:1.
*/

const { chromium } = require('playwright-core');

const URL = process.env.GAME_URL || 'http://127.0.0.1:8137/index.html';
const EXEC = process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const bad = [];

/* ---- the walk ---------------------------------------------------------- */

const AUDIT = () => {
  const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  /* Chromium does NOT serialise every computed colour as rgb(). A value that
     came from color-mix() comes back as `color(srgb 0.06 0.11 0.18)`, with the
     channels in 0..1. Parsing only rgb() silently treats those as transparent,
     which makes the compositor fall through to white and reports a legible
     panel as a 1.15:1 failure. Both forms are handled here. */
  const parse = s => {
    if (!s) return null;
    let m = /^color\(srgb\s+([^)]+)\)/.exec(s);
    if (m) {
      const t = m[1].split('/');
      const c = t[0].trim().split(/\s+/).map(Number);
      return { rgb: [c[0] * 255, c[1] * 255, c[2] * 255], a: t[1] ? parseFloat(t[1]) : 1 };
    }
    m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) {
      const t = m[1].split('/');
      const c = t[0].trim().split(/[,\s]+/).map(Number);
      const a = t[1] ? parseFloat(t[1]) : (c.length > 3 ? c[3] : 1);
      return { rgb: [c[0], c[1], c[2]], a };
    }
    return null;
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));

  /* What is actually painted behind this element.

     Collect every non-transparent background from the element up to the first
     fully opaque ancestor, then composite from that opaque base back down. Any
     other order is wrong: a 24%-black scrim over teal is not the same colour as
     the same scrim over white, and getting that backwards makes a legible
     control look like a failure (and, worse, the reverse). */
  const behind = el => {
    const chain = [];
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        chain.push(c);
        if (c.a >= 0.999) break;
      }
      n = n.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    // only elements with their own visible text
    const own = [...el.childNodes]
      .filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (parseFloat(cs.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;

    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const bgArr = behind(el);
    const fgArr = over(fg, bgArr);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 600);
    const cr = ratio(fgArr, bgArr);
    const need = large ? 3.0 : 4.5;
    if (cr >= need) continue;

    const key = el.className + '|' + Math.round(size) + '|' + cs.color;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      sel: (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).join('.') : '')).slice(0, 64),
      text: own.slice(0, 28),
      size: Math.round(size * 10) / 10, weight, large,
      ratio: Math.round(cr * 100) / 100, need,
      /* the resolved pair, so a failure names the two colours to change
         rather than sending you hunting through the cascade for them */
      fg: fgArr.map(Math.round).join(','), bg: bgArr.map(Math.round).join(',')
    });
  }
  return out;
};

/* ---- driving the game -------------------------------------------------- */

/* The nav rail rebuilds its own DOM on every screen change, so a locator
   resolved before the click can be a detached node by the time the click
   lands — which silently activates whichever tab now occupies that spot.
   Click by data attribute and confirm the tab actually took. */
async function goTab(p, tab) {
  for (let i = 0; i < 5; i++) {
    await p.click(`nav [data-tab="${tab}"]`);
    try {
      await p.waitForFunction(
        t => { const b = document.querySelector(`nav [data-tab="${t}"]`);
               return b && b.classList.contains('on'); },
        tab, { timeout: 2500 });
      await p.waitForTimeout(600);
      return;
    } catch (e) { /* re-render raced us; try again */ }
  }
  throw new Error('could not reach tab ' + tab);
}

async function scan(p, label) {
  await p.waitForTimeout(450);
  const rows = await p.evaluate(AUDIT);
  if (!rows.length) { console.log(`  ${label}: clean`); return; }
  console.log(`  ${label}: ${rows.length} failing pair(s)`);
  for (const r of rows) {
    console.log(`     ${r.ratio}:1 (needs ${r.need}) ${r.size}px/${r.weight}`
      + `${r.large ? ' large' : ''}  fg(${r.fg}) on bg(${r.bg})`
      + `  ${r.sel}  "${r.text}"`);
    bad.push(`${label}: ${r.sel} ${r.ratio}:1 < ${r.need}`);
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await scan(p, 'title');

  await p.click('[data-act="title-new"]');
  await p.waitForSelector('#app.on');
  await p.waitForTimeout(800);
  if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
  await p.waitForTimeout(500);

  /* a purse and a fleet, so every card state has something in it */
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('saltpowder'));
    s.gold = 9000; s.docks = 8; s.bell = 3; s.noto = 40;
    s.goods.sugar = 40; s.goods.rum = 30; s.mats.wood = 20; s.mats.metal = 12;
    s.ships = [
      { id: 'x1', type: 'manowar', name: 'Hammer', hull: 62, max: 90, speed: 2, guns: 12, cargo: 50 },
      { id: 'x2', type: 'frigate', name: 'Vixen', hull: 55, max: 55, speed: 4, guns: 8, cargo: 30 }
    ];
    localStorage.setItem('saltpowder', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-continue"]');
  await p.waitForSelector('#app.on');
  await p.waitForTimeout(800);

  /* NB the nav keys do not read the way the screens are named: data-tab="port"
     is the MARKET screen, and the Port screen is "fleet". */
  for (const [tab, name] of [['fleet', 'port'], ['flag', 'flagship'],
                             ['port', 'market'], ['voy', 'at sea']]) {
    if (!(await p.locator(`nav [data-tab="${tab}"]`).count())) continue;
    await goTab(p, tab);
    await scan(p, name);
  }

  /* the stores drawer */
  await goTab(p, 'fleet');
  if (await p.locator('#wStores').count()) {
    await p.click('#wStores'); await p.waitForTimeout(700);
    await scan(p, 'stores');
    await p.click('.sheet .panelx');
    /* The drawer fades for 320ms before it stops intercepting taps. It closes
       to display:none, so waitForSelector — which waits for VISIBLE — can never
       match it; the state has to be read directly. */
    await p.waitForFunction(
      () => !document.getElementById('overlay').classList.contains('on'),
      null, { timeout: 5000 });
  }

  /* The settings box and a dialog. The wheel only exists on Port, and Escape
     is NOT a way to get back to it — Escape opens this very screen. */
  await goTab(p, 'fleet');
  await p.waitForSelector('#pauseBtn', { timeout: 15000 });
  await p.click('#pauseBtn'); await p.waitForSelector('#pauseScr.vis');
  await scan(p, 'settings');
  await p.click('[data-act="pause-newgame"]'); await p.waitForTimeout(500);
  await scan(p, 'dialog');

  /* Dismiss the dialog and the settings box before moving on — anything left
     up here swallows the taps that drive the rest of the walk. */
  await p.click('[data-dlg="cancel"]'); await p.waitForTimeout(400);
  await p.click('[data-act="pause-close"]'); await p.waitForTimeout(500);

  /* the chart, and a mission panel of each kind */
  await goTab(p, 'routes'); await p.waitForTimeout(900);
  await scan(p, 'map');
  for (const [id, name] of [['#node_c1', 'mission (cargo)'], ['#node_c4', 'mission (raid)'],
                            ['#node_dv_dv1', 'mission (dive)']]) {
    if (!(await p.locator(id).count())) continue;
    await p.click(id);
    await p.waitForSelector('#overlay.vis'); await p.waitForTimeout(700);
    if (await p.locator('.foechip').count()) { await p.click('.foechip'); await p.waitForTimeout(400); }
    await scan(p, name);
    await p.click('.sheet .panelx');
    await p.waitForFunction(
      () => !document.getElementById('overlay').classList.contains('on'),
      null, { timeout: 5000 });
  }

  await b.close();

  console.log(`\n=== ${bad.length} problem(s) ===`);
  if (bad.length) {
    bad.forEach(x => console.log(' * ' + x));
    process.exit(1);
  }
  console.log('check-contrast OK — every label on every screen clears the palette rules:');
  console.log('4.5:1 for normal text, 3:1 for large or bold.');
})();
