/* MAP — the naval chart. One SVG, laid out fresh on every render so it always
   fits the viewport. Route coordinates are authored in a fixed 360x560 space
   and projected into the available box. */

import { $, esc } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { REGIONS, DHEX, HOME } from '../../data/world.js';
import { PORTS } from '../../data/ports.js';
import { CHARTERS } from '../../data/charters.js';
import { BOSSES } from '../../data/bosses.js';
import {
  allRoutes, effDanger, voyageOpen, bossReady, charterAvailable,
  patrolActive, patrolLeft, fmtDur, canVoyage, diveReachable, wantedOf,
  allShips, busyIds
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { actions } from '../../core/actions.js';
import { render } from '../../core/bus.js';
import { alertDlg } from '../dialog.js';

/* Whether the region cards and the shape key are on screen. They are useful
   until you know them and then they are just covering water, so they fold away
   and the chart takes the room back. Screen state, not save state. */

/* The closest two markers are never nearer than this on screen. A thumb is
   about 44px; a marker plus breathing room either side is roughly double. */
/* How far apart the two closest markers are drawn.

   It used to be a full thumb's width, because the only way to hit a crowded
   marker was for the chart to be drawn big enough. A pinch does that job now,
   so this is the comfortable-at-rest distance rather than the guarantee, and
   the chart is a size a person can hold in their head. */
const MIN_NODE_GAP = 64;

/* And no bigger than this in either direction, however tight the authoring. */
const MAX_CHART = 2600;

/* Drag to pan. Touch scrolls the container by itself; this is for a mouse, and
   it deliberately does not swallow taps — a drag under the slop threshold still
   lands on whatever node was under the pointer. */
/* ---- pinch to zoom ----

   The chart is drawn at whatever scale guarantees a thumb's width between the
   two closest markers, which is right for tapping and wrong for orientation:
   on a full map that is a drawing several screens across, and the only way to
   see where anything is was to drag around hunting for it.

   So the drawn scale stays the default and the player can pull away from it in
   both directions — out far enough to see the whole ocean at once, in far
   enough to separate two markers that are almost on top of each other. Zoom is
   a transform on the drawing rather than a re-render: re-laying out the chart
   on every frame of a pinch would fight the fingers doing it.

   Scroll position is kept anchored to the midpoint between the fingers, so the
   chart zooms about the place you are looking at rather than about its own
   corner. */
const ZOOM_MIN = 0.4, ZOOM_MAX = 2.6;
let zoom = 1;

export const mapZoom = () => zoom;
export function resetZoom() { zoom = 1; }

function sizeZoom(scroller) {
  const box = scroller.querySelector('#mapzoom');
  const svg = scroller.querySelector('#mapsvg');
  if (!box || !svg) return;
  box.style.transformOrigin = '0 0';
  box.style.transform = zoom === 1 ? '' : 'scale(' + zoom + ')';
  /* The scroller has to be told how big the drawing is at this scale, or it
     will not let you reach the parts the zoom just pushed off the edge. A
     transform alone does not change layout size. */
  box.style.width = svg.getAttribute('width') + 'px';
  box.style.height = svg.getAttribute('height') + 'px';
  const pad = scroller.querySelector('#mapzoompad');
  if (pad) {
    pad.style.width = (+svg.getAttribute('width') * zoom) + 'px';
    pad.style.height = (+svg.getAttribute('height') * zoom) + 'px';
  }
}

function applyZoom(scroller, z, ax, ay) {
  const prev = zoom;
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  if (Math.abs(next - prev) < 0.001) return;
  zoom = next;

  /* Where in the drawing the anchor point was, before the scale changed. */
  const r = scroller.getBoundingClientRect();
  const px = (scroller.scrollLeft + (ax - r.left)) / prev;
  const py = (scroller.scrollTop + (ay - r.top)) / prev;

  sizeZoom(scroller);
  scroller.scrollLeft = px * zoom - (ax - r.left);
  scroller.scrollTop = py * zoom - (ay - r.top);
}

function enableZoom(scroller) {
  const pts = new Map();
  let base = 0, baseZoom = 1;

  const dist = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  const mid = () => {
    const a = [...pts.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
  };

  scroller.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'touch') return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size === 2) { base = dist(); baseZoom = zoom; }
  });

  scroller.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size !== 2 || !base) return;
    ev.preventDefault();
    scroller.classList.add('zooming');
    const m = mid();
    applyZoom(scroller, baseZoom * (dist() / base), m.x, m.y);
  }, { passive: false });

  const lift = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) { base = 0; scroller.classList.remove('zooming'); }
  };
  scroller.addEventListener('pointerup', lift);
  scroller.addEventListener('pointercancel', lift);
  scroller.addEventListener('pointerleave', lift);

  /* Desktop: a trackpad pinch arrives as a ctrl-wheel, and so does browser zoom
     — taking it here keeps the gesture on the chart where it belongs. */
  scroller.addEventListener('wheel', ev => {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    applyZoom(scroller, zoom * Math.exp(-ev.deltaY * 0.0022), ev.clientX, ev.clientY);
  }, { passive: false });

  /* Double tap goes back to the scale the chart was drawn at. */
  let lastTap = 0;
  scroller.addEventListener('pointerup', ev => {
    if (ev.pointerType !== 'touch' || pts.size) return;
    const t = Date.now();
    if (t - lastTap < 300) {
      const r = scroller.getBoundingClientRect();
      applyZoom(scroller, 1, r.left + r.width / 2, r.top + r.height / 2);
    }
    lastTap = t;
  });
}

