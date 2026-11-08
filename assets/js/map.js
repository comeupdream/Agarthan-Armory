/* =============================================================================
 * map.js — THE ICE WALL MAP. The site's navigation, drawn as the classic
 * north-polar azimuthal equidistant projection (the "flat earth" / Gleason
 * layout): the pole in the centre, Antarctica stretched into the ring of ice
 * around the rim. Coastlines come from map-data.js (tools/build-map.mjs).
 *
 * Projection — must match tools/build-map.mjs:
 *   rho = (90 - lat) / 180 * R ;  x = C + rho·sin(lon) ;  y = C + rho·cos(lon)
 *
 * Outposts are real places from polar / UFO lore, each standing in for a
 * department. The store itself plots from config.geo (or sits beyond the wall).
 * ===========================================================================*/
(function () {
  'use strict';
  const AA = window.AA;
  const M = window.AA_MAP;
  const host = document.getElementById('iceMap');
  if (!AA || !M || !host) return;
  const { C, R } = M;
  const NS = 'http://www.w3.org/2000/svg';
  const rad = Math.PI / 180;
  const proj = (lat, lon) => { const rho = (90 - lat) / 180 * R; return [C + rho * Math.sin(lon * rad), C + rho * Math.cos(lon * rad)]; };
  const unproj = (x, y) => { const dx = x - C, dy = y - C; const rho = Math.hypot(dx, dy); return { lat: 90 - rho / R * 180, lon: Math.atan2(dx, dy) / rad, rho }; };
  const dms = (v, pos, neg) => { const a = Math.abs(v); const d = Math.floor(a); const m = Math.round((a - d) * 60); return `${d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′${v >= 0 ? pos : neg}`; };
  const fmtLL = (lat, lon) => `${dms(lat, 'N', 'S')} · ${dms(lon, 'E', 'W')}`;
  const cfg = AA.cfg;

  /* --- outposts --- */
  const NODES = [
    { id: 'agartha', name: 'Agartha', lat: 90, lon: 0, dx: 0, dy: 38, anchor: 'middle', kicker: 'The inner vault',
      dept: 'Entire Armory', href: 'armory.html',
      text: 'The way down. Every firearm, round and relic we hold, in one place.',
      lore: 'Admiral Byrd wrote of a warm green land past the pole. Mercator’s 1595 chart put a black rock there, ringed by four inflowing rivers. We keep the lights on down there.' },
    { id: 'shasta', name: 'Mt. Shasta', lat: 41.409, lon: -122.195, dx: -16, dy: -10, anchor: 'end', kicker: 'Dept 01',
      dept: 'Sidearms', href: 'armory.html?dept=sidearms',
      text: 'Pistols and revolvers for carry, duty, the range and the long walk home.',
      lore: 'Legend puts a city of the old ones, Telos, beneath the mountain.' },
    { id: 'giza', name: 'Giza', lat: 29.979, lon: 31.134, dx: 16, dy: 6, anchor: 'start', kicker: 'Dept 02',
      dept: 'Longarms', href: 'armory.html?dept=longarms',
      text: 'Rifles and carbines: modern sporting, bolt action, lever and rimfire.',
      lore: 'Ancient engineering, true to the millimetre. Same standard for our rifles.' },
    { id: 'tunguska', name: 'Tunguska', lat: 60.886, lon: 101.894, dx: 16, dy: 6, anchor: 'start', kicker: 'Dept 03',
      dept: 'Shotguns', href: 'armory.html?dept=shotguns',
      text: 'Pump and semi-auto shotguns for home defense, field and clays.',
      lore: '1908: 800 square miles of forest flattened by something from the sky. Our shotguns are better aimed.' },
    { id: 'bermuda', name: 'Bermuda Triangle', lat: 25.0, lon: -71.0, dx: -16, dy: -6, anchor: 'end', kicker: 'Dept 04',
      dept: 'Ammunition', href: 'armory.html?dept=ammo',
      text: 'Range, defense and hunting loads, by the box or by the case.',
      lore: 'Ships vanish here. So does ammo on sale day.' },
    { id: 'roswell', name: 'Roswell', lat: 33.394, lon: -104.523, dx: -16, dy: 10, anchor: 'end', kicker: 'Dept 05',
      dept: 'Optics & Tech', href: 'armory.html?dept=optics',
      text: 'Red dots, scopes, thermal and night vision, lights and lasers.',
      lore: 'July 1947: something came down in the desert. Our optics are only slightly less advanced.' },
    { id: 'nazca', name: 'Nazca', lat: -14.739, lon: -75.13, dx: -16, dy: 26, anchor: 'end', kicker: 'Dept 06',
      dept: 'Expedition Gear', href: 'armory.html?dept=gear',
      text: 'Magazines, cases, safes, cleaning and everything else you pack.',
      lore: 'Lines drawn for something watching from above. Pack accordingly.' },
    { id: 'shambhala', name: 'Shambhala', lat: 31.067, lon: 81.312, dx: 16, dy: 6, anchor: 'start', kicker: 'Services',
      dept: 'Services & special orders', href: 'transfers.html#services',
      text: 'Special orders, consignment, and the work done right.',
      lore: 'The hidden kingdom of the high Himalaya, where things are made the old way.' },
    { id: 'highjump', name: 'The Gate · Highjump', lat: -78.5, lon: -163.9, dx: 0, dy: 58, anchor: 'middle', kicker: 'FFL transfers',
      dept: 'The Gate in the Wall', href: 'transfers.html',
      text: 'Bought a gun online? Ship it to our FFL. We log it, run the background check and hand it over.',
      lore: '1946–47: the US Navy sent 4,700 men, 13 ships and 33 aircraft to Antarctica, then brought them home months early. Your transfer is a lot less paperwork.' },
  ];
  const geo = cfg.geo && isFinite(cfg.geo.lat) && isFinite(cfg.geo.lon) ? cfg.geo : null;
  const place = [cfg.address && cfg.address.city, cfg.address && cfg.address.state].filter(Boolean).join(', ');
  NODES.push({
    id: 'store', name: cfg.name || 'Agarthan Armory', store: true,
    lat: geo ? geo.lat : null, lon: geo ? geo.lon : null, beyond: !geo,
    dx: 18, dy: 6, anchor: 'start', kicker: geo ? 'Our outpost' : 'Our outpost · beyond the wall',
    dept: place || 'Visit the store', href: 'index.html#visit',
    text: 'Walk in, look it over, talk it through. Transfers, pickups and special orders happen here.',
    lore: 'Coordinates shared with trusted travelers only. (Just kidding — see Visit.)',
  });

  /* --- build the svg --- */
  const PAD = 120;
  const VB0 = [-PAD, -PAD, 1000 + PAD * 2, 1000 + PAD * 2];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', VB0.join(' '));
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Interactive map: north-polar projection with the Antarctic ice wall around the rim. Outposts link to store departments.');
  const ring = (r) => `M${C - r} ${C}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

  // graticule
  let grat = '';
  for (let lat = 75; lat >= -60; lat -= 15) {
    const r = (90 - lat) / 180 * R;
    grat += `<circle cx="${C}" cy="${C}" r="${r.toFixed(1)}" class="${lat === 0 ? 'eq' : ''}"/>`;
  }
  for (let lon = 0; lon < 360; lon += 15) {
    const [x, y] = proj(-90, lon);
    grat += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }
  const special = [[66.56, 'Arctic circle'], [23.44, 'Tropic of Cancer'], [-23.44, 'Tropic of Capricorn']]
    .map(([lat]) => `<circle cx="${C}" cy="${C}" r="${((90 - lat) / 180 * R).toFixed(1)}"/>`).join('');

  // bezel ticks + longitude labels
  let ticks = '', lonLabels = '';
  for (let lon = 0; lon < 360; lon += 5) {
    const major = lon % 15 === 0;
    const a = lon * rad, r1 = R + 6, r2 = R + (major ? 18 : 12);
    ticks += `<line x1="${(C + r1 * Math.sin(a)).toFixed(1)}" y1="${(C + r1 * Math.cos(a)).toFixed(1)}" x2="${(C + r2 * Math.sin(a)).toFixed(1)}" y2="${(C + r2 * Math.cos(a)).toFixed(1)}" class="${major ? 'mj' : ''}"/>`;
    if (lon % 30 === 0) {
      const v = lon > 180 ? lon - 360 : lon;
      const lab = v === 0 ? '0°' : v === 180 ? '180°' : `${Math.abs(v)}°${v > 0 ? 'E' : 'W'}`;
      const rl = R + 40;
      lonLabels += `<text x="${(C + rl * Math.sin(a)).toFixed(1)}" y="${(C + rl * Math.cos(a) + 4).toFixed(1)}">${lab}</text>`;
    }
  }

  // ice texture: short irregular crevasse strokes across the ring band
  let crev = '';
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) {
    const a = rnd() * 360 * rad, r0 = R - 4 - rnd() * 46, l = 3 + rnd() * 9;
    crev += `M${(C + r0 * Math.sin(a)).toFixed(1)} ${(C + r0 * Math.cos(a)).toFixed(1)}l${(l * Math.sin(a)).toFixed(1)} ${(l * Math.cos(a)).toFixed(1)}`;
  }

  // lands beyond the wall: faint, dashed, unnamed — one per corner
  const blob = (cx, cy, r, s) => {
    let d = ''; seed = s;
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rr = r * (0.72 + 0.28 * Math.sin(a * 3 + s) + rnd() * 0.18);
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }
    return d + 'Z';
  };
  const beyond = [[-40, -30, 105, 3], [1045, -40, 95, 9], [-40, 1050, 90, 17], [1060, 1060, 80, 23]];
  const beyondLands = beyond.map(([x, y, r, s]) => `<path d="${blob(x, y, r, s)}"/>`).join('');

  const ringText = `THE ICE WALL · ${AA.runes('the ice wall')} · ANTARCTICA · TERRA AUSTRALIS · ${AA.runes('beyond lies agartha')} · EDGE OF THE KNOWN WORLD · `;
  svg.innerHTML = `
  <defs>
    <radialGradient id="mOcean" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#11345a"/><stop offset=".55" stop-color="#0a1f38"/><stop offset="1" stop-color="#061223"/>
    </radialGradient>
    <radialGradient id="mIce" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C}" r="${R}">
      <stop offset=".82" stop-color="#e8fbff"/><stop offset=".9" stop-color="#bfe8f8"/><stop offset="1" stop-color="#7cc4e6"/>
    </radialGradient>
    <linearGradient id="mSweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5de4ff" stop-opacity="0"/><stop offset="1" stop-color="#5de4ff" stop-opacity=".22"/>
    </linearGradient>
    <radialGradient id="mPortal"><stop offset="0" stop-color="#eaffff"/><stop offset=".35" stop-color="#5dffb1" stop-opacity=".55"/><stop offset="1" stop-color="#5dffb1" stop-opacity="0"/></radialGradient>
    <clipPath id="mDisc"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
    <path id="mRingPath" d="M${C} ${C + R - 18}a${R - 18} ${R - 18} 0 1 1 .01 0"/>
    <pattern id="mGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(93,228,255,.07)" stroke-width="1"/></pattern>
  </defs>
  <rect x="${VB0[0]}" y="${VB0[1]}" width="${VB0[2]}" height="${VB0[3]}" fill="url(#mGrid)"/>
  <g class="m-beyond" fill="rgba(169,139,255,.05)" stroke="rgba(169,139,255,.45)" stroke-width="1" stroke-dasharray="4 5">${beyondLands}</g>
  <g class="m-beyond-label" font-family="Share Tech Mono, monospace" font-size="13" letter-spacing="3" fill="rgba(190,170,255,.7)" text-anchor="middle">
    <text x="-40" y="-26">TERRA INCOGNITA</text>
    <text x="-40" y="1054">UNCHARTED</text>
  </g>
  <circle cx="${C}" cy="${C}" r="${R + 28}" fill="none" stroke="rgba(140,215,255,.3)"/>
  <circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="rgba(140,215,255,.3)"/>
  <g stroke="rgba(140,215,255,.45)" class="m-ticks">${ticks}</g>
  <g font-family="Share Tech Mono, monospace" font-size="13" letter-spacing="1.5" fill="rgba(160,205,230,.8)" text-anchor="middle">${lonLabels}</g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#mOcean)"/>
  <g clip-path="url(#mDisc)">
    <g fill="none" stroke="rgba(93,228,255,.12)" stroke-width="1" class="m-grat">${grat}</g>
    <g fill="none" stroke="rgba(93,255,177,.22)" stroke-width="1" stroke-dasharray="3 6">${special}</g>
    <path d="${M.land}" fill="rgba(93,228,255,.11)" stroke="rgba(120,225,255,.6)" stroke-width=".8" stroke-linejoin="round"/>
    <path d="${ring(R)}${M.ice}" fill="url(#mIce)" fill-rule="evenodd" stroke="#ffffff" stroke-opacity=".8" stroke-width=".8"/>
    <path d="${M.iceBits}" fill="#d8f4ff" stroke="#ffffff" stroke-width=".6"/>
    <path d="${crev}" stroke="rgba(30,90,130,.35)" stroke-width="1" fill="none"/>
    <path class="m-sweep" d="M${C} ${C}L${C + R} ${C}A${R} ${R} 0 0 0 ${(C + R * Math.cos(-32 * rad)).toFixed(1)} ${(C + R * Math.sin(-32 * rad)).toFixed(1)}Z" fill="url(#mSweep)"/>
  </g>
  <text font-family="Cinzel, 'Noto Sans Runic', serif" font-weight="800" font-size="17" letter-spacing="6" fill="#0b2a45"><textPath href="#mRingPath">${ringText.repeat(2)}</textPath></text>
  <g class="m-hyper">
    <circle cx="${C}" cy="${C}" r="40" fill="url(#mPortal)" opacity=".55"/>
    <g class="m-portal" fill="none" stroke="#5dffb1" stroke-width="1.2"><circle cx="${C}" cy="${C}" r="16"/><circle cx="${C}" cy="${C}" r="16"/><circle cx="${C}" cy="${C}" r="16"/></g>
    <text x="${C}" y="${C - 34}" text-anchor="middle" font-family="Cinzel, serif" font-weight="800" font-size="21" letter-spacing="6" fill="#e8f7ff" paint-order="stroke" stroke="#03101c" stroke-width="5">HYPERBOREA</text>
  </g>
  <g class="m-equator-label" font-family="Share Tech Mono, monospace" font-size="11" letter-spacing="3" fill="rgba(93,255,177,.7)">
    <text x="${C + 6}" y="${(C - (90 / 180) * R - 6).toFixed(1)}">EQUATOR</text>
    <text x="${C + 6}" y="${(C - ((90 - 66.56) / 180) * R - 6).toFixed(1)}">ARCTIC CIRCLE</text>
  </g>
  <g class="m-nodes"></g>`;
  host.prepend(svg);

  /* --- nodes --- */
  const nodesG = svg.querySelector('.m-nodes');
  const pos = (n) => {
    if (n.beyond) return [1000 + 30, 1000 - 60];      // bottom-right, outside the wall
    return proj(n.lat, n.lon);
  };
  NODES.forEach((n) => {
    const [x, y] = pos(n);
    n.x = x; n.y = y;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'm-node' + (n.store ? ' store' : ''));
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'link');
    g.setAttribute('aria-label', `${n.name}: ${n.dept}`);
    g.dataset.id = n.id;
    g.innerHTML = `<circle class="halo" r="18"/><circle class="ring" r="8"/><circle class="dot" r="4"/>
      <text x="${n.dx}" y="${n.dy}" text-anchor="${n.anchor}">${AA.esc(n.name)}</text>`;
    nodesG.appendChild(g);
  });

  /* --- panel --- */
  const panel = document.getElementById('mapPanel');
  const list = document.getElementById('mapList');
  let active = null;
  function show(n) {
    active = n;
    nodesG.querySelectorAll('.m-node').forEach((g) => g.classList.toggle('active', g.dataset.id === n.id));
    if (list) list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === n.id));
    if (!panel) return;
    const coords = n.beyond ? 'COORDINATES: BEYOND THE WALL' : fmtLL(n.lat, n.lon);
    panel.querySelector('.mp-kicker').textContent = n.kicker;
    panel.querySelector('h3').textContent = n.store ? n.name : n.dept;
    panel.querySelector('.mp-coords').textContent = `${n.store ? '' : n.name.toUpperCase() + ' · '}${coords}`;
    panel.querySelector('.mp-text').textContent = n.text;
    panel.querySelector('.mp-lore').textContent = n.lore;
    const a = panel.querySelector('.mp-go');
    a.href = n.href; a.textContent = n.store ? 'Visit the store' : `Enter ${n.dept}`;
  }
  if (list) {
    list.innerHTML = NODES.map((n) => `<li><button type="button" data-id="${n.id}" aria-pressed="false"><span>${AA.esc(n.store ? 'Our outpost' : n.dept)}</span><span>${AA.esc(n.store ? 'Visit' : n.name)}</span></button></li>`).join('');
    list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { const n = NODES.find((x) => x.id === b.dataset.id); show(n); focusOn(n); } });
  }
  const noHover = window.matchMedia && matchMedia('(hover: none)').matches;
  const byEl = (el) => { const g = el && el.closest && el.closest('.m-node'); return g && NODES.find((n) => n.id === g.dataset.id); };
  nodesG.addEventListener('mouseover', (e) => { const n = byEl(e.target); if (n) show(n); });
  nodesG.addEventListener('focusin', (e) => { const n = byEl(e.target); if (n) show(n); });
  nodesG.addEventListener('click', (e) => {
    const n = byEl(e.target); if (!n) return;
    if (noHover && active !== n) { show(n); return; }   // touch: first tap previews, second goes
    location.href = n.href;
  });
  nodesG.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const n = byEl(e.target); if (n) { e.preventDefault(); location.href = n.href; } } });
  show(NODES[0]);

  /* --- live coordinate readout --- */
  const readout = document.getElementById('mapReadout');
  const toSvg = (ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : null; };
  svg.addEventListener('pointermove', (ev) => {
    if (!readout) return;
    const p = toSvg(ev); if (!p) return;
    const u = unproj(p.x, p.y);
    if (u.rho > R + 30) { readout.innerHTML = 'SIGNAL: <b>BEYOND THE WALL</b> · NO KNOWN COORDINATES'; return; }
    if (u.rho > R * 0.86) { readout.innerHTML = `${fmtLL(Math.max(-90, u.lat), u.lon)} · <b>AT THE ICE WALL</b>`; return; }
    const km = Math.max(0, (u.lat + 66.5) * 111.2);
    readout.innerHTML = `${fmtLL(u.lat, u.lon)} · TO THE WALL <b>${Math.round(km).toLocaleString()} KM</b>`;
  });
  svg.addEventListener('pointerleave', () => { if (readout) readout.innerHTML = 'MOVE ACROSS THE MAP · <b>SIGNAL LIVE</b>'; });

  /* --- zoom + pan --- */
  let vb = VB0.slice(), anim = 0;
  const setVB = (v) => { vb = v; svg.setAttribute('viewBox', v.map((n) => n.toFixed(1)).join(' ')); };
  const tween = (to, ms = 520) => {
    cancelAnimationFrame(anim);
    if (AA.reduced) { setVB(to); return; }
    const from = vb.slice(), t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); setVB(from.map((f, i) => f + (to[i] - f) * e)); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  const zoomTo = (cx, cy, size) => tween([cx - size / 2, cy - size / 2, size, size]);
  function focusOn(n) { zoomTo(n.x, n.y, Math.min(vb[2], 640)); }
  const zin = document.getElementById('mapZoomIn'), zout = document.getElementById('mapZoomOut'), zreset = document.getElementById('mapZoomReset');
  zin && zin.addEventListener('click', () => { const s = Math.max(260, vb[2] / 1.6); const cx = active ? active.x : vb[0] + vb[2] / 2, cy = active ? active.y : vb[1] + vb[3] / 2; zoomTo(cx, cy, s); });
  zout && zout.addEventListener('click', () => { const s = Math.min(VB0[2], vb[2] * 1.6); zoomTo(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, s); });
  zreset && zreset.addEventListener('click', () => tween(VB0.slice()));
  let drag = null;
  svg.addEventListener('pointerdown', (e) => { if (vb[2] >= VB0[2] - 1 || e.target.closest('.m-node')) return; drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); svg.style.cursor = 'grabbing'; });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = vb[2] / svg.getBoundingClientRect().width;
    setVB([drag.vb[0] - (e.clientX - drag.x) * k, drag.vb[1] - (e.clientY - drag.y) * k, vb[2], vb[3]]);
  });
  const end = () => { drag = null; svg.style.cursor = ''; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
})();
