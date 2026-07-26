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
  patrolActive, patrolLeft, fmtDur
} from '../../core/selectors.js';
import { iconHTML } from '../../art/icons.js';

function starPath(x, y, r) {
  return `M${x},${y - r} L${x + r * 0.35},${y - r * 0.35} L${x + r},${y} L${x + r * 0.35},${y + r * 0.35} ` +
         `L${x},${y + r} L${x - r * 0.35},${y + r * 0.35} L${x - r},${y} L${x - r * 0.35},${y - r * 0.35} Z`;
}

/* Mission type reads from the marker's silhouette, not just its colour. */
function nodeShape(r, col, k) {
  const { x, y } = r, s = 5.5 * k;
  if (r.type === 'patrol')
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" transform="rotate(45 ${x} ${y})" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'raid' || r.type === 'blockade')
    return `<path d="M${x},${y - s * 1.35} L${x + s * 1.2},${y + s * 0.85} L${x - s * 1.2},${y + s * 0.85} Z" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
  if (r.type === 'salvage')
    return `<circle cx="${x}" cy="${y}" r="${s}" fill="none" stroke="${col}" stroke-width="${2.8 * k}"/>`;
  if (r.type === 'escort')
    return `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>`;
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
    <div class="legend">${buildLegend(rs)}</div>
    <div class="maphint">Green = open to trade · Blue = your ships at sea · Gold star = charter · Red star = admiral</div>
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

  /* Labels are centre-anchored on their node, so one near an edge would run off
     screen. Nudge the text (not the marker) far enough in to stay readable. */
  const labelX = (x, text, size) => {
    const half = text.length * size * 0.32;
    return +Math.min(Math.max(x, legW + 6 + half), CW - 6 - half).toFixed(1);
  };

  const hx = MX(HOME.x), hy = MY(HOME.y);
  let lines = '', nodes = '', bossNodes = '', voyLines = '';

  rs.forEach(r => {
    const d = effDanger(r), col = DHEX[d], isCh = r.type === 'charter', open = voyageOpen(r);
    const x = MX(r.x), y = MY(r.y);

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="${col}" stroke-width="${1.6 * NR}" opacity="0.7"/>`;
    if (active[r.id])
      voyLines += `<path class="voyline" d="M${hx},${hy} L${x},${y}" stroke="#7ab0e0" stroke-width="${2.4 * NR}" opacity="0.95"/>`;

    const isPort = r.id.startsWith('pt_') || isCh;
    const label = isPort ? (isCh ? PORTS[r.charterDef.loc].n : PORTS[r.id.slice(3)].n).toUpperCase() : '';

    nodes += `<g id="node_${r.id}" data-act="mission" data-id="${r.id}" class="mapnode">
      <circle cx="${x}" cy="${y}" r="${22 * NR}" fill="transparent"/>
      ${isCh
        ? `<path class="charterstar" d="${starPath(x, y, 10 * NR)}" fill="#efe3ae" stroke="#8a793e" stroke-width="1.4"/>`
        : `<circle class="nodeglow" cx="${x}" cy="${y}" r="${13 * NR}" fill="${col}"/>${nodeShape({ ...r, x, y }, col, NR)}`}
      ${open && !isCh ? `<circle cx="${x + 10 * NR}" cy="${y - 10 * NR}" r="${4.2 * NR}" fill="#63c06a" stroke="#04161c" stroke-width="1.3"/>` : ''}
      ${active[r.id] ? `<circle cx="${x - 10 * NR}" cy="${y - 10 * NR}" r="${4.2 * NR}" fill="#7ab0e0" stroke="#04161c" stroke-width="1.3"/>` : ''}
      ${isPort ? `<text x="${labelX(x, label, LBL)}" y="${y + 20 * NR + LBL}" text-anchor="middle" fill="${isCh ? '#efe3ae' : '#a8c4c6'}" font-size="${LBL}" font-family="Oswald" letter-spacing="1" style="paint-order:stroke" stroke="#04161c" stroke-width="3">${esc(label)}</text>` : ''}
    </g>`;
  });

  bossKeys.forEach(rk => {
    const b = BOSSES[rk];
    const x = MX(b.x), y = MY(b.y);

    if (S.bossBeaten[rk]) {
      /* A struck flag marks a beaten admiral. */
      bossNodes += `<g><circle cx="${x}" cy="${y}" r="${9 * NR}" fill="none" stroke="#d9c98a" stroke-width="1.8" opacity=".6"/>
        <path d="M${x - 3.5 * NR},${y - 5 * NR} v${10 * NR} M${x - 3.5 * NR},${y - 5 * NR} h${7.5 * NR} l${-2.4 * NR},${2.6 * NR} l${2.4 * NR},${2.6 * NR} h${-7.5 * NR}"
          fill="#d9c98a" stroke="#d9c98a" stroke-width="${1.2 * NR}" stroke-linejoin="round"/></g>`;
      return;
    }

    lines += `<path class="routeline" d="M${hx},${hy} L${x},${y}" stroke="#d94a3a" stroke-width="${2 * NR}" opacity="0.9"/>`;
    bossNodes += `<g id="node_${b.id}" data-act="mission" data-id="${b.id}" class="mapnode">
      <circle cx="${x}" cy="${y}" r="${26 * NR}" fill="transparent"/>
      <circle class="bossglow" cx="${x}" cy="${y}" r="${18 * NR}" fill="#d94a3a"/>
      <path d="${starPath(x, y, 10 * NR)}" fill="#f0b0a6" stroke="#5e1a1a" stroke-width="1.4"/>
      <text x="${labelX(x, b.n.toUpperCase(), LBL)}" y="${y + 24 * NR + LBL}" text-anchor="middle" fill="#f0b0a6" font-size="${LBL}" font-family="Oswald" letter-spacing="1.2" style="paint-order:stroke" stroke="#0a0507" stroke-width="3">${esc(b.n.toUpperCase())}</text></g>`;
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
        <circle class="nodeglow" cx="${hx}" cy="${hy}" r="${19 * NR}" fill="#d9c98a"/>
        <circle cx="${hx}" cy="${hy}" r="${7 * NR}" fill="#d9c98a" stroke="#000" stroke-width="1.4"/>
        <text x="${labelX(hx, 'HOME PORT', HLBL)}" y="${hy + 24 * NR + HLBL}" text-anchor="middle" fill="#d9c98a" font-size="${HLBL}" font-family="Oswald" letter-spacing="2" style="paint-order:stroke" stroke="#04161c" stroke-width="3">HOME PORT</text>
      </g>
      ${nodes}${bossNodes}
    </svg>`;

  /* Behind the legend that is already in the DOM. */
  host.querySelector('#mapwrap').insertAdjacentHTML('afterbegin', svg);
}

function buildLegend(rs) {
  let li = 0;
  return Object.keys(REGIONS).map(rk => {
    li++;
    if (!S.unlocked.includes(rk))
      return `<div class="leg lock" style="--i:${li}"><div class="legrow"><i style="background:#173238"></i><span>LOCKED — ${REGIONS[rk].n}</span></div></div>`;

    const mine = rs.filter(r => r.region === rk);
    const maxd = mine.length ? Math.max(...mine.map(effDanger)) : 0;
    const b = BOSSES[rk], need = b ? b.noto : 1;
    const cur = Math.min(S.noto[rk] || 0, need), done = S.bossBeaten[rk];
    const chn = CHARTERS.filter(c => PORTS[c.loc].region === rk && charterAvailable(c)).length;
    const openN = mine.filter(voyageOpen).length;

    const meta = [
      patrolActive(rk) ? `<span title="Patrol in force">${iconHTML('flag', 18)}${fmtDur(patrolLeft(rk) / 1000)}</span>` : '',
      chn ? `<span style="color:#efe3ae">${iconHTML('star', 18)}${chn}</span>` : '',
      openN ? `<span style="color:#63c06a">${iconHTML('anchor', 18)}${openN}</span>` : ''
    ].filter(Boolean).join('');

    return `<div class="leg" style="--i:${li}">
      <div class="legrow"><i style="background:${DHEX[maxd]}"></i><span>${REGIONS[rk].n}</span></div>
      ${meta ? `<div class="legmeta">${meta}</div>` : ''}
      ${done
        ? `<div class="legdone">${esc(b.n)} DEFEATED</div>`
        : `<div class="notobar ${cur >= need ? 'full' : ''}"><i style="width:${cur / need * 100}%"></i></div>
           <div class="legdone" style="color:${cur >= need ? '#f0b0a6' : 'var(--dim)'}">${cur >= need ? 'ADMIRAL READY — ATTACK' : 'NOTORIETY ' + cur + '/' + need}</div>`}
    </div>`;
  }).join('');
}
