/*
 * HYPERBOREAN ARSENAL — the vaults, their holograms, and the line the site opens with.
 *
 * In the Vril realm the pointer sweeps the six departments (the real hover: each card
 * lifts and runs its scan line). Then the page dims and the site's own holo schematics
 * (assets/js/icons.js) assemble at full size one after another, line by line, turning
 * on a pedestal of light with each department's name and words from the page. The
 * last is mirrored into a mandala, the lens falls into a crystal tunnel walled with the
 * featured cards, and the site's tagline comes out of its light. No store photos.
 */

function act(t, S) {
  const { seg, keys, ease, at } = S;
  const W = innerWidth, H = innerHeight;
  at('setup', 0, () => { const r = document.querySelector('#departments .section-head').getBoundingClientRect(); scrollTo(0, scrollY + r.top - 118); });

  /* ---------- the sweep over the six vaults (real :hover) ---------- */
  const cards = S.memo('cards', () => S.$$('#deptGrid .dept').map((c) => S.mid(c)));
  if (t < 6.0) {
    const k = [[0, [W * 0.1, H * 1.05]]];
    cards.forEach((c, i) => { k.push([0.6 + i * 0.8, c], [0.6 + i * 0.8 + 0.45, c]); });
    k.push([6.0, [W * 0.5, H * 0.5]]);
    const p = keys(t, k, ease.inOut);
    S.cursor(p[0], p[1]); S.mouse = p;
  } else S.cursor(0, 0, { show: false });

  /* ---------- the arsenal: holograms assembling on a pedestal ---------- */
  const SET = [
    ['pistol', 0], ['ar', 1], ['bolt', 1], ['shotgun', 2], ['scope', 4], ['thermal', 4],
  ];
  let ov = document.getElementById('__arsenal');
  if (!ov && t >= 5.6) {
    ov = document.createElement('div'); ov.id = '__arsenal';
    ov.innerHTML = `<style>
      #__arsenal{position:fixed;inset:0;z-index:2147482000;pointer-events:none;display:grid;place-items:center;background:radial-gradient(70% 60% at 50% 45%,rgba(4,22,13,.86),rgba(1,6,4,.97));color:var(--cyan)}
      #__arsenal .stage{position:relative;width:1180px;height:600px;perspective:1700px}
      #__arsenal .holo-big{position:absolute;inset:0;display:grid;place-items:center;transform-style:preserve-3d}
      #__arsenal .holo-big svg{width:1100px;height:auto;overflow:visible;filter:drop-shadow(0 0 10px var(--cyan)) drop-shadow(0 0 2px #fff)}
      #__arsenal .holo-big svg *{vector-effect:none!important;stroke-width:.55px!important}
      #__arsenal .ghost{opacity:.35;filter:blur(6px)}
      #__arsenal .ped{position:absolute;left:50%;bottom:-40px;width:900px;height:120px;margin-left:-450px;border-radius:50%;
        background:radial-gradient(50% 50% at 50% 50%,rgba(93,228,255,.35),rgba(93,255,177,.08) 60%,transparent 72%);box-shadow:0 0 0 1px rgba(160,240,255,.25) inset}
      #__arsenal .ring{position:absolute;left:50%;bottom:0;width:760px;height:80px;margin-left:-380px;border-radius:50%;border:1px solid rgba(180,250,255,.5)}
      #__arsenal .cap{position:absolute;left:0;right:0;top:-120px;text-align:center}
      #__arsenal .cap b{display:block;font:400 18px/1 var(--f-mono);letter-spacing:.4em;text-transform:uppercase;color:var(--aurora)}
      #__arsenal .cap h3{font:800 64px/1.05 var(--f-display);letter-spacing:.06em;margin:14px 0 0;color:var(--frost);text-shadow:0 0 24px var(--cyan)}
      #__arsenal .cap p{font:400 22px/1.5 var(--f-ui);color:var(--text);margin:14px auto 0;max-width:820px}
      #__arsenal .hud{position:absolute;font:400 14px/1.7 var(--f-mono);letter-spacing:.24em;text-transform:uppercase;color:rgba(185,240,255,.75);background:none;border:0;backdrop-filter:none}
      #__arsenal .scanl{position:absolute;left:-40px;right:-40px;height:2px;background:linear-gradient(90deg,transparent,#dffaff,transparent);box-shadow:0 0 18px var(--cyan)}
    </style>
    <div class="stage"><div class="ped"></div><div class="ring"></div>
      <div class="cap"><b></b><h3></h3><p></p></div>
      <div class="holo-big ghost"></div><div class="holo-big main"></div><div class="scanl"></div>
      <div class="hud" style="left:-30px;top:120px"></div><div class="hud" style="right:-30px;top:120px;text-align:right"></div></div>`;
    document.body.appendChild(ov);
  }
  if (ov) {
    const on = seg(t, 5.6, 6.2) * (1 - seg(t, 17.6, 18.2));
    ov.style.opacity = on; ov.style.display = on > 0 ? 'grid' : 'none';
    const i = Math.min(SET.length - 1, Math.max(0, Math.floor((t - 6.0) / 1.9)));
    const t0 = 6.0 + i * 1.9, lt = t - t0;
    const [icon, dept] = SET[i];
    const main = ov.querySelector('.main'), ghost = ov.querySelector('.ghost');
    if (main.dataset.icon !== icon) {
      main.dataset.icon = ghost.dataset.icon = icon;
      main.innerHTML = ghost.innerHTML = window.AA_ICONS[icon];
      main.querySelectorAll('svg *').forEach((el) => { if (el.getTotalLength) { const L = el.getTotalLength(); el.dataset.len = L; el.style.strokeDasharray = L; } });
      const d = S.$$('#deptGrid .dept')[dept];
      ov.querySelector('.cap b').textContent = d.querySelector('.dept-code span').textContent + ' · ' + (d.querySelector('.dept-code b').textContent || '');
      ov.querySelector('.cap h3').textContent = d.querySelector('h3').textContent;
      ov.querySelector('.cap p').textContent = d.querySelector('p').textContent;
      const huds = ov.querySelectorAll('.hud');
      huds[0].innerHTML = `Schematic ${String(i + 1).padStart(2, '0')}/06<br>Platform · ${icon}<br>Vril field · stable`;
      huds[1].innerHTML = `Hyperborean steel<br>Agarthan engineering<br>Federally licensed`;
    }
    const draw = ease.out(seg(lt, 0.0, 1.0));
    main.querySelectorAll('svg *').forEach((el, k) => { if (el.dataset.len) { const L = +el.dataset.len; const p = Math.min(1, Math.max(0, draw * 1.35 - k * 0.012)); el.style.strokeDashoffset = L * (1 - p); } });
    const spin = Math.sin(lt * 1.3) * 26 + (i === SET.length - 1 ? 40 * seg(t, 16.0, 17.6) : 0);
    const out = seg(lt, 1.6, 1.9) * (i < SET.length - 1 ? 1 : 0);
    const tf = `rotateY(${spin}deg) rotateX(${6 * Math.sin(lt * 0.9)}deg) scale(${0.92 + 0.08 * draw + 0.25 * out})`;
    main.style.transform = tf; ghost.style.transform = tf + ' translateZ(-60px)';
    main.style.opacity = 1 - out; ghost.style.opacity = 0.35 * draw * (1 - out);
    ov.querySelector('.cap').style.opacity = seg(lt, 0.2, 0.6) * (1 - out);
    ov.querySelector('.scanl').style.top = (600 * ((lt * 0.7) % 1)) + 'px';
    ov.querySelector('.ring').style.transform = `scale(${1 + 0.06 * Math.sin(t * 3)})`;
  }
  at('featured', 18.0, () => document.querySelector('#featuredGrid').scrollIntoView({ block: 'center' }));
}

