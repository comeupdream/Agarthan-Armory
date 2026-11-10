/*
 * THE LIVING MONEY — every realm's own art, then the Antarctica money comes alive.
 *
 * The real Realm button, pinned under the header, is worked by the saucer pointer down
 * the home page, and each click repaints the site on a scan line through its own code:
 * POLAR NIGHT shows the owner's banner as delivered; INNER EARTH turns it amber and
 * crimson and opens the way down (the Naica crystal cave and Symmes Hole appear);
 * BLACK & WHITE turns them silver; VRIL closes the way down and greens the Tiny Cans
 * poster; AGARTHAN CRYSTAL golds and violets it, and the camera settles on the gate in
 * the ice wall, where the $20 lies violet behind the transfers.
 *
 * The pointer grows into the mothership and beams down the $2 note, folded like a book,
 * which opens beside the $20: the ice-wall money, the 20 and the 2. Then it comes alive.
 * The $2's two faces are the wings of a butterfly that takes off round the $20 trailing
 * tracers; the $20 breathes, ripples like liquid, turns over to its back (Worsley's
 * Endurance route) and back, while echoes of it bloom outwards and sacred geometry turns
 * behind. PEAK: a swarm, a money mandala and a tunnel of money. COME DOWN: the swarm folds
 * back into one butterfly, which settles above the $20. CALM: the name walks the scripts
 * over the money, in Crystal, and the dark.
 *
 * No space: the sky behind the page is aurora only, no stars and no nebula.
 */

// the realm clicks, in film seconds: [t, realm, wipe kind (1 scan line, 2 glitch)]
export const SWITCHES = [[5.2, 'inner-earth', 1], [13.9, 'mono', 2], [18.1, 'vril', 1], [22.7, 'crystal', 2]];
// the calm's changes of script: [t, font] (the plates' order below)
export const OUTRO = [[42.0, 'future'], [43.6, 'runic'], [44.9, 'oldworld'], [45.4, 'future']];
const FPS = 30;