function enablePan(el) {
  let down = false, sx = 0, sy = 0, l0 = 0, t0 = 0, moved = 0;
  el.onpointerdown = ev => {
    if (ev.pointerType === 'touch') return;      // native scrolling handles it
    down = true; moved = 0;
    sx = ev.clientX; sy = ev.clientY;
    l0 = el.scrollLeft; t0 = el.scrollTop;
  };
  el.onpointermove = ev => {
    if (!down) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    if (moved > 6) {
      el.classList.add('panning');
      el.scrollLeft = l0 - dx;
      el.scrollTop = t0 - dy;
    }
  };
  const up = () => { down = false; el.classList.remove('panning'); };
  el.onpointerup = up;
  el.onpointercancel = up;
  el.onpointerleave = up;
}

function starPath(x, y, r) {
  return `M${x},${y - r} L${x + r * 0.35},${y - r * 0.35} L${x + r},${y} L${x + r * 0.35},${y + r * 0.35} ` +
         `L${x},${y + r} L${x - r * 0.35},${y + r * 0.35} L${x - r},${y} L${x - r * 0.35},${y - r * 0.35} Z`;
}

/* Mission type reads from the marker's silhouette, not just its colour.

   One shape per mission type, no sharing — the legend names every symbol on the
   chart, and it can only do that if no two types wear the same one. */
function nodeShape(r, col, k) {
  const { x, y } = r, s = 5.5 * k;
  if (r.type === 'dive')                            // ring: something below
    return `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="${col}" stroke-width="${2.8 * k}"/>`
         + `<circle cx="${x}" cy="${y}" r="${s * 0.34}" fill="${col}"/>`;
  if (r.type === 'patrol')                          // rotated square
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" transform="rotate(45 ${x} ${y})" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'raid')                            // spearhead
    return `<path d="M${x},${y - s * 1.35} L${x + s * 1.2},${y + s * 0.85} L${x - s * 1.2},${y + s * 0.85} Z" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'blockade')                        // a line held: barred circle
    return `<circle cx="${x}" cy="${y}" r="${s * 1.1}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`
         + `<rect x="${x - s * 1.7}" y="${y - s * 0.3}" width="${s * 3.4}" height="${s * 0.6}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1"/>`;
  if (r.type === 'escort')                          // square
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'convoy')                          // three hulls in a line
    return `<circle cx="${x}" cy="${y}" r="${s * 1.25}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`
         + [-0.62, 0, 0.62].map(o =>
             `<rect x="${x - s * 0.7}" y="${y + o * s * 0.62 - s * 0.16}" width="${s * 1.4}"`
             + ` height="${s * 0.32}" rx="${s * 0.16}" fill="#1a0d08"/>`).join('');
  if (r.type === 'hunt')                            // crossed blades: open water
    return `<circle cx="${x}" cy="${y}" r="${s * 1.25}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`
         + `<path d="M${x - s * 0.62},${y - s * 0.62} L${x + s * 0.62},${y + s * 0.62}`
         + ` M${x + s * 0.62},${y - s * 0.62} L${x - s * 0.62},${y + s * 0.62}"`
         + ` stroke="#1a0d08" stroke-width="${1.9 * k}" stroke-linecap="round" fill="none"/>`;
  /* cargo run: filled disc with a bright centre */
  return `<circle cx="${x}" cy="${y}" r="${s}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${2 * k}" fill="#eaf4f4"/>`;
}

