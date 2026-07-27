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
  patrolActive, patrolLeft, fmtDur, canVoyage, diveReachable
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';
import { actions } from '../../core/actions.js';
import { render } from '../../core/bus.js';

/* Whether the region cards and the shape key are on screen. They are useful
   until you know them and then they are just covering water, so they fold away
   and the chart takes the room back. Screen state, not save state. */
let legendShown = true;

/* The closest two markers are never nearer than this on screen. A thumb is
   about 44px; a marker plus breathing room either side is roughly double. */
const MIN_NODE_GAP = 96;

/* And no bigger than this in either direction, however tight the authoring. */
const MAX_CHART = 2600;

/* Drag to pan. Touch scrolls the container by itself; this is for a mouse, and
   it deliberately does not swallow taps — a drag under the slop threshold still
   lands on whatever node was under the pointer. */
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
  /* cargo run: filled disc with a bright centre */
  return `<circle cx="${x}" cy="${y}" r="${s}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${2 * k}" fill="#eaf4f4"/>`;
}

export function renderMap() {
  const host = $('main');
  const CW = Math.max(320, host.clientWidth || innerWidth);
  const CH = Math.max(300, host.clientHeight || (innerHeight - 190));
  const wide = CW >= 760;

  const rs = allRoutes();
  const active = {};
  S.voyages.forEach(v => { active[v.routeId] = v; });

  /* Which admirals are drawn at all — they count toward the fitted view. */
  const bossKeys = Object.keys(REGIONS).filter(rk =>
    S.unlocked.includes(rk) && BOSSES[rk] && (S.bossBeaten[rk] || bossReady(rk)));

  /* The legend is absolutely positioned; on a narrow screen it sits above the
     chart, so measure it and keep the chart clear of it. Written first so the
     SVG (inserted afterwards) lands behind it. */
  const anyBeaten = Object.keys(S.bossBeaten || {}).some(rk => S.bossBeaten[rk]);
  $('main').innerHTML = `<div id="mapwrap" class="${legendShown ? '' : 'nolegend'}">
    <div id="mapscroll"></div>
    <div class="legend${wide ? '' : ' narrow'}">${buildLegend(rs)}</div>
    <div class="maphint">${shapeKey(rs, bossKeys.some(rk => !S.bossBeaten[rk]), anyBeaten)}</div>
    <button class="legtoggle" data-act="legend" aria-label="Show or hide the key"
      title="${legendShown ? 'Hide the key' : 'Show the key'}">${iconHTML('map', 40)}</button>
  </div>`;
  const legendEl = host.querySelector('.legend');
  const hintEl = host.querySelector('.maphint');
  const legW = (wide && legendShown) ? Math.min(320, CW * 0.17) + 46 : 0;
  const legH = (wide || !legendShown) ? 0 : ((legendEl ? legendEl.offsetHeight : 0) + 18);
  /* Node labels hang below their marker, so the bottom needs the hint's real
     height plus a line of headroom — otherwise HOME PORT sits under it. And a
     folded-away key takes none of it. */
  const hintH = legendShown ? ((hintEl ? hintEl.offsetHeight : 40) + 16) : 20;

  const padX = Math.max(40, CW * 0.05);
  const padTop = Math.max(46, CH * 0.07) + legH;
  const padBot = hintH + 46;
  const x0 = padX + legW, x1 = CW - padX, y0 = padTop, y1 = CH - padBot;

  /* Fit the view to the nodes that actually exist right now. Projecting the
     whole 360x560 authored chart wastes most of the screen in the early game,
     when only the Caribbean corner is unlocked; this zooms out as the map
     opens up. Scale is uniform so the chart never looks stretched. */
  const pts = [HOME, ...rs.map(r => ({ x: r.x, y: r.y })), ...bossKeys.map(rk => BOSSES[rk])];
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

  const hx = MX(HOME.x), hy = MY(HOME.y);
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
    const x = MX(r.x), y = MY(r.y);

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
    const x = MX(b.x), y = MY(b.y);

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
      <g transform="scale(${LSX},${LSY})" opacity=".85">
        <path d="M-10,470 Q60,430 120,462 Q180,494 250,470 Q320,448 370,478 L370,570 L-10,570 Z" fill="#0a2f2c"/>
        <path d="M-10,60 Q40,90 20,150 Q0,210 30,240 L-10,260 Z" fill="#0a2f2c"/>
        <path d="M300,-10 Q280,40 320,70 Q356,96 340,140 L370,150 L370,-10 Z" fill="#0a2f2c"/>
        <path d="M150,300 q14,-8 30,0 q10,8 -4,14 q-20,6 -26,-14 Z" fill="#0a2f2c"/>
        <path d="M210,380 q18,-6 30,4 q8,10 -8,13 q-22,3 -22,-17 Z" fill="#0a2f2c"/>
      </g>
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
  scroller.innerHTML = svg;
  scroller.classList.toggle('pannable', contentW > CW + 2 || contentH > CH + 2);

  /* Open centred on home port — that is where the player's eye starts, and on a
     chart bigger than the screen it is the only sensible anchor. The legend
     covers the top and the key covers the foot, so centre it on the water that
     is actually visible between them rather than on the raw viewport. */
  const seenTop = legH, seenBot = hintH;
  scroller.scrollLeft = Math.max(0, MX(HOME.x) - (legW + CW) / 2);
  scroller.scrollTop = Math.max(0, MY(HOME.y) + HLBL + 26 - (seenTop + (CH - seenTop - seenBot)));
  enablePan(scroller);
}

