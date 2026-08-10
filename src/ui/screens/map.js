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
import { iconHTML, glyphBody } from '../../art/icons.js';
import { actions } from '../../core/actions.js';
import { render } from '../../core/bus.js';
import { alertDlg } from '../dialog.js';
import { bountyFrac, bountyLeft } from '../../core/bounties.js';

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
const MIN_NODE_GAP = 88;

/* And no bigger than this in either direction, however tight the authoring.

   Raised once the whole ocean started carrying bounties and wrecks as well as
   fixed routes: at 2600 the fully-opened chart could not be drawn large enough
   to give its markers the room they had already been spaced for in authored
   units, so they arrived on screen closer than intended. The chart pans, and it
   pinches, so a bigger one costs nothing but scrolling. */
const MAX_CHART = 4400;

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
    if (pts.size === 2) {
      base = dist(); baseZoom = zoom;
      /* Hold both fingers even if one slides off the scroller or over a marker
         — losing one mid-pinch was most of what made the gesture feel like it
         kept giving up on you. */
      pts.forEach((_, id) => { try { scroller.setPointerCapture(id); } catch (e) { /* gone */ } });
      scroller.classList.add('zooming');
    }
  });

  scroller.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size !== 2 || !base) return;
    ev.preventDefault();
    const m = mid();
    applyZoom(scroller, baseZoom * (dist() / base), m.x, m.y);
  }, { passive: false });

  const lift = ev => {
    if (pts.has(ev.pointerId)) {
      try { scroller.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
    }
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

/* What a marker means, at a glance.

   The chart used to carry one silhouette per mission type — eleven of them,
   each abstract, each needing the key to decode. That is a lot to hold in your
   head for information the sheet repeats the moment you tap. So markers say
   the KIND of thing that is there, in five pictures a player already knows:

     scales   a trade run. Never a fight.
     skull    a fight. Which kind is on the label and on the sheet.
     bicorne  an admiral.
     warrant  a bounty hunter — a blade and the price on it.
     wreck    something on the bottom. Never a fight.

   Charters keep their star: they are one-offs that open a port for good, which
   is not any of the five.

   The pictures come from the icon set (art/icons.js) rather than being drawn
   again here, so the marker, the key and any chip wearing the same glyph can
   never drift apart. */
const MARKER_GLYPH = {
  cargo: 'scales',
  dive: 'wreck',
  boss: 'bicorne',
  bounty: 'warrant',
  charter: 'star'
};
const markerGlyph = t => MARKER_GLYPH[t] || 'skull';

/* Place a 24x24 glyph on the chart, centred and scaled to the marker. */
function glyphMark(x, y, k, name, col) {
  const span = 21 * k, sc = span / 24;
  return `<g transform="translate(${x - span / 2} ${y - span / 2}) scale(${sc})">`
    + glyphBody(name, col) + '</g>';
}

function nodeShape(r, col, k) {
  return glyphMark(r.x, r.y, k, markerGlyph(r.type), col);
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
    { id: 'HOME', x: HOME.x, y: HOME.y, room: ROOM.home },
    ...rs.map(r => ({ id: r.id, x: r.x, y: r.y, room: roomFor(r) })),
    ...bossKeys.map(rk => ({ id: BOSSES[rk].id, x: BOSSES[rk].x, y: BOSSES[rk].y, room: ROOM.boss }))
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
  /* Labels are collected rather than emitted, so they can be laid out against
     each other once every marker is placed. A chart with eleven activities on
     it will otherwise print BARNABY SKEFFINGTON straight through DEPTH 1 — the
     markers are spaced, but the words hanging off them are not, and the words
     are much the wider of the two. See placeLabels() below. */
  const labelSpecs = [];
  const labelAt = (x, y, text, size, fill, stroke, spacing, second) => {
    labelSpecs.push({ x, y, text, size, fill, stroke, spacing, second });
  };

  rs.forEach(r => {
    const isCh = r.type === 'charter', isDive = r.type === 'dive';
    const d = effDanger(r);
    /* Dives carry no danger rating, so they are tinted by whether the bell can
       reach them rather than by how dangerous the water is. Charters carry no
       danger rating either — they are tiered, not dangerous — so they keep the
       gold the rest of the game already uses for a charter tag. */
    const col = isCh ? '#BD913B' : isDive ? (diveReachable(r) ? '#6CB7B2' : '#6B7280') : DHEX[d];
    const open = canVoyage(r) && voyageOpen(r);
    const rp = at(r); const x = MX(rp.x), y = MY(rp.y);

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="${col}" stroke-width="${1.6 * MS}" opacity="0.7"/>`;
    if (active[r.id])
      voyLines += `<path class="voyline" d="M${hx},${hy} L${x},${y}" stroke="#6CB7B2" stroke-width="${2.4 * MS}" opacity="0.95"/>`;

    const isBt = r.type === 'bounty';
    const label = isCh ? PORTS[r.charterDef.loc].n.toUpperCase()
      : r.portId ? PORTS[r.portId].n.toUpperCase()
      : isDive ? 'DEPTH ' + r.depth
      : isBt ? r.n.toUpperCase()
      : '';
    const labelColor = isCh ? '#E2D6B6' : (isDive ? '#6CB7B2' : (isBt ? '#E07A6A' : '#8DA58A'));

    /* A bounty is the one marker with a clock on it, so the clock is drawn ON
       it: a ring that empties as her window runs down, and the time left in
       words underneath her name. Both are needed — the ring is what you read at
       a glance across the whole chart, the figure is what you read when you are
       deciding whether there is time to go. */
    let clockRing = '';
    if (isBt) {
      const f = bountyFrac(r);
      const rr = 15 * MS, C = 2 * Math.PI * rr;
      clockRing = `<circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="${3 * MS}"/>`
        + `<circle class="btring" cx="${x}" cy="${y}" r="${rr}" fill="none"`
        + ` stroke="${f < 0.25 ? '#E07A6A' : '#C86A4A'}" stroke-width="${3 * MS}" stroke-linecap="round"`
        + ` stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}"`
        + ` transform="rotate(-90 ${x} ${y})"/>`;
    }

    /* Every marker — cargo, dive, bounty, charter alike — sits in the same
       navy disc with the same brass ring, the way the game's circular icon
       buttons everywhere else are drawn. A charter used to be its own star-
       shaped marker, which made "what kind of job is this" a shape question
       on top of a colour one; now the shape never changes and only the glow
       behind the disc, the ring around it, and the glyph inside it carry the
       colour that says what this is. */
    nodes += `<g id="node_${r.id}" data-act="mission" data-id="${r.id}"
      class="mapnode${isBt ? ' bountynode' : ''}">
      ${hitShapes(x, y, label, LBL, 18 * MS)}
      <circle class="nodeglow" cx="${x}" cy="${y}" r="${15 * MS}" fill="${col}"/>
      <circle class="nodering" cx="${x}" cy="${y}" r="${13 * MS}" fill="#15273E" stroke="${col}" stroke-width="${1.6 * MS}"/>
      ${clockRing}
      ${nodeShape({ ...r, x, y }, col, MS)}
      ${open ? `<circle cx="${x + 10 * MS}" cy="${y - 10 * MS}" r="${4.2 * MS}" fill="#8DA58A" stroke="#0B1622" stroke-width="1.3"/>` : ''}
      ${active[r.id] ? `<circle cx="${x - 10 * MS}" cy="${y - 10 * MS}" r="${4.2 * MS}" fill="#6CB7B2" stroke="#0B1622" stroke-width="1.3"/>` : ''}
    </g>`;
    /* A bounty's name and her clock are one label on two lines, not two labels.
       As two they were each other's nearest neighbour and the layout below
       spent its effort prising apart the one pair that is meant to be together. */
    if (label) {
      labelAt(x, y + 18 * MS + LBL, label, LBL, labelColor, '#15273E', 1,
        isBt ? { text: fmtDur(bountyLeft(r) / 1000) + ' LEFT', fill: '#E07A6A' } : null);
    }
  });

  bossKeys.forEach(rk => {
    const b = BOSSES[rk];
    const bp = at(b);
    const x = MX(bp.x), y = MY(bp.y);

    if (S.bossBeaten[rk]) {
      bossNodes += `<g>${struckFlag(x, y, MS, '#BD913B')}</g>`;
      return;
    }

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="#C86A4A" stroke-width="${2 * MS}" opacity="0.9"/>`;
    /* Bigger than a job marker, for the hierarchy, but the same disc-and-ring
       construction — an admiral is not a different KIND of thing on this
       chart, she is the biggest one. */
    bossNodes += `<g id="node_${b.id}" data-act="mission" data-id="${b.id}" class="mapnode">
      ${hitShapes(x, y, b.n.toUpperCase(), LBL, 22 * MS)}
      <circle class="bossglow" cx="${x}" cy="${y}" r="${18 * MS}" fill="#C86A4A"/>
      <circle class="nodering" cx="${x}" cy="${y}" r="${16 * MS}" fill="#15273E" stroke="#C86A4A" stroke-width="${1.8 * MS}"/>
      ${glyphMark(x, y, 1.65 * MS, 'bicorne', '#E07A6A')}</g>`;
    labels += labelAt(x, y + 22 * MS + LBL, b.n.toUpperCase(), LBL, '#E07A6A', '#15273E', 1.2);
  });

  labelAt(hx, hy + 22 * MS + HLBL, 'HOME PORT', HLBL, '#BD913B', '#15273E', 2);
  labels = placeLabels(labelSpecs, LBL);

  /* ---- bleed ----

     The drawing used to end exactly where the outermost marker did, so pulling
     the chart back showed its corners and the sea stopped in a straight line —
     which reads as a picture of a map rather than as an ocean. There is a band
     of open water all the way round now, wide enough that at the furthest zoom
     out there is still sea past the edge of the screen.

     Everything inside is drawn shifted by BLEED, so the projection above did
     not have to know about any of this. */
  const bleed = Math.round(Math.max(CW, CH) * (1 / ZOOM_MIN - 1) * 0.55) + 120;
  const fullW = contentW + bleed * 2, fullH = contentH + bleed * 2;

  const svg = `<svg id="mapsvg" width="${fullW}" height="${fullH}"
      viewBox="0 0 ${fullW} ${fullH}" preserveAspectRatio="none">
      <defs>
        <radialGradient id="seabg" cx="45%" cy="40%" r="80%">
          <stop offset="0%" stop-color="#1C5A5E"/><stop offset="55%" stop-color="#15273E"/><stop offset="100%" stop-color="#0B1622"/>
        </radialGradient>
      </defs>
      <rect width="${fullW}" height="${fullH}" fill="url(#seabg)"/>
      <g transform="translate(${bleed},${bleed})">
        <g class="coast">${landHTML(MX, MY, MS)}</g>
        ${lines}${voyLines}
        <g>
          <circle class="nodeglow" cx="${hx}" cy="${hy}" r="${19 * MS}" fill="#BD913B"/>
          <circle cx="${hx}" cy="${hy}" r="${7 * MS}" fill="#BD913B" stroke="#000" stroke-width="1.4"/>
        </g>
        ${nodes}${bossNodes}
        <g class="maplabels">${labels}</g>
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
  /* Everything inside the drawing is shifted by the bleed, so home port is that
     much further into the scrolled area than its projected position. */
  scroller.scrollLeft = Math.max(0, bleed + MX(HOMEP.x) - (legW + CW) / 2);
  scroller.scrollTop = Math.max(0, bleed + MY(HOMEP.y) + HLBL + 26 - (seenTop + (CH - seenTop - seenBot)));
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
/* The key names what the five pictures mean, not eleven mission types — the
   chart draws five, so the key that decodes it has five rows. Which flavour of
   fight a skull is stays on its label and on the sheet behind it. */
const KEY_ORDER = ['cargo', 'fight', 'dive', 'bounty', 'charter', 'boss', 'beaten'];
const KEY_WORD = {
  cargo: 'Trade Run', fight: 'Battle', dive: 'Wreck', bounty: 'Bounty Hunter',
  charter: 'Charter', boss: 'Admiral', beaten: 'Beaten'
};
const KEY_COL = {
  cargo: '#8DA58A', fight: '#D49A3A', dive: '#6CB7B2', bounty: '#C86A4A',
  charter: '#E2D6B6', boss: '#E07A6A', beaten: '#BD913B'
};
/* Every fight type answers to one row. */
const KEY_ROW = t => (KEY_WORD[t] ? t : 'fight');

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
    : type === 'charter'
      ? `<path d="${starPath(12, 12, 9)}" fill="${col}" stroke="#A68F3A" stroke-width="1.2"/>`
      : glyphMark(12, 12, 1.14, markerGlyph(type), col);
  return `<svg class="keysh" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">${inner}</svg>`;
}

function shapeKey(rs, liveBosses, beaten) {
  const kinds = new Set(rs.map(r => KEY_ROW(r.type)));
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
/* How much room a marker needs around it, in authored units.

   Not one number for everything, because a marker is not what takes up the
   space — its LABEL is, and the labels are wildly different sizes. "DEPTH 2" is
   a third the width of "CUTLASS JACK DOYLE", and a bounty carries two lines
   where everything else carries one. Spacing them all identically meant either
   the chart was needlessly huge or the big labels had nowhere to go, and no
   amount of shuffling the words afterwards could fix markers that were simply
   too close together for what they were carrying. */
const ROOM = {
  plain:  46,     // an unlabelled marker: a raid, a patrol, a convoy
  dive:   58,     // "DEPTH 3"
  port:   72,     // "NEW ORLEANS"
  home:   82,     // "HOME PORT", and everything radiates from it
  boss:   86,     // "ALMIRANTE SOMBRA"
  bounty: 100     // a captain's full name, over a clock, on two lines
};

const roomFor = r =>
  r.type === 'bounty' ? ROOM.bounty
    : r.type === 'dive' ? ROOM.dive
      : (r.portId || r.type === 'charter') ? ROOM.port
        : ROOM.plain;

const RELAX_GAP = 46;
/* How far a marker may drift from where it was authored.

   It has to be generous enough that a crowded corner can actually untangle: at
   full unlock there are forty-odd markers in a 360x560 chart, and a short leash
   means every one of them is yanked back into its neighbour on the same
   iteration it was pushed clear of it. */
const RELAX_MAX = 74;

const PINNED = id => id === 'HOME' || id.startsWith('k_') || id.startsWith('ch_');

function relaxed(pts) {
  const p = pts.map(q => ({
    id: q.id, x: q.x, y: q.y, ox: q.x, oy: q.y,
    pin: PINNED(q.id), room: q.room || RELAX_GAP
  }));

  for (let it = 0; it < 120; it++) {
    let worst = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i], b = p[j];
        if (a.pin && b.pin) continue;
        /* The pair is spaced by whichever of the two needs more room, so a
           bounty pushes a dive away rather than meeting it halfway. */
        const RELAX_GAP = Math.max(a.room, b.room);
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

/* ---- laying the labels out ----

   Markers are spaced by relaxed(); their labels are not, and a label is far
   wider than the marker it hangs off — "BARNABY SKEFFINGTON" is eight times the
   width of the dot it belongs to. So on a busy chart the dots were all
   comfortably apart and the words were printed straight through one another.

   Each label is boxed, then any two boxes that overlap are pushed apart
   vertically: down for the lower one, up for the upper, which keeps a label
   under its own marker rather than beside somebody else's. Vertical only,
   because horizontal movement breaks the one thing a label has to do — say
   which dot it belongs to.

   Oswald is condensed; 0.52em a character plus the tracking is close enough for
   a box that only has to be right to a few pixels. */
const LABEL_PAD_Y = 3;
const LINE_GAP = 1.15;          // a second line, in multiples of the font size

function labelWidth(text, size, spacing) {
  return text.length * (size * 0.52 + (spacing || 0)) + 10;
}

function labelBox(s) {
  const w = Math.max(
    labelWidth(s.text, s.size, s.spacing),
    s.second ? labelWidth(s.second.text, s.size * 0.92, s.spacing) : 0);
  const deep = s.second ? s.size * LINE_GAP : 0;
  return { x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - s.size, y1: s.y + deep + LABEL_PAD_Y };
}

function placeLabels(specs, base) {
  const put = specs.map(s => ({ s, b: labelBox(s), home: s.y, homeX: s.x }));
  /* How far a label may hang from its own marker before it stops reading as
     belonging to it. Generous, because two labels printed through each other is
     a worse failure than one sitting a little low or a little to one side. */
  const DOWN = base * 5;
  const SIDE = base * 6;

  const overlapping = (A, B) =>
    A.b.x0 < B.b.x1 && B.b.x0 < A.b.x1 && A.b.y0 < B.b.y1 && B.b.y0 < A.b.y1;

  /* Move one label as far as its own allowance permits and report how far it
     actually got. Refusing to move a pair at all because ONE of them was at its
     limit used to leave both exactly where they overlapped. */
  const shift = (q, dx, dy) => {
    const nx = Math.max(q.homeX - SIDE, Math.min(q.homeX + SIDE, q.s.x + dx));
    const ny = Math.max(q.home - DOWN, Math.min(q.home + DOWN, q.s.y + dy));
    const got = Math.abs(nx - q.s.x) + Math.abs(ny - q.s.y);
    q.s.x = nx; q.s.y = ny;
    q.b = labelBox(q.s);
    return got;
  };

  /* Down first, then sideways, alternating.

     Each pass can undo a little of the other's work — a label pushed down to
     clear one neighbour lands in a third one's column — so running each once
     left a collision on a busy chart about half the time. Alternating settles
     it. Vertical is tried first and harder because a label under its marker is
     the one that reads correctly; sideways is the fallback. */
  for (let round = 0; round < 6; round++) {
    let worst = 0;
    for (const sideways of [false, true]) {
      for (let it = 0; it < 40; it++) {
        let moved = 0;
        for (let i = 0; i < put.length; i++) {
          for (let j = i + 1; j < put.length; j++) {
            const A = put[i], B = put[j];
            if (!overlapping(A, B)) continue;
            if (sideways) {
              const [left, right] = A.s.x <= B.s.x ? [A, B] : [B, A];
              const step = Math.min(8, (Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0)) / 2 + 1);
              moved = Math.max(moved, shift(left, -step, 0), shift(right, step, 0));
            } else {
              const [up, down] = A.s.y <= B.s.y ? [A, B] : [B, A];
              const step = (Math.min(A.b.y1, B.b.y1) - Math.max(A.b.y0, B.b.y0) + 2) / 2;
              moved = Math.max(moved, shift(up, 0, -step), shift(down, 0, step));
            }
          }
        }
        if (moved < 0.4) break;
        worst = Math.max(worst, moved);
      }
    }
    if (worst < 0.4) break;
  }

  return put.map(({ s }) =>
    `<text x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" text-anchor="middle" fill="${s.fill}"`
    + ` font-size="${s.size}" font-family="Oswald" letter-spacing="${s.spacing}"`
    + ` style="paint-order:stroke" stroke="${s.stroke}" stroke-width="3">${esc(s.text)}`
    + (s.second
      ? `<tspan x="${s.x.toFixed(1)}" dy="${(s.size * LINE_GAP).toFixed(1)}" fill="${s.second.fill}"`
        + ` font-size="${(s.size * 0.92).toFixed(1)}">${esc(s.second.text)}</tspan>`
      : '')
    + '</text>').join('');
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