export function renderMap() {
  const host = $('main');
  const CW = Math.max(320, host.clientWidth || innerWidth);
  const wide = CW >= 760;

  const rs = allRoutes();
  const active = {};
  S.voyages.forEach(v => { active[v.routeId] = v; });

  /* Which admirals are drawn at all — they count toward the fitted view. */
  const bossKeys = Object.keys(REGIONS).filter(rk =>
    S.unlocked.includes(rk) && BOSSES[rk] && (S.bossBeaten[rk] || bossReady(rk)));

  const anyBeaten = Object.keys(S.bossBeaten || {}).some(rk => S.bossBeaten[rk]);
  $('main').innerHTML = `<div id="mapwrap">
    <div class="mapbar">${buildRegionBar()}</div>
    <div id="mapscroll"></div>
    <button class="legtoggle" data-act="legend" aria-label="What the markers mean"
      title="What the markers mean">${iconHTML('map', 40)}</button>
  </div>`;
  const scrollEl = $('mapscroll');
  /* The region strip sits above the chart rather than on top of it, so it costs
     the drawing nothing — the scroller simply starts underneath it, and the
     chart is sized to the scroller rather than to the whole screen. */
  const CH = Math.max(300, (scrollEl && scrollEl.clientHeight) || host.clientHeight || (innerHeight - 190));
  const legW = 0;
  const legH = 0;
  /* Node labels hang below their marker, so the foot needs a line of headroom
     or HOME PORT runs off the bottom. The key used to sit down here and took a
     third of the screen with it; it is a dialog now. */
  const hintH = 34;

  const padX = Math.max(40, CW * 0.05);
  const padTop = Math.max(46, CH * 0.07) + legH;
  const padBot = hintH + 46;
  const x0 = padX + legW, x1 = CW - padX, y0 = padTop, y1 = CH - padBot;

  /* Fit the view to the nodes that actually exist right now. Projecting the
     whole 360x560 authored chart wastes most of the screen in the early game,
     when only the Caribbean corner is unlocked; this zooms out as the map
     opens up. Scale is uniform so the chart never looks stretched. */
  /* Spread the crowded markers before measuring anything, then work entirely
     from the spread positions so the drawing and the taps agree. */
  const POS = relaxed([
    { id: 'HOME', x: HOME.x, y: HOME.y },
    ...rs.map(r => ({ id: r.id, x: r.x, y: r.y })),
    ...bossKeys.map(rk => ({ id: BOSSES[rk].id, x: BOSSES[rk].x, y: BOSSES[rk].y }))
  ]);
  const at = o => POS[o.id] || o;
  const HOMEP = POS.HOME;
  const pts = Object.keys(POS).map(k => POS[k]);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(70, maxX - minX), bh = Math.max(70, maxY - minY);
  const availW = Math.max(80, x1 - x0), availH = Math.max(80, y1 - y0);

  /* The chart used to be squeezed into the viewport no matter how many nodes it
     held, so every region unlocked made the markers smaller and closer until
     they were unhittable. It is drawn at a scale that guarantees a thumb's worth
     of space between the two closest nodes instead, and when that will not fit
     on screen the chart pans. A map you drag is a map; a map you squint at is
     a diagram. */
  let tightest = Infinity;
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const dd = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
      if (dd > 0.5) tightest = Math.min(tightest, dd);
    }
  }
  const kFit = Math.min(availW / bw, availH / bh);
  const kGap = tightest === Infinity ? kFit : MIN_NODE_GAP / tightest;
  /* Bounded by how big a chart is still reasonable to drag around, not by a
     multiple of the fitted scale — two nodes authored almost on top of each
     other would otherwise never get their gap. */
  const kMax = Math.min(MAX_CHART / bw, MAX_CHART / bh);
  const k = Math.max(kFit, Math.min(kGap, kMax));
  const minGap = tightest === Infinity ? 999 : tightest * k;

  /* The drawing is as big as it needs to be; the viewport is the window onto it. */
  const contentW = Math.max(CW, Math.round(bw * k + (x0 + (CW - x1)) + legW));
  const contentH = Math.max(CH, Math.round(bh * k + padTop + padBot));
  const ox = legW + Math.max(padX, (contentW - legW - bw * k) / 2) - minX * k;
  const oy = Math.max(padTop, (contentH - padTop - padBot - bh * k) / 2 + padTop) - minY * k;

  const MX = x => +(ox + x * k).toFixed(1);
  const MY = y => +(oy + y * k).toFixed(1);
  const NR = Math.max(1.35, Math.min(contentW / 900, contentH / 620) * 1.5);   // node radius scale
  const LBL = Math.max(16, Math.round(13 * NR));
  const HLBL = Math.max(18, Math.round(14.5 * NR));
  const LSX = contentW / 360, LSY = contentH / 560;

  /* With the spacing guaranteed, the tap target can be as big as the gap allows
     rather than as small as the crowding demands. */
  const HIT = Math.max(26, Math.min(24 * NR, minGap / 2 - 2));
  const MS = Math.max(NR * 0.7, Math.min(NR, HIT / 15));

  /* Labels are centre-anchored on their node, so one near an edge would run off
     screen. Nudge the text (not the marker) far enough in to stay readable. */
  const labelX = (x, text, size) => {
    const half = text.length * size * 0.32;
    return +Math.min(Math.max(x, legW + 6 + half), contentW - 6 - half).toFixed(1);
  };

  /* Transparent tap targets. The marker gets a circle; a labelled node also gets
     a patch covering the gap down to its label, so the words are part of the
     button and there is no dead strip between the two.

     A patch as wide as the words, though, reaches past the marker and on a
     crowded chart swallows taps meant for a neighbour. So it only widens to the
     text where the nodes are far enough apart to afford it; otherwise it stays
     exactly as wide as the marker's own circle, which bridges the gap without
     covering anything the marker was not already covering. */
  const roomy = minGap === Infinity || minGap > HIT * 5;
  const hitShapes = (x, y, label, size, drop) => {
    let out = `<circle cx="${x}" cy="${y}" r="${HIT}" fill="${'transparent'}"/>`;
    if (label) {
      const wide = Math.min(HIT * 2.2, Math.max(HIT, label.length * size * 0.32));
      const half = roomy ? wide : HIT;
      const lx = roomy ? labelX(x, label, size) : x;
      out += `<rect x="${(lx - half).toFixed(1)}" y="${y.toFixed(1)}" width="${(half * 2).toFixed(1)}"`
        + ` height="${(drop + size).toFixed(1)}" fill="transparent"/>`;
    }
    return out;
  };

  const hx = MX(HOMEP.x), hy = MY(HOMEP.y);
  let lines = '', nodes = '', bossNodes = '', voyLines = '', labels = '';

  /* Labels are drawn in their own layer, not inside the node they belong to.
     A node's group is its tap target, and anything in the group counts toward
     the box a tap is aimed at — so a label hanging below the marker drags that
     box down until the middle of it is empty water. Keeping the words out means
     a node's box is the marker, which is what you are aiming at anyway. */
  const labelAt = (x, y, text, size, fill, stroke, spacing) =>
    `<text x="${labelX(x, text, LBL)}" y="${y}" text-anchor="middle" fill="${fill}"`
    + ` font-size="${size}" font-family="Oswald" letter-spacing="${spacing}"`
    + ` style="paint-order:stroke" stroke="${stroke}" stroke-width="3">${esc(text)}</text>`;

  rs.forEach(r => {
    const isCh = r.type === 'charter', isDive = r.type === 'dive';
    const d = effDanger(r);
    /* Dives carry no danger rating, so they are tinted by whether the bell can
       reach them rather than by how dangerous the water is. */
    const col = isDive ? (diveReachable(r) ? '#7ab0e0' : '#4a6070') : DHEX[d];
    const open = canVoyage(r) && voyageOpen(r);
    const rp = at(r); const x = MX(rp.x), y = MY(rp.y);

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="${col}" stroke-width="${1.6 * MS}" opacity="0.7"/>`;
    if (active[r.id])
      voyLines += `<path class="voyline" d="M${hx},${hy} L${x},${y}" stroke="#7ab0e0" stroke-width="${2.4 * MS}" opacity="0.95"/>`;

    const label = isCh ? PORTS[r.charterDef.loc].n.toUpperCase()
      : r.portId ? PORTS[r.portId].n.toUpperCase()
      : isDive ? 'DEPTH ' + r.depth
      : '';
    const labelColor = isCh ? '#efe3ae' : (isDive ? '#8fb8d8' : '#a8c4c6');

    nodes += `<g id="node_${r.id}" data-act="mission" data-id="${r.id}" class="mapnode">
      ${hitShapes(x, y, label, LBL, 18 * MS)}
      ${isCh
        ? `<path class="charterstar" d="${starPath(x, y, 10 * MS)}" fill="#efe3ae" stroke="#8a793e" stroke-width="1.4"/>`
        : `<circle class="nodeglow" cx="${x}" cy="${y}" r="${13 * MS}" fill="${col}"/>${nodeShape({ ...r, x, y }, col, MS)}`}
      ${open ? `<circle cx="${x + 10 * MS}" cy="${y - 10 * MS}" r="${4.2 * MS}" fill="#63c06a" stroke="#04161c" stroke-width="1.3"/>` : ''}
      ${active[r.id] ? `<circle cx="${x - 10 * MS}" cy="${y - 10 * MS}" r="${4.2 * MS}" fill="#7ab0e0" stroke="#04161c" stroke-width="1.3"/>` : ''}
    </g>`;
    if (label) labels += labelAt(x, y + 18 * MS + LBL, label, LBL, labelColor, '#04161c', 1);
  });

  bossKeys.forEach(rk => {
    const b = BOSSES[rk];
    const bp = at(b);
    const x = MX(bp.x), y = MY(bp.y);

    if (S.bossBeaten[rk]) {
      bossNodes += `<g>${struckFlag(x, y, MS, '#d9c98a')}</g>`;
      return;
    }

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="#d94a3a" stroke-width="${2 * MS}" opacity="0.9"/>`;
    bossNodes += `<g id="node_${b.id}" data-act="mission" data-id="${b.id}" class="mapnode">
      ${hitShapes(x, y, b.n.toUpperCase(), LBL, 22 * MS)}
      <circle class="bossglow" cx="${x}" cy="${y}" r="${18 * MS}" fill="#d94a3a"/>
      <path d="${starPath(x, y, 10 * MS)}" fill="#f0b0a6" stroke="#5e1a1a" stroke-width="1.4"/></g>`;
    labels += labelAt(x, y + 22 * MS + LBL, b.n.toUpperCase(), LBL, '#f0b0a6', '#0a0507', 1.2);
  });

  const svg = `<svg id="mapsvg" width="${contentW}" height="${contentH}"
      viewBox="0 0 ${contentW} ${contentH}" preserveAspectRatio="none">
      <defs>
        <radialGradient id="seabg" cx="45%" cy="40%" r="80%">
          <stop offset="0%" stop-color="#0e3a40"/><stop offset="55%" stop-color="#082830"/><stop offset="100%" stop-color="#04161c"/>
        </radialGradient>
      </defs>
      <rect width="${contentW}" height="${contentH}" fill="url(#seabg)"/>
      <g class="coast">${landHTML(MX, MY, MS)}</g>
      ${lines}${voyLines}
      <g>
        <circle class="nodeglow" cx="${hx}" cy="${hy}" r="${19 * MS}" fill="#d9c98a"/>
        <circle cx="${hx}" cy="${hy}" r="${7 * MS}" fill="#d9c98a" stroke="#000" stroke-width="1.4"/>
      </g>
      ${nodes}${bossNodes}
      <g class="maplabels">${labels}
        ${labelAt(hx, hy + 22 * MS + HLBL, 'HOME PORT', HLBL, '#d9c98a', '#04161c', 2)}
      </g>
    </svg>`;

  const scroller = host.querySelector('#mapscroll');
  /* The drawing lives in a box the zoom transform is applied to, with a spacer
     behind it carrying the scrolled size — a transform does not change layout,
     so without the spacer a zoomed-in chart cannot be scrolled to its edges. */
  scroller.innerHTML = '<div id="mapzoompad"></div><div id="mapzoom">' + svg + '</div>';
  scroller.classList.toggle('pannable', contentW > CW + 2 || contentH > CH + 2);

  /* Open centred on home port — that is where the player's eye starts, and on a
     chart bigger than the screen it is the only sensible anchor. The legend
     covers the top and the key covers the foot, so centre it on the water that
     is actually visible between them rather than on the raw viewport. */
  const seenTop = legH, seenBot = hintH;
  scroller.scrollLeft = Math.max(0, MX(HOMEP.x) - (legW + CW) / 2);
  scroller.scrollTop = Math.max(0, MY(HOMEP.y) + HLBL + 26 - (seenTop + (CH - seenTop - seenBot)));
  /* A repaint must not throw away a zoom the player set — the chart is redrawn
     whenever anything on it changes, which during a session is often. */
  sizeZoom(scroller);
  if (zoom !== 1) {
    scroller.scrollLeft *= zoom;
    scroller.scrollTop *= zoom;
  }
  enablePan(scroller);
  enableZoom(scroller);
}