function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const u = { sky: [0.6, 1, 1], bloom: 0.5, glow: 0.7, grain: 0.018, accent: [0.365, 1, 0.61], accent2: [0.84, 1, 0.365], chroma: 0.0015, trails: 0.2 };
  if (t < 5.8) {
    u.cam = [1, lerp(-10, 6, sm(seg(0, 5.8))), 4 * Math.sin(t * 0.5)];
    u.zoom = 1.02;
  } else if (t < 17.6) {
    const mand = sm(seg(15.6, 17.4));
    u.cam = [1, 0, 0];
    u.trails = 0.45 + 0.25 * mand; u.chroma = 0.003 + 0.004 * mand; u.warp = 0.003 + 0.01 * mand;
    u.kaleido = 0.7 * mand; u.kalN = 6;
    u.hue = 30 * mand * Math.sin(t * 0.8);
    u.glow = 0.9;
  } else {
    // into the crystal tunnel walled with the featured cards, and out into the line
    const tin = sm(seg(17.6, 18.4)), sun = sm(seg(19.4, 21.2)), out = sm(seg(21.0, 21.8));
    u.kaleido = 0.7 * (1 - tin);
    u.tunnel = [tin * (1 - out), (t - 17.6) * (1.8 + 2.5 * sun), 0.25, 0.6 + 2.2 * sun];
    u.trails = 0.4; u.chroma = 0.003; u.hue = 10 * Math.sin(t);
    u.page = 1 - out;
    u.white = 0.55 * Math.exp(-Math.max(0, t - 21.2) * 2.5) * (t > 21.2 ? 1 : 0) * 1;
    u.sky = [0.9 * out, 1, 1.1];
    const e = sm(seg(21.2, 22.6));
    u.plates = [{ i: 0, x: 0, y: 0.02, h: lerp(0.3, 0.42, sm(seg(21.2, 24))), a: e, glow: 0.3 }];
  }
  return u;
}

export default {
  key: 'arsenal',
  poster: 8.6,
  title: 'Hyperborean Arsenal — the six vaults and their holograms, down a crystal tunnel to the line',
  dur: 24,
  url: '/index.html',
  prefs: { theme: 'vril', cursor: 'tictac' },
  act,
  lens,
  plates: ['tagline'],
  cues: [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 0.6 + i * 0.8, kind: 'hover' })),
    { t: 5.6, kind: 'dim' },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 6.0 + i * 1.9, kind: 'holo' })),
    { t: 15.6, kind: 'mandala' }, { t: 17.6, kind: 'tunnel' }, { t: 21.2, kind: 'line' },
  ],
};
