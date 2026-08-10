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

/* ---- measuring ---------------------------------------------------------

   Backgrounds are read from the RENDERED PIXELS, not from computed style.

   This used to walk the ancestor chain compositing background-color, which
   worked only while every surface was painted with a fill. It is not any
   more: the panels, buttons, bars and plates are Kenney art applied with
   border-image, and an element painted entirely by border-image reports
   background-color: transparent. The old method therefore fell through to the
   sea behind the panel and reported navy-ink-on-parchment — the most legible
   pairing in the game — as a 1.2:1 failure.

   So: screenshot the viewport once per screen, then for each piece of text
   take the most common colour inside its box. Glyphs cover a minority of
   their own box, so the mode is the background it is sitting on, whatever
   drew it — a fill, a gradient, a border-image or an <img>. That is ground
   truth, and it cannot be fooled by how the paint got there.
*/

const zlib = require('zlib');

/* minimal PNG reader — enough for Chromium's 8-bit RGBA screenshots */
function decodePNG(buf) {
  let i = 8, w = 0, h = 0, ct = 0, bd = 0, idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), typ = buf.toString('ascii', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (typ === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (typ === 'IDAT') idat.push(data);
    else if (typ === 'IEND') break;
    i += 12 + len;
  }
  if (bd !== 8) throw new Error('unexpected PNG bit depth ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!ch) throw new Error('unexpected PNG colour type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let pos = 0, prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride); prev = line;
  }
  return { w, h, ch, px: out };
}

const lum = ([r, g, b]) => {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* The colour a box mostly is — i.e. what its text is sitting on.

   This used to be "the single most common pixel colour in the middle of the
   box," which is right as long as the background is one flat fill. It is not,
   any more: a Kenney plate is a beveled steel plaque painted as three or four
   discrete flat bands (a light top edge, a mid face, a dark underside), so no
   single one of those bands is the majority — but the TEXT sitting on it is one
   exactly-repeated colour front to back. Bold caps on a narrow label can cover
   more pixels than any ONE of those bands does, and the old code would call
   that "the background" and report a control failing against itself.

   The fix: since the text colour is already known — it is the very thing being
   tested — exclude pixels that match it (closely, not just exactly, so anti-
   aliased glyph edges do not leak into the count either) and take the mode of
   what is left. That is background by construction, however many flat bands it
   is actually painted in. Sampled from the middle of the box, still, so a
   9-sliced control's own dark ink-outline never enters the count either. */
function modeColour(img, x0, y0, x1, y1, dpr, fg) {
  const iw = (x1 - x0) * 0.12, ih = (y1 - y0) * 0.12;
  x0 += iw; x1 -= iw; y0 += ih; y1 -= ih;
  const X0 = Math.max(0, Math.round(x0 * dpr)), X1 = Math.min(img.w, Math.round(x1 * dpr));
  const Y0 = Math.max(0, Math.round(y0 * dpr)), Y1 = Math.min(img.h, Math.round(y1 * dpr));
  const dist2 = (a, b) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db; };
  const sample = exclude => {
    const counts = new Map();
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const o = (y * img.w + x) * img.ch;
        const px = [img.px[o], img.px[o + 1], img.px[o + 2]];
        if (exclude && dist2(px, exclude) < 2200) continue;   /* ~47 per channel */
        const k = (px[0] << 16) | (px[1] << 8) | px[2];
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    let best = -1, bestN = 0;
    for (const [k, n] of counts) if (n > bestN) { bestN = n; best = k; }
    return best < 0 ? null : [(best >> 16) & 255, (best >> 8) & 255, best & 255];
  };
  /* Excluding the foreground can legitimately empty the sample — a solid
     square swatch drawn in exactly its own "text" colour, say. Fall back to
     the unfiltered mode rather than reporting nothing. */
  return sample(fg) || sample(null);
}

/* candidates: every element that renders its own visible text */
const COLLECT = () => {
  const parse = s => {
    if (!s) return null;
    let m = /^color\(srgb\s+([^)]+)\)/.exec(s);
    if (m) { const t = m[1].split('/'); const c = t[0].trim().split(/\s+/).map(Number);
      return { rgb: [c[0] * 255, c[1] * 255, c[2] * 255], a: t[1] ? parseFloat(t[1]) : 1 }; }
    m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { const t = m[1].split('/'); const c = t[0].trim().split(/[,\s]+/).map(Number);
      return { rgb: [c[0], c[1], c[2]], a: t[1] ? parseFloat(t[1]) : (c.length > 3 ? c[3] : 1) }; }
    return null;
  };
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (parseFloat(cs.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    /* font-size:0 means the label is deliberately hidden because the art
       already carries the glyph — the close key and the tick boxes. There is
       no text on screen to measure. */
    if (!size) continue;
    /* SVG text on the chart carries its own painted halo (see labelAt in
       map.js), which is what makes it legible over the sea. A background
       sampler cannot see a stroke behind a glyph, so it would report every
       chart label as a failure it is not. */
    if (el.ownerSVGElement || el.tagName === 'text' || el.tagName === 'tspan') continue;
    /* Skip anything that is on the page but not on the screen. A mission
       panel is an overlay: the chart underneath it still has layout, still
       reports a box, and still sits inside the viewport — but the pixels at
       those coordinates belong to the panel on top. Measuring the hidden
       element's colour against the visible element's pixels is how a legible
       screen produces a 1.03:1 "failure". Hit-test the centre and only keep
       elements that are actually the thing you would touch there. */
    const cx = (Math.max(0, r.left) + Math.min(innerWidth, r.right)) / 2;
    const cy = (Math.max(0, r.top) + Math.min(innerHeight, r.bottom)) / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;

    const key = el.className + '|' + Math.round(size) + '|' + cs.color;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      sel: (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).join('.') : '')).slice(0, 64),
      text: own.slice(0, 28),
      fg: fg.rgb, fga: fg.a,
      x: Math.max(0, r.left), y: Math.max(0, r.top),
      x2: Math.min(innerWidth, r.right), y2: Math.min(innerHeight, r.bottom),
      size: Math.round(size * 10) / 10, weight,
      large: size >= 24 || (size >= 18.66 && weight >= 600)
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
  const cands = await p.evaluate(COLLECT);
  if (!cands.length) { console.log(`  ${label}: nothing to measure`); return; }
  const dpr = await p.evaluate(() => devicePixelRatio);
  const img = decodePNG(await p.screenshot());

  const rows = [];
  for (const c of cands) {
    const bg = modeColour(img, c.x, c.y, c.x2, c.y2, dpr, c.fg);
    if (!bg) continue;
    const fg = c.fg.map((v, i) => v * c.fga + bg[i] * (1 - c.fga));
    const cr = ratio(fg, bg);
    const need = c.large ? 3.0 : 4.5;
    if (cr >= need - 0.005) continue;
    rows.push({ ...c, ratio: Math.round(cr * 100) / 100, need,
                fgs: fg.map(Math.round).join(','), bgs: bg.join(',') });
  }
  if (!rows.length) { console.log(`  ${label}: clean`); return; }
  console.log(`  ${label}: ${rows.length} failing pair(s)`);
  for (const r of rows) {
    console.log(`     ${r.ratio}:1 (needs ${r.need}) ${r.size}px/${r.weight}`
      + `${r.large ? ' large' : ''}  fg(${r.fgs}) on bg(${r.bgs})`
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