/* The map key: each marker silhouette against the word for what it is. A legend
   names its symbols — that is the whole job — so the shape is the symbol and the
   word is the name, and neither stands in for the other.

   It lists only what is actually drawn right now, which is what keeps it both
   complete and short: the Caribbean alone needs five entries, an admiral adds
   hers the moment she sails, and a shape can never appear unnamed. */
const KEY_ORDER = ['cargo', 'dive', 'convoy', 'hunt', 'patrol', 'escort', 'raid', 'blockade', 'charter', 'boss', 'beaten'];
const KEY_WORD = {
  cargo: 'Cargo', dive: 'Wreck', convoy: 'Convoy', hunt: 'Hunt', patrol: 'Patrol', escort: 'Escort',
  raid: 'Raid', blockade: 'Blockade', charter: 'Charter',
  boss: 'Admiral', beaten: 'Beaten'
};
const KEY_COL = {
  cargo: '#63c06a', dive: '#7ab0e0', convoy: '#c9a24e', hunt: '#e0a03a', patrol: '#e0a03a', escort: '#e0a03a',
  raid: '#e0a03a', blockade: '#e0a03a', charter: '#efe3ae',
  boss: '#f0b0a6', beaten: '#d9c98a'
};

/* An admiral you have already beaten leaves her struck colours on the chart —
   the one marker that is a record rather than a thing to tap. Same silhouette
   here as out there, so the key answers it like everything else. */
