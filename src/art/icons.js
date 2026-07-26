/* Inline SVG icons, used as data: URIs.

   Drop a real PNG at img/icon_<name>.png and it silently replaces the
   generated placeholder — same convention as the ship art. */

const ICON_COLOR = {
  reales: '#efe3ae', cargo: '#c8a97a', parts: '#9fb8bd', barrels: '#d9883a', gems: '#8fd8e8',
  sea: '#7ab0e0', plate: '#9fb8bd', guns: '#d9883a', rig: '#cfe3e4', hold: '#c8a97a',
  relic: '#d9c98a', flag: '#efe3ae', star: '#efe3ae', anchor: '#63c06a',
  wheel: '#d9c98a', map: '#7ab0e0', port: '#c8a97a', scales: '#c8a97a'
};

const ICONS = {
  reales: c => `<circle cx="12" cy="12" r="8.5" fill="${c}"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#3a2f14" stroke-width="1.5"/><path d="M9.4 12h5.2" stroke="#3a2f14" stroke-width="1.5"/>`,
  cargo: c => `<rect x="3.5" y="6.5" width="17" height="12" rx="1.5" fill="${c}"/><path d="M3.5 10.6h17M3.5 14.6h17M8.6 6.5v12M15.4 6.5v12" stroke="#2a1f12" stroke-width="1.2"/>`,
  parts: c => `<path d="M12 3.2l1.9 1.2 2.2-.5.9 2 2 .9-.5 2.2L19.7 12l-1.2 2 .5 2.2-2 .9-.9 2-2.2-.5L12 20.8 10 19.6l-2.2.5-.9-2-2-.9.5-2.2L4.3 12l1.2-2-.5-2.2 2-.9.9-2 2.2.5z" fill="${c}"/><circle cx="12" cy="12" r="3.2" fill="#05161a"/>`,
  barrels: c => `<path d="M7 4.5h10c1.3 2.3 1.8 4.6 1.8 7.5s-.5 5.2-1.8 7.5H7c-1.3-2.3-1.8-4.6-1.8-7.5S5.7 6.8 7 4.5z" fill="${c}"/><path d="M5.4 9.2h13.2M5.4 14.8h13.2" stroke="#2a1408" stroke-width="1.5"/>`,
  gems: c => `<path d="M12 3l7.2 5.6L12 21 4.8 8.6z" fill="${c}"/><path d="M4.8 8.6h14.4M12 3v18" stroke="#04161c" stroke-width="1.1" opacity=".55"/>`,
  sea: c => `<path d="M12.6 4l6 10.2h-6z" fill="${c}"/><path d="M11.2 4v10.2" stroke="${c}" stroke-width="1.7"/><path d="M10.4 6.5l-4.6 7.7h4.6z" fill="${c}" opacity=".7"/><path d="M3.4 16.4h17.2l-2.6 4.2H6z" fill="${c}" opacity=".8"/>`,
  plate: c => `<path d="M12 3l7.5 2.6v5.7c0 4.4-3 7.9-7.5 9.4-4.5-1.5-7.5-5-7.5-9.4V5.6z" fill="${c}"/><path d="M12 6.6v11" stroke="#05161a" stroke-width="1.3" opacity=".5"/>`,
  guns: c => `<rect x="3.5" y="8.6" width="13" height="4.6" rx="1" fill="${c}"/><circle cx="18.4" cy="10.9" r="2.3" fill="${c}"/><circle cx="8.4" cy="17.2" r="3.1" fill="none" stroke="${c}" stroke-width="1.8"/>`,
  rig: c => `<path d="M11.4 2.6v18.8" stroke="${c}" stroke-width="1.7"/><path d="M12.7 4.4l5.9 6h-5.9zM12.7 12l5.9 6.4h-5.9z" fill="${c}"/><path d="M10.1 5.2l-4.7 5.2h4.7zM10.1 12.6l-4.7 5.8h4.7z" fill="${c}" opacity=".68"/>`,
  hold: c => `<rect x="3.5" y="6.5" width="17" height="12" rx="1.5" fill="${c}"/><path d="M3.5 10.6h17M3.5 14.6h17M8.6 6.5v12M15.4 6.5v12" stroke="#2a1f12" stroke-width="1.2"/>`,
  relic: c => `<path d="M8.2 3h7.6v2h-2.1c2.9 1.5 4.6 4.1 4.6 7.1 0 4.4-3.1 7.9-6.3 7.9s-6.3-3.5-6.3-7.9c0-3 1.7-5.6 4.6-7.1H8.2z" fill="${c}"/><path d="M9 20.6h6" stroke="${c}" stroke-width="1.8"/>`,
  flag: c => `<path d="M6.2 2.4v19.2" stroke="${c}" stroke-width="1.9"/><path d="M7.6 4h11l-3 4 3 4h-11z" fill="${c}"/>`,
  star: c => `<path d="M12 2.4l2.7 6.4 6.9.5-5.3 4.5 1.7 6.8L12 16.9 6 20.6l1.7-6.8-5.3-4.5 6.9-.5z" fill="${c}"/>`,
  anchor: c => `<circle cx="12" cy="4.4" r="2.2" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M12 6.6v14M7 10.2h10" stroke="${c}" stroke-width="1.8"/><path d="M4.4 14.2c0 4 3.6 6.3 7.6 6.3s7.6-2.3 7.6-6.3" fill="none" stroke="${c}" stroke-width="1.8"/>`,
  /* nav + menu glyphs */
  wheel: c => `<circle cx="12" cy="12" r="4.2" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="${c}"/><path d="M12 2.2v4.4M12 17.4v4.4M2.2 12h4.4M17.4 12h4.4M5.1 5.1l3.1 3.1M15.8 15.8l3.1 3.1M18.9 5.1l-3.1 3.1M8.2 15.8l-3.1 3.1" stroke="${c}" stroke-width="1.6"/>`,
  map: c => `<path d="M3 6.2l6-2.4 6 2.4 6-2.4v14l-6 2.4-6-2.4-6 2.4z" fill="none" stroke="${c}" stroke-width="1.7"/><path d="M9 3.8v14M15 6.2v14" stroke="${c}" stroke-width="1.4" opacity=".75"/>`,
  port: c => `<path d="M3.4 20.4h17.2" stroke="${c}" stroke-width="1.8"/><path d="M6.6 20.4V9.2l5.4-5 5.4 5v11.2" fill="none" stroke="${c}" stroke-width="1.7"/><rect x="10.2" y="13.4" width="3.6" height="7" fill="${c}"/>`,
  scales: c => `<path d="M12 3.4v16.2M7 20.6h10" stroke="${c}" stroke-width="1.7"/><path d="M4 8.2h16" stroke="${c}" stroke-width="1.6"/><path d="M4 8.2l-2.4 4.6h4.8zM20 8.2l-2.4 4.6h4.8z" fill="${c}" opacity=".85"/>`
};

const ICON_URL = {};

function svgIcon(name) {
  const c = ICON_COLOR[name] || '#cfe3e4';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="160" height="160">${(ICONS[name] || ICONS.reales)(c)}</svg>`;
}

export function iconHTML(name, size, cls) {
  const st = size ? `style="width:${size}px;height:${size}px"` : '';
  const src = ICON_URL[name] || ('data:image/svg+xml;utf8,' + encodeURIComponent(svgIcon(name)));
  return `<img class="ic ${cls || ''}" alt="" ${st} src="${src}">`;
}

/* Probe for player-supplied art; missing files just keep the placeholder. */
export function loadIconArt() {
  return Promise.all(Object.keys(ICONS).map(name => new Promise(res => {
    const im = new Image();
    im.onload = () => { ICON_URL[name] = 'img/icon_' + name + '.png'; res(); };
    im.onerror = () => res();
    im.src = 'img/icon_' + name + '.png';
  })));
}