/* The map key: each marker silhouette against the word for what it is. A legend
   names its symbols — that is the whole job — so the shape is the symbol and the
   word is the name, and neither stands in for the other.

   It lists only what is actually drawn right now, which is what keeps it both
   complete and short: the Caribbean alone needs five entries, an admiral adds
   hers the moment she sails, and a shape can never appear unnamed. */
const KEY_ORDER = ['cargo', 'dive', 'patrol', 'escort', 'raid', 'blockade', 'charter', 'boss', 'beaten'];
const KEY_WORD = {
  cargo: 'Cargo', dive: 'Wreck', patrol: 'Patrol', escort: 'Escort',
  raid: 'Raid', blockade: 'Blockade', charter: 'Charter',
  boss: 'Admiral', beaten: 'Beaten'
};
const KEY_COL = {
  cargo: '#63c06a', dive: '#7ab0e0', patrol: '#e0a03a', escort: '#e0a03a',
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

function buildLegend(rs) {
  let li = 0;
  return Object.keys(REGIONS).map(rk => {
    li++;
    if (!S.unlocked.includes(rk))
      return `<div class="leg lock" style="--i:${li}"><div class="legrow"><i style="background:#173238"></i>`
        + `${iconHTML('lock', 40)}<span>${esc(REGIONS[rk].n)}</span></div></div>`;

    const mine = rs.filter(r => r.region === rk);
    const maxd = mine.length ? Math.max(...mine.map(effDanger)) : 0;
    const b = BOSSES[rk], need = b ? b.noto : 1;
    const cur = Math.min(S.noto[rk] || 0, need), done = S.bossBeaten[rk];
    const chn = CHARTERS.filter(c => PORTS[c.loc].region === rk && charterAvailable(c)).length;
    const openN = mine.filter(r => canVoyage(r) && voyageOpen(r)).length;

    /* Counts of things worth a tap, as glyph + number. */
    const meta = [
      patrolActive(rk) ? `<span title="Patrol in force">${iconHTML('flag', 40)}${fmtDur(patrolLeft(rk) / 1000)}</span>` : '',
      chn ? `<span style="color:#efe3ae" title="Charters on offer">${iconHTML('star', 40)}${chn}</span>` : '',
      openN ? `<span style="color:#63c06a" title="Ready to sail">${iconHTML('anchor', 40)}${openN}</span>` : ''
    ].filter(Boolean).join('');

    /* The admiral bar is a have/need on notoriety: fill it and she sails out. */
    const noto = done
      ? `<div class="legdone" title="${esc(b.n)} defeated">${iconHTML('flag', 40)}${esc(b.n)}</div>`
      : `<div class="notobar ${cur >= need ? 'full' : ''}"><i style="width:${cur / need * 100}%"></i></div>
         <div class="legdone ${cur >= need ? 'ready' : ''}" title="${cur >= need ? 'Admiral ready — attack' : 'Notoriety'}">
           ${iconHTML('noto', 40)}${cur}<i>/</i>${need}</div>`;

    return `<div class="leg" style="--i:${li}">
      <div class="legrow"><i style="background:${DHEX[maxd]}"></i><span>${esc(REGIONS[rk].n)}</span></div>
      ${meta ? `<div class="legmeta">${meta}</div>` : ''}
      ${noto}
    </div>`;
  }).join('');
}

actions({ legend: () => { legendShown = !legendShown; render(); } });