function struckFlag(x, y, k, col) {
  return `<circle cx="${x}" cy="${y}" r="${9 * k}" fill="none" stroke="${col}" stroke-width="1.8" opacity=".6"/>`
    + `<path d="M${x - 3.5 * k},${y - 5 * k} v${10 * k} M${x - 3.5 * k},${y - 5 * k} h${7.5 * k}`
    + ` l${-2.4 * k},${2.6 * k} l${2.4 * k},${2.6 * k} h${-7.5 * k}"`
    + ` fill="${col}" stroke="${col}" stroke-width="${1.2 * k}" stroke-linejoin="round"/>`;
}

function keySwatch(type, col) {
  const inner = type === 'beaten' ? struckFlag(12, 12, 1.1, col)
    : (type === 'charter' || type === 'boss')
      ? `<path d="${starPath(12, 12, 9)}" fill="${col}" stroke="${type === 'boss' ? '#5e1a1a' : '#8a793e'}" stroke-width="1.2"/>`
      : nodeShape({ type, x: 12, y: 12 }, col, 1.5);
  return `<svg class="keysh" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">${inner}</svg>`;
}

function shapeKey(rs, liveBosses, beaten) {
  const kinds = new Set(rs.map(r => r.type));
  if (liveBosses) kinds.add('boss');
  if (beaten) kinds.add('beaten');
  return KEY_ORDER.filter(k => kinds.has(k)).map(k =>
    `<span class="key">${keySwatch(k, KEY_COL[k])}<span>${KEY_WORD[k]}</span></span>`).join('');
}