function act(t, S) {
  const { seg, ease, at, lerp } = S;
  const W = innerWidth, H = innerHeight, NAV = 68;
  // (the act runs inside the page, so it carries its own copy of SWITCHES)
  const SW = [[5.2, 'inner-earth'], [13.9, 'mono'], [18.1, 'vril'], [22.7, 'crystal']];
  const LABEL = {
    polar: ['01', 'Polar Night', 'the owner’s art, as delivered'],
    'inner-earth': ['02', 'Inner Earth', 'amber and crimson · the way down opens'],
    mono: ['03', 'Black & White', 'silver · Symmes Hole glows'],
    vril: ['04', 'Vril', 'lime and green · the way down closes'],
    crystal: ['05', 'Agarthan Crystal', 'gold and violet · the ice-wall money'],
  };
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const sm = (x) => x * x * (3 - 2 * x);

  /* ---------- once: the Realm button pinned under the header, its panel just the realms; every realm's art preloaded ---------- */
  at('setup', 0, () => {
    const st = document.createElement('style');
    st.textContent = `.prefs{position:fixed!important;top:${NAV + 14}px;right:0;height:auto;padding:0 40px 0 0;background:none!important;z-index:75;transform:scale(1.4);transform-origin:100% 0}
      .prefs-btn{height:34px;padding:0 16px;font-size:12px;background:rgba(var(--accent-rgb),.16);backdrop-filter:blur(6px)}
      .prefs-panel{top:44px!important}
      .prefs-panel fieldset:not(:first-of-type),.prefs-note{display:none!important}
      .gate-money::after{opacity:var(--wash,1)}`;
    document.head.appendChild(st);
    const art = ['manifesto-1280', 'tiny-cans-640', 'antarctica-20-front', 'antarctica-20-both', 'antarctica-dollars-750'];
    for (const r of ['inner-earth', 'mono', 'vril', 'crystal']) for (const f of art) { const i = new Image(); i.src = `assets/img/feature/realm/${r}/${f}.webp`; }
    for (const r of ['inner-earth', 'mono']) for (const f of ['naica-1600', 'symmes-hole-980']) { const i = new Image(); i.src = `assets/img/feature/realm/${r}/${f}.webp`; }
  });

  /* ---------- the scroll: from piece to piece, aimed at where each piece is in this realm's layout ---------- */
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? { top: r.top + scrollY, h: r.height } : null; };
  const aim = (sel) => { const b = box(sel); return b ? Math.max(0, b.top - NAV - (H - NAV - b.h) / 2) : scrollY; };
  const leg = (a, b, t0, t1) => lerp(a, b, ease.inOut(seg(t, t0, t1)));
  let y;
  if (t < 2.4) y = 0;
  else if (t < 6.2) y = leg(0, aim('.manifesto-frame'), 2.4, 4.4);
  else if (t < 10.8) y = leg(aim('.manifesto-frame'), aim('.realm-vista'), 6.2, 8.8);
  else if (t < 14.6) y = leg(aim('.realm-vista'), aim('.realm-plate'), 10.8, 12.2);
  else if (t < 18.1) y = leg(aim('.realm-plate'), aim('.realm-vista'), 14.6, 16.0);
  // Vril closes the way down under the camera: hold still while the page closes up
  else if (t < 18.9) y = S.memo('y-vril', () => scrollY);
  else if (t < 23.6) y = leg(S.memo('y-vril', () => scrollY), aim('#silent-vault .vault-art'), 18.9, 21.0);
  else y = leg(aim('#silent-vault .vault-art'), aim('#gate-in-the-wall'), 23.6, 25.6);
  scrollTo(0, y);

  /* ---------- the pointer: idles over the art; at each switch it opens the panel, picks the realm, closes it ---------- */
  const btn = () => S.mid('.prefs-btn');
  const optSel = (v) => `.prefs-opt[data-k="theme"][data-v="${v}"]`;
  const opt = (v) => { const e = document.querySelector(optSel(v)); const r = e && e.getBoundingClientRect(); return r && r.width ? [r.left + r.width / 2, r.top + r.height / 2] : btn(); };
  const idle = (tt) => [W * 0.6 + 150 * Math.sin(tt * 0.52), H * 0.56 + 80 * Math.sin(tt * 0.37 + 1)];
  let p = idle(t), press = 0;
  for (const [tc, v] of SW) {
    if (t < tc - 1.3 || t >= tc + 1.6) continue;
    const o = tc - 0.55, c = tc + 0.6;
    if (t < o) p = mix(idle(tc - 1.3), btn(), ease.inOut(seg(t, tc - 1.3, o - 0.05)));
    else if (t < tc) p = mix(btn(), opt(v), ease.inOut(seg(t, o + 0.08, tc - 0.08)));
    else if (t < c) p = mix(opt(v), btn(), ease.inOut(seg(t, tc + 0.1, c - 0.05)));
    else p = mix(btn(), idle(tc + 1.6), ease.inOut(seg(t, c, tc + 1.6)));
    at('open-' + tc, o, () => S.click('.prefs-btn', ...btn()));
    at('pick-' + tc, tc, () => S.click(optSel(v), ...opt(v)));
    at('close-' + tc, c, () => S.click('.prefs-btn', ...btn()));
    for (const x of [o, tc, c]) press = Math.max(press, 1 - Math.abs(t - x) / 0.12);
  }
  // the pointer grows into the mothership that brings the $2 down (its beam tip sits 17 units below the hull)
  const SHIP = [W * 0.76, 150];
  if (t < 26.6) S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 1.9 * (1 - 0.18 * Math.max(0, press)), show: t > 1.2 });
  else if (t < 27.55) {
    const k = ease.inOut(seg(t, 26.6, 27.5)), sc = lerp(1.9, 7.4, k);
    const q = mix(idle(26.6), [SHIP[0], SHIP[1] + 17 * 7.4], k);
    S.cursor(q[0], q[1], { scale: sc });
  } else S.cursor(0, 0, { show: false });
  if (t >= 27.5) {
    const lift = ease.in(seg(t, 29.7, 30.7));
    const beam = sm(seg(27.8, 28.3)) * (1 - sm(seg(29.3, 29.8)));
    S.craft('ship', { type: 'disc', x: SHIP[0], y: SHIP[1] - 420 * lift, size: 200, beam, beamLen: 260, opacity: 1 - seg(t, 30.4, 30.7) });
  }

  /* ---------- the realm, named at the corner of the frame after each click ---------- */
  let lab = document.getElementById('__realm');
  if (!lab) {
    lab = document.createElement('div'); lab.id = '__realm';
    lab.style.cssText = 'position:fixed;left:64px;bottom:58px;z-index:2147482000;pointer-events:none;font:400 13px/1.6 var(--f-mono);letter-spacing:.3em;text-transform:uppercase;color:var(--cyan);text-shadow:0 2px 14px rgba(0,0,0,.85)';
    document.body.appendChild(lab);
  }
  const done = SW.filter(([tc]) => t >= tc), cur = done.length ? done[done.length - 1][1] : 'polar';
  const since = done.length ? t - done[done.length - 1][0] : t - 2.6;
  const next = [...SW.map(([tc]) => tc), 99].find((tc) => tc > t);
  const end = cur === 'crystal' ? 30.0 : next - 0.7;
  const L = LABEL[cur];
  if (lab.dataset.k !== cur) {
    lab.dataset.k = cur;
    lab.innerHTML = `Realm ${L[0]}<br><b style="display:block;margin:6px 0 4px;font:700 30px/1.15 var(--f-display);letter-spacing:.1em;color:var(--frost);text-shadow:0 0 22px rgba(var(--accent-rgb),.55)">${L[1]}</b><span style="font-size:12px;letter-spacing:.24em;color:var(--sub,#cfe3f0)">${L[2]}</span>`;
  }
  lab.style.opacity = String(Math.max(0, Math.min(seg(since, 0.2, 0.7), 1 - seg(t, end - 0.4, end))));
  lab.style.transform = `translateY(${(1 - seg(since, 0.2, 0.7)) * 14}px)`;

  /* ---------- the gate in the ice wall: the words step aside and the $20 comes forward ---------- */
  if (t >= 26.0) {
    const sec = document.getElementById('gate-in-the-wall');
    const f = ease.inOut(seg(t, 26.2, 27.4));
    sec.querySelector(':scope > .wrap').style.opacity = String(1 - f);
    sec.style.setProperty('--wash', String(1 - 0.85 * f));
    const real = sec.querySelector('.gate-money img');
    if (t < 27.4) real.style.opacity = String(0.72 + 0.28 * f);
    document.querySelector('.site-header').style.opacity = String(1 - f);
    document.querySelector('.prefs').style.opacity = String(1 - f);
    // the Silent Vault above the gate goes dark too, so nothing of the page peeks in over the money
    document.getElementById('silent-vault').style.opacity = String(1 - f);
  }
  if (t < 27.4) return;

  /* ---------- THE LIVING MONEY ---------- */
  let T = document.getElementById('__trip');
  if (!T) {
    const real = document.querySelector('#gate-in-the-wall .gate-money img');
    const r = real.getBoundingClientRect();
    const front = real.currentSrc || real.src;
    const both = front.replace('antarctica-20-front', 'antarctica-20-both');
    const two = front.replace('antarctica-20-front', 'antarctica-dollars-750');
    const w = r.width, k = w / 792, h = 386 * k;
    S.memo('r20', () => [r.left + w / 2, r.top + r.height / 2, w, h]);
    // the flower of life (nineteen circles on a hex lattice), three rings and twenty-four rays
    const R = 92, geo = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const x = R * (i + j / 2), yy = R * j * Math.sqrt(3) / 2;
      if (Math.hypot(x, yy) <= 2 * R + 1) geo.push(`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${R}" style="stroke:var(--cyan)"/>`);
    }
    for (const rr of [290, 340, 470]) geo.push(`<circle cx="0" cy="0" r="${rr}" style="stroke:var(--amber)"/>`);
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; geo.push(`<line x1="${(300 * Math.cos(a)).toFixed(1)}" y1="${(300 * Math.sin(a)).toFixed(1)}" x2="${(560 * Math.cos(a)).toFixed(1)}" y2="${(560 * Math.sin(a)).toFixed(1)}" style="stroke:var(--cyan)"/>`); }
    // (the back, Worsley's Endurance route, is a pale map: it takes a darker grade than the front)
    const face = (pos, back) => `<div style="position:absolute;inset:0;background:url('${both}') 0 ${pos}px/${w}px ${w}px no-repeat;backface-visibility:hidden;${back ? 'transform:rotateY(180deg);' : ''}filter:url(#__liq) ${back ? 'brightness(.74) saturate(1.45) contrast(1.1)' : 'brightness(.94) saturate(1.2)'};box-shadow:0 0 60px rgba(var(--accent-rgb),.35)"></div>`;
    // a butterfly: the $2's front and back, hinged at the middle
    const fly = (id, cls) => `<div id="${id}" class="${cls}" style="position:absolute;left:0;top:0;width:1500px;height:370px;transform-style:preserve-3d;transform-origin:750px 185px;opacity:0">
        <div class="__wl" style="position:absolute;left:0;top:0;width:750px;height:370px;background:url('${two}') 0 0/750px 750px no-repeat;transform-origin:100% 50%;${cls === '__ghost' ? 'filter:brightness(.8) saturate(1.4);' : 'filter:url(#__liq) brightness(.82) saturate(1.45) contrast(1.08);'}"></div>
        <div class="__wr" style="position:absolute;left:750px;top:0;width:750px;height:370px;background:url('${two}') 0 -378px/750px 750px no-repeat;transform-origin:0 50%;${cls === '__ghost' ? 'filter:brightness(.8) saturate(1.4);' : 'filter:url(#__liq) brightness(.82) saturate(1.45) contrast(1.08);'}"></div></div>`;
    T = document.createElement('div'); T.id = '__trip';
    T.style.cssText = 'position:fixed;inset:0;z-index:2147482400;pointer-events:none;perspective:1700px;overflow:hidden';
    T.innerHTML = `<div id="__dark" style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 55%, #1b0c36 0%, #0a0516 60%, #04020a 100%);opacity:0"></div>
      <svg width="0" height="0" style="position:absolute"><filter id="__liq" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
        <feTurbulence id="__turb" type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="n"/>
        <feDisplacementMap id="__disp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
      <svg id="__geo" viewBox="-960 -540 1920 1080" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;mix-blend-mode:screen;fill:none;stroke-width:1.6">${geo.join('')}</svg>
      ${Array.from({ length: 7 }, (_, i) => `<img class="__echo" src="${front}" style="position:absolute;left:0;top:0;width:${w}px;opacity:0">`).join('')}
      <div id="__b20" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-style:preserve-3d">${face(0, false)}${face(-406 * k, true)}</div>
      ${[1, 2, 3, 4].map((i) => fly('__g' + i, '__ghost')).join('')}
      ${[1, 2, 3, 4, 5].map((i) => fly('__s' + i, '__swarm')).join('')}
      ${fly('__bf', '__main')}
      <div id="__veil" style="position:absolute;inset:0;background:#05020c;opacity:0"></div>`;
    document.body.appendChild(T);
    real.style.visibility = 'hidden';
  }
  const [x0, y0, w20, h20] = S.memo('r20', () => [W / 2, H / 2, 1440, 702]);

  // the beat: 120 BPM, a pulse on every beat through the build and the peak
  const beat = (tt) => Math.exp(-(((tt % 0.5) + 0.5) % 0.5) * 7);
  const liquid = sm(seg(t, 30.0, 33.0)) * 22 + sm(seg(t, 33.8, 34.6)) * 14 * (1 - sm(seg(t, 37.6, 38.4))) - sm(seg(t, 38.0, 41.0)) * 22;
  document.getElementById('__disp').setAttribute('scale', Math.max(0, liquid).toFixed(2));
  document.getElementById('__turb').setAttribute('baseFrequency', `${(0.005 + 0.002 * Math.sin(t * 0.45)).toFixed(5)} ${(0.008 + 0.003 * Math.sin(t * 0.6 + 1)).toFixed(5)}`);

  /* the $20: comes forward, breathes, tilts, turns over to its back and back again, settles */
  const A = [840, 640, 0.9], B = [960, 650, 0.92];
  const build = sm(seg(t, 30.0, 34.0)), peak = sm(seg(t, 33.8, 34.6)) * (1 - sm(seg(t, 37.8, 38.6))), down = sm(seg(t, 38.0, 41.0));
  let cx, cy, s;
  if (t < 29.0) { const k = ease.inOut(seg(t, 27.4, 29.0)); cx = lerp(x0, A[0], k); cy = lerp(y0, A[1], k); s = lerp(1, A[2], k); }
  else if (t < 38.0) { const k = ease.inOut(seg(t, 30.0, 32.0)); cx = lerp(A[0], 960, k); cy = lerp(A[1], 560, k); s = lerp(A[2], 1.0, k); }
  else { cx = lerp(960, B[0], down); cy = lerp(560, B[1], down); s = lerp(1.0, B[2], down); }
  const alive = Math.max(build, peak) * (1 - down);
  s *= 1 + (0.025 * Math.sin(t * Math.PI) + 0.045 * beat(t) * peak) * alive;
  // over to the back (33.0-34.6), a whole turn through the peak, and home to the front for the come-down
  const flipY = 180 * ease.inOut(seg(t, 32.6, 34.0)) + 360 * ease.inOut(seg(t, 34.6, 37.6)) + 180 * ease.inOut(seg(t, 38.0, 39.8));
  const rx = 9 * Math.sin(t * 0.9) * alive, rz = (3 * Math.sin(t * 0.7) + 6 * Math.sin(t * 1.1) * peak) * (1 - down);
  const b20 = document.getElementById('__b20');
  b20.style.transform = `translate(${cx - w20 / 2}px, ${cy - h20 / 2}px) scale(${s}) rotateX(${rx}deg) rotateY(${flipY}deg) rotateZ(${rz}deg)`;

  // echoes of the $20 bloom outwards behind it, each a step round the colour wheel
  const echo = sm(seg(t, 30.6, 33.4)) * (1 - sm(seg(t, 38.0, 40.0)));
  document.querySelectorAll('#__trip .__echo').forEach((e, i0) => {
    const i = i0 + 1;
    const es = s * (1 + 0.16 * i * (1 + 0.5 * peak) + 0.05 * Math.sin(t * 1.7 + i));
    e.style.transform = `translate(${cx - w20 / 2}px, ${cy - h20 / 2}px) scale(${es}) rotate(${(i * 5 * Math.sin(t * 0.6 + i * 0.4) + 14 * i * peak * Math.sin(t * 0.5)).toFixed(2)}deg)`;
    e.style.transformOrigin = '50% 50%';
    e.style.opacity = (echo * 0.22 * (1 - i / 8.5)).toFixed(3);
    e.style.filter = `hue-rotate(${i * 48 + t * 40 * peak}deg) saturate(1.6) brightness(${0.72 - 0.04 * i})`;
  });

  // sacred geometry turning behind, breathing on the beat
  const geoA = 0.5 * sm(seg(t, 31.0, 34.0)) + 0.25 * peak - 0.75 * sm(seg(t, 38.0, 40.0));
  const g = document.getElementById('__geo');
  g.style.opacity = Math.max(0, geoA).toFixed(3);
  g.style.transform = `rotate(${t * 14}deg) scale(${1 + 0.08 * Math.sin(t * 1.2) + 0.05 * beat(t) * peak})`;

  /* the $2: folded down the beam, opened beside the $20, then a butterfly round it, trailing tracers */
  const REST = [1470, 262, 0.44], HOME = [960, 236, 0.46];
  const flight = (tt) => {
    const q = tt - 30.0;
    return [960 + 600 * Math.cos(0.85 * q + 0.45), 520 + 290 * Math.sin(1.7 * q)];
  };
  const pose = (tt) => {
    // [x, y, scale, wing angle, roll]
    if (tt < 27.6) return [SHIP[0], SHIP[1] + 40, 0.3, 82, 0];
    if (tt < 29.2) {
      const k = ease.inOut(seg(tt, 27.8, 29.2));
      return [lerp(SHIP[0], REST[0], k), lerp(SHIP[1] + 40, REST[1], k), lerp(0.3, REST[2], k), 82 * (1 - ease.inOut(seg(tt, 28.5, 29.2))), 0];
    }
    if (tt < 30.0) return [REST[0], REST[1], REST[2], 0, 0];
    const flap = 10 + 52 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.25 * (tt - 30.0)));
    if (tt < 38.0) {
      const k = sm(seg(tt, 30.0, 31.0));
      const f = flight(tt), f2 = flight(tt + 0.05);
      const roll = Math.atan2(f2[1] - f[1], f2[0] - f[0]) * 180 / Math.PI;
      return [lerp(REST[0], f[0], k), lerp(REST[1], f[1], k), lerp(REST[2], 0.5, k), flap * k, Math.max(-25, Math.min(25, roll * 0.25)) * k];
    }
    const k = ease.inOut(seg(tt, 38.0, 40.6)), f = flight(38.0);
    return [lerp(f[0], HOME[0], k), lerp(f[1], HOME[1], k), lerp(0.5, HOME[2], k), flap * (1 - sm(seg(tt, 39.8, 40.6))), 0];
  };
  const place = (el, P, a = 1, hue = 0) => {
    el.style.transform = `translate(${P[0] - 750}px, ${P[1] - 185}px) scale(${P[2]}) rotateZ(${P[4]}deg) rotateX(${12 * Math.sin(t * 0.8)}deg)`;
    el.firstElementChild.style.transform = `rotateY(${P[3]}deg)`;
    el.lastElementChild.style.transform = `rotateY(${-P[3]}deg)`;
    el.style.opacity = a.toFixed(3);
    if (hue) el.style.filter = `hue-rotate(${hue}deg)`;
  };
  place(document.getElementById('__bf'), pose(t), seg(t, 27.6, 27.9));
  const trail = sm(seg(t, 30.2, 31.0)) * (1 - sm(seg(t, 39.0, 40.4)));
  [1, 2, 3, 4].forEach((k) => place(document.getElementById('__g' + k), pose(t - 0.085 * k), trail * 0.36 * (1 - k / 5), k * 50 + t * 30));
  // the swarm: five more round the $20 at the peak, then folded back into the one
  const swarm = sm(seg(t, 33.6, 34.4)) * (1 - sm(seg(t, 37.8, 38.8)));
  [1, 2, 3, 4, 5].forEach((k) => {
    const a = 1.3 * t + k * 2 * Math.PI / 6, rad = lerp(0, 1, swarm);
    const fl = 10 + 52 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.25 * (t - 30.0) + k));
    const M = pose(t);
    const P = [lerp(M[0], 960 + 560 * Math.cos(a), rad), lerp(M[1], 540 + 340 * Math.sin(a), rad), 0.32, fl, (a * 180 / Math.PI + 90) % 360 * 0.08];
    place(document.getElementById('__s' + k), P, swarm, k * 60);
  });

  document.getElementById('__dark').style.opacity = sm(seg(t, 27.4, 28.4)).toFixed(3);
  // CALM: a veil over the money for the name
  document.getElementById('__veil').style.opacity = (0.5 * sm(seg(t, 41.2, 42.4))).toFixed(3);
}

