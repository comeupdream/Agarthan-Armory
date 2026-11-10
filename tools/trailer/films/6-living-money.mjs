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
  // a real butterfly's right wing (forewing and hindwing) in its own box, hinge on the left edge
  const WING = [[0.02, 0.4], [0.12, 0.2], [0.3, 0.06], [0.55, 0.0], [0.8, 0.02], [0.96, 0.1], [1.0, 0.22], [0.95, 0.34], [0.82, 0.43], [0.66, 0.49],
    [0.74, 0.56], [0.8, 0.68], [0.77, 0.81], [0.65, 0.93], [0.48, 1.0], [0.3, 0.96], [0.16, 0.85], [0.06, 0.68], [0.0, 0.54]];
  // the note's rectangle and the wing, as the same 72 points round the box's middle, so one can morph into the other
  const shapes = S.memo('wing', () => {
    const hit = (ang) => {
      const dx = Math.cos(ang), dy = Math.sin(ang); let best = Infinity;
      for (let i = 0; i < WING.length; i++) {
        const [x1, y1] = WING[i], [x2, y2] = WING[(i + 1) % WING.length], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const tt = ((x1 - 0.5) * ey - (y1 - 0.5) * ex) / den, uu = ((x1 - 0.5) * dy - (y1 - 0.5) * dx) / den;
        if (tt > 0 && uu >= 0 && uu <= 1 && tt < best) best = tt;
      }
      return [0.5 + best * dx, 0.5 + best * dy];
    };
    const rect = [], wing = [];
    for (let i = 0; i < 72; i++) {
      const ang = (i / 72) * 2 * Math.PI, dx = Math.cos(ang), dy = Math.sin(ang), q = 0.5 / Math.max(Math.abs(dx), Math.abs(dy));
      rect.push([0.5 + dx * q, 0.5 + dy * q]); wing.push(hit(ang));
    }
    return { rect, wing };
  });
  const clip = (m, mirror) => 'polygon(' + shapes.rect.map((r, i) => {
    let x = lerp(r[0], shapes.wing[i][0], m), yy = lerp(r[1], shapes.wing[i][1], m);
    if (mirror) x = 1 - x;
    return `${(x * 100).toFixed(2)}% ${(yy * 100).toFixed(2)}%`;
  }).join(',') + ')';

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
    for (let i = 0; i < 24; i++) { const a2 = i * Math.PI / 12; geo.push(`<line x1="${(300 * Math.cos(a2)).toFixed(1)}" y1="${(300 * Math.sin(a2)).toFixed(1)}" x2="${(560 * Math.cos(a2)).toFixed(1)}" y2="${(560 * Math.sin(a2)).toFixed(1)}" style="stroke:var(--cyan)"/>`); }
    // the 20's two faces (the back, Worsley's Endurance route, is a pale map: a darker grade)
    const face = (pos, back) => `<div style="position:absolute;inset:0;background:url('${both}') 0 ${pos}px/${w}px ${w}px no-repeat;backface-visibility:hidden;${back ? 'transform:rotateY(180deg);' : ''}filter:url(#__liq) ${back ? 'brightness(.8) saturate(1.45) contrast(1.08)' : 'brightness(.94) saturate(1.2)'};box-shadow:0 0 60px rgba(var(--accent-rgb),.35)"></div>`;
    // the peak's spiral: the 20's back nested inside itself, smaller and turned each time
    const nest = () => `<div class="__nest" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;background:url('${both}') 0 ${-406 * k}px/${w}px ${w}px no-repeat;transform-origin:50% 50%;opacity:0;filter:brightness(.8) saturate(1.45) contrast(1.08);box-shadow:0 0 40px rgba(0,0,0,.7)"></div>`;
    T = document.createElement('div'); T.id = '__trip';
    T.style.cssText = 'position:fixed;inset:0;z-index:2147482400;pointer-events:none;perspective:1700px;overflow:hidden';
    T.innerHTML = `<div id="__dark" style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 55%, #1b0c36 0%, #0a0516 60%, #04020a 100%);opacity:0"></div>
      <svg width="0" height="0" style="position:absolute"><filter id="__liq" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
        <feTurbulence id="__turb" type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="n"/>
        <feDisplacementMap id="__disp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
      <svg id="__geo" viewBox="-960 -540 1920 1080" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;mix-blend-mode:screen;fill:none;stroke-width:1.6">${geo.join('')}</svg>
      <div id="__b20" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-style:preserve-3d">${face(0, false)}${face(-406 * k, true)}</div>
      ${Array.from({ length: 9 }, nest).join('')}
      <div id="__bf" style="position:absolute;left:0;top:0;width:1500px;height:370px;transform-style:preserve-3d;opacity:0">
        <div class="__wl" style="position:absolute;left:0;top:0;width:750px;height:100%;transform-origin:100% 50%">
          <div class="__wa" style="position:absolute;inset:0;background:url('${two}') 0 0/750px 750px no-repeat;filter:url(#__liq) brightness(.86) saturate(1.5) contrast(1.1)"></div></div>
        <div class="__wr" style="position:absolute;left:750px;top:0;width:750px;height:100%;transform-origin:0 50%">
          <div class="__wa" style="position:absolute;inset:0;background:url('${two}') 0 0/750px 750px no-repeat;transform:scaleX(-1);filter:url(#__liq) brightness(.86) saturate(1.5) contrast(1.1);opacity:0"></div>
          <div class="__wb" style="position:absolute;inset:0;background:url('${two}') 0 -378px/750px 750px no-repeat;filter:brightness(.86) saturate(1.5) contrast(1.1)"></div></div>
        <div class="__body" style="position:absolute;left:734px;width:32px;border-radius:50%;background:linear-gradient(180deg,#4b1f7a,#1a0830 60%,#0c0418);box-shadow:0 0 22px rgba(199,155,255,.75);opacity:0"></div>
        <svg class="__ant" viewBox="0 0 200 160" style="position:absolute;left:650px;width:200px;height:160px;overflow:visible;opacity:0;fill:none;stroke:#e9d6ff;stroke-width:3;stroke-linecap:round">
          <path d="M96 158 C 88 110, 60 60, 30 20"/><path d="M104 158 C 112 110, 140 60, 170 20"/><circle cx="30" cy="20" r="6" fill="#ffd27a" stroke="none"/><circle cx="170" cy="20" r="6" fill="#ffd27a" stroke="none"/></svg>
      </div>
      <div id="__veil" style="position:absolute;inset:0;background:#05020c;opacity:0"></div>`;
    document.body.appendChild(T);
    real.style.visibility = 'hidden';
  }
  const [x0, y0, w20, h20] = S.memo('r20', () => [W / 2, H / 2, 1440, 702]);

  // the morphing ripple through the money (the print swims), and its slow drift
  const liquid = sm(seg(t, 31.6, 34.0)) * 14 + sm(seg(t, 33.8, 34.6)) * 8 * (1 - sm(seg(t, 37.6, 38.4))) - sm(seg(t, 38.0, 41.0)) * 14;
  document.getElementById('__disp').setAttribute('scale', Math.max(0, liquid).toFixed(2));
  document.getElementById('__turb').setAttribute('baseFrequency', `${(0.005 + 0.002 * Math.sin(t * 0.45)).toFixed(5)} ${(0.008 + 0.003 * Math.sin(t * 0.6 + 1)).toFixed(5)}`);

  /* the $20: beside the $2, then turned over to its back, which fills the frame and holds there,
     swaying gently, while the trip happens to its art (lens: breathing, tracers round its edges, bubble print) */
  const A20 = [840, 640, 0.9], CEN = [960, 545, 1.16], END = [960, 650, 0.92];
  const down = sm(seg(t, 38.0, 41.0)), peak = sm(seg(t, 34.0, 34.8)) * (1 - down);
  let cx, cy, s;
  if (t < 29.0) { const k = ease.inOut(seg(t, 27.4, 29.0)); cx = lerp(x0, A20[0], k); cy = lerp(y0, A20[1], k); s = lerp(1, A20[2], k); }
  else if (t < 38.0) { const k = ease.inOut(seg(t, 30.0, 31.8)); cx = lerp(A20[0], CEN[0], k); cy = lerp(A20[1], CEN[1], k); s = lerp(A20[2], CEN[2], k); }
  else { cx = lerp(CEN[0], END[0], down); cy = lerp(CEN[1], END[1], down); s = lerp(CEN[2], END[2], down); }
  const sway = sm(seg(t, 31.6, 33.0)) * (1 - down);
  const flipY = 180 * ease.inOut(seg(t, 30.0, 31.6));
  const rx = 6 * Math.sin(t * 0.8) * sway, rz = 3.5 * Math.sin((t - 31.6) * 0.6) * sway;
  cx += 26 * Math.sin((t - 31.6) * 0.7) * sway; cy += 14 * Math.sin((t - 31.6) * 1.1) * sway;
  document.getElementById('__b20').style.transform = `translate(${cx - w20 / 2}px, ${cy - h20 / 2}px) scale(${s}) rotateX(${rx}deg) rotateY(${flipY}deg) rotateZ(${rz}deg)`;

  // PEAK: the back of the 20 nested inside itself, turning: the fractal
  const spiral = sm(seg(t, 34.2, 35.2)) * (1 - sm(seg(t, 37.4, 38.4)));
  document.querySelectorAll('#__trip .__nest').forEach((e, i0) => {
    const i = i0 + 1;
    const ns = s * Math.pow(0.8, i), ang = rz + (i * 13 + (t - 34.2) * 24) * spiral;
    e.style.transform = `translate(${cx - w20 / 2}px, ${cy - h20 / 2}px) scale(${ns}) rotate(${ang}deg)`;
    e.style.opacity = (spiral * Math.pow(0.93, i)).toFixed(3);
  });

  // sacred geometry, faint, turning behind
  const g = document.getElementById('__geo');
  g.style.opacity = Math.max(0, 0.3 * sm(seg(t, 32.0, 34.0)) - 0.3 * down).toFixed(3);
  g.style.transform = `rotate(${t * 14}deg) scale(${1 + 0.08 * Math.sin(t * 1.2)})`;

  /* the $2: folded down the beam and opened beside the 20; then it morphs into a real butterfly,
     printed with the note's face, flies over the 20's back, and lands and turns back into the note */
  const REST = [1470, 262, 0.44], HOME = [960, 236, 0.44];
  const morph = ease.inOut(seg(t, 30.4, 32.0)) * (1 - ease.inOut(seg(t, 39.6, 40.8)));
  const flight = (tt) => { const q = tt - 32.0; return [960 + 520 * Math.cos(0.8 * q + 0.5), 500 + 250 * Math.sin(1.6 * q)]; };
  const flap = (tt) => 12 + 58 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 1.6 * (tt - 32.0)));
  let P;   // [x, y, scale, wing angle, roll]
  if (t < 27.6) P = [SHIP[0], SHIP[1] + 40, 0.3, 82, 0];
  else if (t < 29.2) { const k = ease.inOut(seg(t, 27.8, 29.2)); P = [lerp(SHIP[0], REST[0], k), lerp(SHIP[1] + 40, REST[1], k), lerp(0.3, REST[2], k), 82 * (1 - ease.inOut(seg(t, 28.5, 29.2))), 0]; }
  else if (t < 32.0) P = [REST[0], REST[1], REST[2], 0, 0];
  else if (t < 38.0) {
    const k = sm(seg(t, 32.0, 33.0)), f = flight(t), f2 = flight(t + 0.05);
    const roll = Math.max(-22, Math.min(22, Math.atan2(f2[1] - f[1], f2[0] - f[0]) * 180 / Math.PI * 0.22));
    P = [lerp(REST[0], f[0], k), lerp(REST[1], f[1], k), REST[2] * (1 + 0.15 * peak), flap(t) * k, roll * k];
  } else {
    const k = ease.inOut(seg(t, 38.0, 39.6)), f = flight(38.0);
    P = [lerp(f[0], HOME[0], k), lerp(f[1], HOME[1], k), HOME[2], flap(t) * (1 - sm(seg(t, 38.8, 39.6))), 0];
  }
  const bf = document.getElementById('__bf');
  const Hw = 370 * (1 + 0.95 * morph);   // the note's height, then the wing's
  bf.style.height = Hw + 'px';
  bf.style.transformOrigin = `750px ${Hw / 2}px`;
  bf.style.transform = `translate(${P[0] - 750}px, ${P[1] - Hw / 2}px) scale(${P[2]}) rotateZ(${P[4]}deg) rotateX(${10 * Math.sin(t * 0.8) * morph}deg)`;
  bf.style.opacity = seg(t, 27.6, 27.9).toFixed(3);
  const wl = bf.querySelector('.__wl'), wr = bf.querySelector('.__wr');
  wl.style.transform = `rotateY(${P[3]}deg)`; wr.style.transform = `rotateY(${-P[3]}deg)`;
  wl.style.clipPath = clip(morph, true); wr.style.clipPath = clip(morph, false);
  const bgS = `750px ${750 * Hw / 370}px`;
  wl.firstElementChild.style.backgroundSize = bgS;
  const wa = wr.querySelector('.__wa'), wb = wr.querySelector('.__wb');
  wa.style.backgroundSize = bgS; wa.style.opacity = morph.toFixed(3);
  wb.style.backgroundSize = bgS; wb.style.backgroundPosition = `0 ${-378 * Hw / 370}px`; wb.style.opacity = (1 - morph).toFixed(3);
  const body = bf.querySelector('.__body'), ant = bf.querySelector('.__ant');
  body.style.top = (Hw * 0.12) + 'px'; body.style.height = (Hw * 0.78) + 'px'; body.style.opacity = morph.toFixed(3);
  ant.style.top = (Hw * 0.12 - 150) + 'px'; ant.style.opacity = morph.toFixed(3);

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
  } else if (t >= 30.0 && t < 41.2) {
    // the back of the 20 comes alive: it breathes (a breath a bar), the edges of its art pulse outward
    // in colour (tracers), and the print melts into bubbles; PEAK 34-38 compounds it all into the fractal
    // (mirrors, the spiral, the tunnel); COME DOWN 38-41 unwinds it
    const B = (t - 30.0) * Math.PI;   // one breath every two seconds, on the bar
    const T = sm(seg(31.4, 34.0)), peak = sm(seg(34.0, 34.8)) * (1 - down);
    const on = T * (1 - down);
    u.breathe = [on, B];
    u.edge = [0.9 * on, 3 + 6 * T, 0.011 + 0.005 * peak, B];
    u.bubble = [Math.max(0, 0.3 * sm(seg(32.6, 34.0)) + 0.38 * sm(seg(34.0, 35.6)) - 0.68 * down), 40 - 10 * peak, 1 + 0.8 * peak];
    u.trails = 0.14 + 0.22 * on + 0.16 * peak;
    u.warp = 0.002 + 0.006 * on + 0.006 * peak; u.chroma = 0.0015 + 0.004 * on + 0.004 * peak;
    u.kaleido = 0.86 * peak; u.kalN = 6 + 2 * sm(seg(34.0, 34.6));
    const tun = sm(seg(35.2, 35.9)) * (1 - sm(seg(36.9, 37.6)));
    u.tunnel = [0.55 * tun, (t - 35.2) * 2.6, 0.35, 0.4 * tun];
    u.zoom = 1 + 0.04 * peak * beat(t);
    u.cam = [1, 3 * on * Math.sin(t * 0.5), 2.2 * on * Math.sin(t * 0.37)];
    u.bloom = 0.2 + 0.06 * peak; u.glow = 0.34 + 0.1 * peak;
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