/* ---- the coast ----

   Every port on this chart used to be a dot in open water, which made a cargo
   run to Nassau a delivery to a patch of sea. These are the landmasses the
   ports actually sit on, authored in the same 360x560 space as everything else
   and drawn underneath it, so a destination is a place on a shore and the
   dotted lines between them are sea lanes rather than lines.

   The coasts are drawn around where the ports already are, not the other way
   round. Moving thirty ports to fit a coastline would have re-cut every
   distance, every contract length and every node gap on the chart.

   The old shapes here were decoration stretched to the canvas by a different
   transform from the one the ports use, so they lined up with nothing. */
const LANDS = [
  /* west — Veracruz down to Monte Video, up through Cape Town and Ziguinchor */
  [[-25, 15], [112, 25], [96, 62], [124, 98], [104, 132], [132, 150], [110, 178],
   [128, 200], [92, 230], [104, 268], [70, 292], [92, 330], [104, 352], [62, 376], [-25, 384]],
  /* centre — Galway and Bristol down the seaboard to Boston */
  [[124, 18], [186, 22], [172, 58], [200, 92], [178, 124], [204, 160], [176, 190],
   [206, 222], [180, 252], [200, 278], [164, 296], [126, 272], [116, 222], [136, 182],
   [118, 138], [140, 96], [120, 58]],
  /* east — London and Marseille to the north, the Carolinas and Rio to the south */
  [[198, 18], [380, 12], [380, 486], [302, 466], [256, 442], [224, 404], [208, 356],
   [222, 314], [254, 286], [228, 258], [248, 222], [210, 196], [228, 154], [200, 116], [218, 70]],
  /* the home island */
  [[170, 428], [212, 424], [228, 448], [220, 478], [188, 488], [164, 466]]
];