/* ---------- Stage B: the trip ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const beat = (tt) => Math.exp(-(((tt % 0.5) + 0.5) % 0.5) * 7);
  // the hue holds still while the realms show their own colours, and only turns once the money is alive
  const speed = (x) => (x < 30 ? 0 : x < 34 ? 45 * (x - 30) / 4 : x < 38 ? 45 + 35 * sm((x - 34) / 4) : 0);
  let turned = 0;
  for (let x = 30; x < Math.min(t, 38); x += 0.01) turned += speed(x) * 0.01;
  const peakTurn = (() => { let s = 0; for (let x = 30; x < 38; x += 0.01) s += speed(x) * 0.01; return s; })();
  const down = sm(seg(38.0, 41.0));
  const hue = t < 38 ? turned : peakTurn + (Math.ceil(peakTurn / 360) * 360 - peakTurn) * down;

  // aurora only behind the page: no stars, no nebula
  const u = { sky: [0.32, 0, 0], bloom: 0.24, glow: 0.38, grain: 0.016, hue, chroma: 0.001, trails: 0.08, cam: [1, 0, 0], zoom: 1, pan: [0, 0] };
  // the realm's own colours for the aurora, the tunnel's rings and the frame of light
  const ACC = { polar: [[0.365, 0.894, 1], [0.365, 1, 0.694]], 'inner-earth': [[1, 0.70, 0.28], [1, 0.48, 0.27]], mono: [[0.95, 0.95, 0.95], [0.7, 0.7, 0.7]], vril: [[0.365, 1, 0.61], [0.84, 1, 0.365]], crystal: [[0.78, 0.61, 1], [1, 0.82, 0.48]] };
  const realm = SWITCHES.filter(([tc]) => t >= tc).map(([, r]) => r).pop() || 'polar';
  [u.accent, u.accent2] = ACC[realm];

  if (t < 2.6) {
    // the page arrives out of the dark
    const arr = sm(seg(0, 2.4));
    u.cam = [arr, -10 * (1 - arr), 6 * (1 - arr)];
    u.black = 1 - sm(seg(0, 0.7));
  }
  // the long flights down the page streak
  for (const [a, b] of [[2.4, 4.4], [6.2, 8.8], [10.8, 12.2], [14.6, 16.0], [18.9, 21.0], [23.6, 25.6]]) {
    const f = Math.sin(Math.PI * seg(a, b));
    u.trails = Math.max(u.trails, 0.08 + 0.3 * f);
    u.zoom += 0.025 * f; u.warp = (u.warp || 0) + 0.002 * f;
  }
  // each realm click repaints the page from the frame before it, on a scan line or in glitch slices
  for (const [tc, , kind] of SWITCHES) {
    if (t >= tc && t < tc + 0.6) { u.wipe = seg(tc, tc + 0.55); u.held = Math.round(tc * FPS) - 1; u.wipeKind = kind; }
    const kick = t >= tc ? Math.exp(-(t - tc) * 4) : 0;
    u.chroma += 0.004 * kick; u.warp = (u.warp || 0) + 0.004 * kick;
  }

  if (t >= 26.0 && t < 30.0) {
    // the money comes forward; the mothership's light
    const k = sm(seg(26.0, 28.0)), beam = sm(seg(27.8, 28.3)) * (1 - sm(seg(29.3, 29.8)));
    u.bloom = 0.3 - 0.1 * k + 0.08 * beam; u.glow = 0.45 - 0.12 * k + 0.12 * beam; u.trails = 0.12 + 0.08 * k;
  } else if (t >= 30.0 && t < 34.0) {
    // it comes alive: tracers lengthen, the page sways and pours, mirrors creep in
    const T = sm(seg(30.0, 34.0));
    u.trails = 0.2 + 0.38 * T; u.warp = 0.003 + 0.013 * T; u.chroma = 0.002 + 0.007 * T;
    u.kaleido = 0.28 * T * T; u.kalN = 6;
    u.cam = [1, 4 * T * Math.sin(t * 0.5), 3 * T * Math.sin(t * 0.37)];
    u.zoom = 1 + 0.03 * T * beat(t);
    u.bloom = 0.2 + 0.06 * T; u.glow = 0.33 + 0.1 * T;
  } else if (t >= 34.0 && t < 41.2) {
    // PEAK 34-38: a money mandala, a tunnel of money; COME DOWN 38-41: it all unwinds
    const peak = sm(seg(34.0, 34.8)) * (1 - down);
    const tun = sm(seg(35.2, 35.9)) * (1 - sm(seg(36.9, 37.6)));
    u.kaleido = 0.28 * (1 - sm(seg(34.0, 34.6))) + 0.86 * peak; u.kalN = 6 + 2 * sm(seg(34.0, 34.6));
    u.tunnel = [0.62 * tun, (t - 35.2) * 2.6, 0.35, 0.45 * tun];
    u.trails = 0.56 * (1 - down) + 0.1 + 0.06 * peak;
    u.warp = 0.016 * (1 - down) + 0.004 * peak; u.chroma = 0.009 * (1 - down) + 0.0015 + 0.002 * peak;
    u.zoom = 1 + 0.05 * peak * beat(t);
    u.cam = [1, 4 * (1 - down) * Math.sin(t * 0.5), 3 * (1 - down) * Math.sin(t * 0.37)];
    u.bloom = 0.24 + 0.06 * peak; u.glow = 0.4 + 0.08 * peak;
  } else if (t >= 41.2) {
    // CALM: the name over the money, walking the scripts; a slow ripple at each change; the dark
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.bloom = 0.26; u.glow = 0.45;
    const e = sm(seg(41.6, 42.6));
    let cur = 0;
    OUTRO.forEach(([tc], i) => { if (t >= tc) cur = i; });
    // plates: 0 future, 1 runic, 2 oldworld (OUTRO's fonts mapped onto the plate list)
    const idx = { future: 0, runic: 1, oldworld: 2 }[OUTRO[cur][1]];
    const since = t - OUTRO[cur][0];
    const prev = cur > 0 ? { future: 0, runic: 1, oldworld: 2 }[OUTRO[cur - 1][1]] : null;
    const k = sm(Math.min(1, since / 0.3));
    u.plates = [{ i: idx, x: 0, y: 0.01, h: 0.6 + 0.012 * sm(seg(41.6, 47.6)), a: e * (cur === 0 ? 1 : k), glow: 0.35 + 0.3 * rip }];
    if (prev != null && k < 1) u.plates.unshift({ i: prev, x: 0, y: 0.01, h: 0.6, a: e * (1 - k), glow: 0.35 });
    u.zoom = 1 + 0.03 * sm(seg(43, 48.6));
    u.black = sm(seg(47.6, 48.8));
  }
  return u;
}

export default {
  key: 'living-money',
  poster: 35.6,
  title: 'The Living Money — every realm’s own art, then the Antarctica $20 and $2 come alive',
  dur: 49,
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  act,
  lens,
  plates: ['wordmark@future@crystal', 'wordmark@runic@crystal', 'wordmark@oldworld@crystal'],
  cues: [
    { t: 0.3, kind: 'arrive' }, { t: 2.4, kind: 'swoop' },
    ...SWITCHES.flatMap(([tc]) => [{ t: tc - 0.55, kind: 'click' }, { t: tc, kind: 'realm' }, { t: tc + 0.6, kind: 'click' }]),
    { t: 6.2, kind: 'swoop' }, { t: 8.8, kind: 'relic' }, { t: 12.2, kind: 'relic' }, { t: 18.9, kind: 'swoop' }, { t: 23.6, kind: 'swoop' },
    { t: 25.6, kind: 'zoom' }, { t: 26.6, kind: 'leave' }, { t: 27.55, kind: 'mother' }, { t: 27.8, kind: 'beam' }, { t: 29.2, kind: 'relic' },
    { t: 30.0, kind: 'trip' }, { t: 32.6, kind: 'shift' }, { t: 34.0, kind: 'peak' }, { t: 34.0, kind: 'mandala' }, { t: 35.2, kind: 'tunnel' },
    { t: 38.0, kind: 'down' }, { t: 41.2, kind: 'calm' }, { t: 41.6, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
