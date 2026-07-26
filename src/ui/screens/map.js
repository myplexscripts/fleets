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

function starPath(x, y, r) {
  return `M${x},${y - r} L${x + r * 0.35},${y - r * 0.35} L${x + r},${y} L${x + r * 0.35},${y + r * 0.35} ` +
         `L${x},${y + r} L${x - r * 0.35},${y + r * 0.35} L${x - r},${y} L${x - r * 0.35},${y - r * 0.35} Z`;
}

/* Mission type reads from the marker's silhouette, not just its colour, and the
   two voyage shapes read differently from the four fighting shapes. */
function nodeShape(r, col, k) {
  const { x, y } = r, s = 5.5 * k;
  if (r.type === 'dive')                            // ring: something below
    return `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="${col}" stroke-width="${2.8 * k}"/>`
         + `<circle cx="${x}" cy="${y}" r="${s * 0.34}" fill="${col}"/>`;
  if (r.type === 'patrol')                          // rotated square
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" transform="rotate(45 ${x} ${y})" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'raid' || r.type === 'blockade')    // spearhead
    return `<path d="M${x},${y - s * 1.35} L${x + s * 1.2},${y + s * 0.85} L${x - s * 1.2},${y + s * 0.85} Z" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
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
  $('main').innerHTML = `<div id="mapwrap">
    <div class="legend${wide ? '' : ' narrow'}">${buildLegend(rs)}</div>
    <div class="maphint">${shapeKey()}</div>
  </div>`;
  const legendEl = host.querySelector('.legend');
  const hintEl = host.querySelector('.maphint');
  const legW = wide ? Math.min(320, CW * 0.17) + 46 : 0;
  const legH = wide ? 0 : ((legendEl ? legendEl.offsetHeight : 0) + 18);
  /* Node labels hang below their marker, so the bottom needs the hint's real
     height plus a line of headroom — otherwise HOME PORT sits under it. */
  const hintH = (hintEl ? hintEl.offsetHeight : 40) + 16;

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
  const k = Math.min(availW / bw, availH / bh);
  const ox = x0 + (availW - bw * k) / 2 - minX * k;
  const oy = y0 + (availH - bh * k) / 2 - minY * k;

  const MX = x => +(ox + x * k).toFixed(1);
  const MY = y => +(oy + y * k).toFixed(1);
  const NR = Math.max(1.0, Math.min(CW / 900, CH / 620) * 1.5);   // node radius scale
  const LBL = Math.max(16, Math.round(13 * NR));
  const HLBL = Math.max(18, Math.round(14.5 * NR));
  const LSX = CW / 360, LSY = CH / 560;

  /* How close together the nodes actually landed. As more regions unlock the
     same screen has to hold more of the chart, and a fixed tap target would
     start swallowing its neighbours — so both the marker and its hit circle
     shrink to fit the tightest gap on screen. */
  let minGap = Infinity;
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const dx = (pts[a].x - pts[b].x) * k, dy = (pts[a].y - pts[b].y) * k;
      const dd = Math.hypot(dx, dy);
      if (dd > 0.5) minGap = Math.min(minGap, dd);
    }
  }
  const HIT = Math.max(9, Math.min(22 * NR, (minGap === Infinity ? 999 : minGap) / 2 - 1));
  /* Markers follow the hit circle down, but never below legibility. */
  const MS = Math.max(NR * 0.55, Math.min(NR, HIT / 16));

  /* Labels are centre-anchored on their node, so one near an edge would run off
     screen. Nudge the text (not the marker) far enough in to stay readable. */
  const labelX = (x, text, size) => {
    const half = text.length * size * 0.32;
    return +Math.min(Math.max(x, legW + 6 + half), CW - 6 - half).toFixed(1);
  };

  /* Transparent tap targets. The marker gets a circle; a labelled node also gets
     a patch covering the gap down to its label, so the words are part of the
     button and there is no dead strip between the two. */
  const hitShapes = (x, y, label, size, drop) => {
    let out = `<circle cx="${x}" cy="${y}" r="${HIT}" fill="${'transparent'}"/>`;
    if (label) {
      const half = Math.min(HIT * 2.2, Math.max(HIT, label.length * size * 0.32));
      const lx = labelX(x, label, size);
      out += `<rect x="${(lx - half).toFixed(1)}" y="${y.toFixed(1)}" width="${(half * 2).toFixed(1)}"`
        + ` height="${(drop + size).toFixed(1)}" fill="transparent"/>`;
    }
    return out;
  };

  const hx = MX(HOME.x), hy = MY(HOME.y);
  let lines = '', nodes = '', bossNodes = '', voyLines = '';

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
      ${label ? `<text x="${labelX(x, label, LBL)}" y="${y + 18 * MS + LBL}" text-anchor="middle" fill="${labelColor}" font-size="${LBL}" font-family="Oswald" letter-spacing="1" style="paint-order:stroke" stroke="#04161c" stroke-width="3">${esc(label)}</text>` : ''}
    </g>`;
  });

  bossKeys.forEach(rk => {
    const b = BOSSES[rk];
    const x = MX(b.x), y = MY(b.y);

    if (S.bossBeaten[rk]) {
      /* A struck flag marks a beaten admiral. */
      bossNodes += `<g><circle cx="${x}" cy="${y}" r="${9 * MS}" fill="none" stroke="#d9c98a" stroke-width="1.8" opacity=".6"/>
        <path d="M${x - 3.5 * MS},${y - 5 * MS} v${10 * MS} M${x - 3.5 * MS},${y - 5 * MS} h${7.5 * MS} l${-2.4 * MS},${2.6 * MS} l${2.4 * MS},${2.6 * MS} h${-7.5 * MS}"
          fill="#d9c98a" stroke="#d9c98a" stroke-width="${1.2 * MS}" stroke-linejoin="round"/></g>`;
      return;
    }

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="#d94a3a" stroke-width="${2 * MS}" opacity="0.9"/>`;
    bossNodes += `<g id="node_${b.id}" data-act="mission" data-id="${b.id}" class="mapnode">
      ${hitShapes(x, y, b.n.toUpperCase(), LBL, 22 * MS)}
      <circle class="bossglow" cx="${x}" cy="${y}" r="${18 * MS}" fill="#d94a3a"/>
      <path d="${starPath(x, y, 10 * MS)}" fill="#f0b0a6" stroke="#5e1a1a" stroke-width="1.4"/>
      <text x="${labelX(x, b.n.toUpperCase(), LBL)}" y="${y + 22 * MS + LBL}" text-anchor="middle" fill="#f0b0a6" font-size="${LBL}" font-family="Oswald" letter-spacing="1.2" style="paint-order:stroke" stroke="#0a0507" stroke-width="3">${esc(b.n.toUpperCase())}</text></g>`;
  });

  const svg = `<svg id="mapsvg" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none">
      <defs>
        <radialGradient id="seabg" cx="45%" cy="40%" r="80%">
          <stop offset="0%" stop-color="#0e3a40"/><stop offset="55%" stop-color="#082830"/><stop offset="100%" stop-color="#04161c"/>
        </radialGradient>
      </defs>
      <rect width="${CW}" height="${CH}" fill="url(#seabg)"/>
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
        <text x="${labelX(hx, 'HOME PORT', HLBL)}" y="${hy + 22 * MS + HLBL}" text-anchor="middle" fill="#d9c98a" font-size="${HLBL}" font-family="Oswald" letter-spacing="2" style="paint-order:stroke" stroke="#04161c" stroke-width="3">HOME PORT</text>
      </g>
      ${nodes}${bossNodes}
    </svg>`;

  /* Behind the legend that is already in the DOM. */
  host.querySelector('#mapwrap').insertAdjacentHTML('afterbegin', svg);
}

/* The map key: each marker silhouette against the word for what it is. A legend
   names its symbols — that is the whole job — so the shape is the symbol and the
   word is the name, and neither stands in for the other. */
const KEY_ITEMS = [
  ['cargo', '#63c06a', 'Cargo'],
  ['dive', '#7ab0e0', 'Wreck'],
  ['patrol', '#e0a03a', 'Fight'],
  ['charter', '#efe3ae', 'Charter']
];

function keySwatch(type, col) {
  const inner = type === 'charter'
    ? `<path d="${starPath(12, 12, 9)}" fill="${col}" stroke="#8a793e" stroke-width="1.2"/>`
    : nodeShape({ type, x: 12, y: 12 }, col, 1.6);
  return `<svg class="keysh" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${inner}</svg>`;
}

function shapeKey() {
  return KEY_ITEMS.map(([type, col, word]) =>
    `<span class="key">${keySwatch(type, col)}<span>${word}</span></span>`).join('');
}

function buildLegend(rs) {
  let li = 0;
  return Object.keys(REGIONS).map(rk => {
    li++;
    if (!S.unlocked.includes(rk))
      return `<div class="leg lock" style="--i:${li}"><div class="legrow"><i style="background:#173238"></i>`
        + `${iconHTML('lock', 17)}<span>${esc(REGIONS[rk].n)}</span></div></div>`;

    const mine = rs.filter(r => r.region === rk);
    const maxd = mine.length ? Math.max(...mine.map(effDanger)) : 0;
    const b = BOSSES[rk], need = b ? b.noto : 1;
    const cur = Math.min(S.noto[rk] || 0, need), done = S.bossBeaten[rk];
    const chn = CHARTERS.filter(c => PORTS[c.loc].region === rk && charterAvailable(c)).length;
    const openN = mine.filter(r => canVoyage(r) && voyageOpen(r)).length;

    /* Counts of things worth a tap, as glyph + number. */
    const meta = [
      patrolActive(rk) ? `<span title="Patrol in force">${iconHTML('flag', 18)}${fmtDur(patrolLeft(rk) / 1000)}</span>` : '',
      chn ? `<span style="color:#efe3ae" title="Charters on offer">${iconHTML('star', 18)}${chn}</span>` : '',
      openN ? `<span style="color:#63c06a" title="Ready to sail">${iconHTML('anchor', 18)}${openN}</span>` : ''
    ].filter(Boolean).join('');

    /* The admiral bar is a have/need on notoriety: fill it and she sails out. */
    const noto = done
      ? `<div class="legdone" title="${esc(b.n)} defeated">${iconHTML('flag', 17)}${esc(b.n)}</div>`
      : `<div class="notobar ${cur >= need ? 'full' : ''}"><i style="width:${cur / need * 100}%"></i></div>
         <div class="legdone ${cur >= need ? 'ready' : ''}" title="${cur >= need ? 'Admiral ready — attack' : 'Notoriety'}">
           ${iconHTML('noto', 17)}${cur}<i>/</i>${need}</div>`;

    return `<div class="leg" style="--i:${li}">
      <div class="legrow"><i style="background:${DHEX[maxd]}"></i><span>${esc(REGIONS[rk].n)}</span></div>
      ${meta ? `<div class="legmeta">${meta}</div>` : ''}
      ${noto}
    </div>`;
  }).join('');
}