/* A closed path through the points with the corners eased, so a coast reads as
   a coast and not as a polygon somebody forgot to round off. */
/* ---- elbow room ----

   The chart is drawn at whatever scale puts a tappable gap between the two
   closest markers, so one crowded pair used to inflate the entire drawing:
   a wreck charted eighteen units from a cargo lane forced a chart nearly two
   thousand pixels tall, and the player opened the map onto home port and one
   neighbour with everything else somewhere off the edge.

   Spacing the markers is the cheaper answer than scaling around them. Anything
   that is not pinned to a real place gets nudged off its neighbours first, and
   the chart is then drawn at a scale that suits the whole set.

   Pinned: home port, the ports themselves and the charters offered at them —
   those sit where the coastline says they sit. Everything else is open water
   and a few units either way costs nothing.

   Deterministic on purpose. A relaxation that used randomness would have the
   markers creep on every repaint. */
const RELAX_GAP = 32;
const RELAX_MAX = 20;          // no marker wanders further than this from home

const PINNED = id => id === 'HOME' || id.startsWith('k_') || id.startsWith('ch_');

function relaxed(pts) {
  const p = pts.map(q => ({ id: q.id, x: q.x, y: q.y, ox: q.x, oy: q.y, pin: PINNED(q.id) }));

  for (let it = 0; it < 80; it++) {
    let worst = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i], b = p[j];
        if (a.pin && b.pin) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= RELAX_GAP) continue;
        /* Two markers exactly on top of each other have no direction to push
           along, so give them one rather than dividing by zero. */
        if (d < 0.001) { dx = (i % 2 ? 1 : -1); dy = 1; d = Math.hypot(dx, dy); }
        const ux = dx / d, uy = dy / d;
        const push = (RELAX_GAP - d) * 0.5;
        worst = Math.max(worst, push);
        const share = (a.pin || b.pin) ? push * 2 : push;
        if (!a.pin) { a.x -= ux * share; a.y -= uy * share; }
        if (!b.pin) { b.x += ux * share; b.y += uy * share; }
      }
    }
    /* Nothing drifts far from where it was authored — the chart should still
       look drawn rather than simulated. */
    p.forEach(q => {
      if (q.pin) return;
      const dx = q.x - q.ox, dy = q.y - q.oy, d = Math.hypot(dx, dy);
      if (d > RELAX_MAX) { q.x = q.ox + dx / d * RELAX_MAX; q.y = q.oy + dy / d * RELAX_MAX; }
    });
    if (worst < 0.05) break;
  }

  const out = {};
  p.forEach(q => { out[q.id] = { x: q.x, y: q.y }; });
  return out;
}

function coastPath(pts, MX, MY) {
  const p = pts.map(function (q) { return [MX(q[0]), MY(q[1])]; });
  const mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let d = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[(i + 1) % p.length];
    const m0 = mid(p[i], c);
    const m1 = mid(c, p[(i + 2) % p.length]);
    if (i === 0) d += 'M' + m0[0].toFixed(1) + ',' + m0[1].toFixed(1);
    d += ' Q' + c[0].toFixed(1) + ',' + c[1].toFixed(1) + ' ' + m1[0].toFixed(1) + ',' + m1[1].toFixed(1);
  }
  return d + 'Z';
}

function landHTML(MX, MY, k) {
  return LANDS.map(function (pts) {
    const d = coastPath(pts, MX, MY);
    return '<path class="land" d="' + d + '"/>'
      + '<path class="landedge" d="' + d + '" stroke-width="' + (1.8 * k).toFixed(2) + '"/>';
  }).join('');
}

/* The strip along the top of the chart.

   It used to be a card per region floating over the water, locked ones
   included, carrying a danger swatch, a charter count, a count of things ready
   to sail and the admiral bar. Most of that was not worth the room:

     the danger swatch showed a region's WORST lane, but danger belongs to one
     lane, so a single bad run made a whole sea look bad;
     "ready to sail" counted markers you were already looking at;
     locked regions had, by definition, nothing to tell you.

   The charter count went the same way for the same reason: a charter is a star
   on the chart you are looking at, so counting them above it says the same
   thing twice.

   What is left is the one thing the chart cannot show — how close each sea is
   to sending its admiral out, which is both the progression gate and the reason
   the ships there keep getting heavier. A patrol keeps its remaining time,
   because a countdown is the one thing here that a marker cannot express.

   Plus the thing that was missing: how many hulls are free. Every marker on
   this screen wants one to three of them, so a fleet that is all at sea makes
   the whole chart untappable — which the chart itself never said. */
function buildRegionBar() {
  const free = allShips().length - busyIds().size;
  const total = allShips().length;

  const seas = Object.keys(REGIONS).filter(rk => S.unlocked.includes(rk)).map((rk, i) => {
    const b = BOSSES[rk], need = b ? b.noto : 1;
    const cur = Math.min(wantedOf(rk), need), done = S.bossBeaten[rk];
    const ready = cur >= need && !done;
    const pct = done ? 0 : Math.round(cur / need * 100);

    /* How wanted you are in this water is the card itself filling up, rather
       than a gauge and a number sitting next to the name.

       "37/100" is a reading to be taken; a card that is a third full is a thing
       you glance at. The number never mattered anyway — nothing in the game is
       priced off it and there is nothing to spend it on. All it ever had to say
       was how close the admiral is, and a fill says that without being read. */
    const tail = done
      ? `<span class="seadone" title="${esc(b.n)} beaten">${iconHTML('flag', 40)}</span>`
      : (ready ? `<span class="seaout">${iconHTML('noto', 40)}OUT</span>` : '');

    const title = done ? `${b.n} beaten`
      : (ready ? 'The admiral is out — go and fight her'
        : 'How badly you are wanted in these waters. Fill it and the admiral comes for you.');

    /* One line per sea. Anything with a glyph on it is 40px tall by the size
       floor, so a second row would double the strip for nothing. */
    return `<div class="sea ${ready ? 'alert' : ''}${done ? ' beaten' : ''}"
      style="--i:${i};--wanted:${pct}%" title="${esc(title)}">
      <b class="seaname">${esc(REGIONS[rk].n)}</b>
      ${patrolActive(rk) ? `<span class="seapatrol" title="Patrol in force">${iconHTML('flag', 40)}`
        + `<b class="clock" data-endsat="${S.patrol[rk]}" data-gone=".seapatrol">`
        + `${fmtDur(patrolLeft(rk) / 1000)}</b></span>` : ''}
      ${tail}
    </div>`;
  }).join('');

  return `<div class="seas">${seas}</div>
    <div class="mapfleet ${free ? '' : 'none'}" title="Ships free to sail">
      ${iconHTML('crew', 40)}<b>${free}</b><i>/</i>${total}</div>`;
}

/* What the markers mean.

   This used to be a permanent panel across the foot of the chart. On a phone it
   was taking a third of the screen to answer a question the player asks twice
   and then never again — and it sat on top of the water, so the thing it was
   explaining was the thing it was covering. It opens on request now. */
actions({
  legend: () => alertDlg({
    title: 'The Chart',
    chips: `<div class="keygrid">${shapeKey(allRoutes(), true, true)}</div>`,
    ok: 'Close'
  })
});
