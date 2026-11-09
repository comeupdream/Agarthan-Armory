/*
 * HYPERBOREAN ARSENAL — the vaults, their holograms, and the line the site opens with.
 *
 * In the Vril realm the pointer sweeps the six departments (the real hover: each card
 * lifts and runs its scan line). Then the page dims and the site's own holo schematics
 * (assets/js/icons.js) assemble at full size one after another, line by line, turning
 * on a pedestal of light with each department's name and words from the page. The
 * last is mirrored into a mandala, the lens falls into a crystal tunnel walled with the
 * featured cards, and the site's tagline comes out of its light. No store photos.
 *
 * The line burns at its peak and goes back into the dark; then the brand itself is
 * projected onto the pedestal, a hologram scanned up out of the light — the seal, the
 * name and the licence line — and re-scanned through the scripts: Future, Runic, a
 * flash of Old World, and Future again, before the room goes dark. No Ancient Tech.
 */

// the hologram's re-scans, in film seconds: [t, font]; it starts in Future
export const RESCANS = [[26.6, 'runic'], [28.0, 'oldworld'], [29.1, 'future']];

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

  /* ---------- the brand: a hologram on the pedestal, re-scanned through the scripts ---------- */
  // the scripts are only fetched when first used; ask for them early so no frame waits
  at('fonts', 0, () => ['900 120px Orbitron', '900 120px "Cinzel Decorative"', '400 120px "Uncial Antiqua"'].forEach((f) => document.fonts.load(f)));
  // (the act runs inside the page, so it carries its own copy of RESCANS)
  const SCANS = [[26.6, 'runic'], [28.0, 'oldworld'], [29.1, 'future']];
  const SCAN_DUR = 0.5;
  let br = document.getElementById('__brand');
  if (!br && t >= 23.4) {
    br = document.createElement('div'); br.id = '__brand';
    const lock = `<h2 class="nm"><span class="l1">Agarthan</span><span class="l2">Armory</span></h2>`;
    br.innerHTML = `<style>
      #__brand{position:fixed;inset:0;z-index:2147482100;pointer-events:none;display:grid;place-items:center;background:radial-gradient(70% 60% at 50% 48%,#05190f,#010604);color:var(--cyan)}
      #__brand .bst{position:relative;width:1500px;height:900px;perspective:1600px}
      #__brand .ped{position:absolute;left:50%;bottom:20px;width:1000px;height:130px;margin-left:-500px;border-radius:50%;
        background:radial-gradient(50% 50% at 50% 50%,rgba(93,255,177,.34),rgba(93,228,255,.08) 60%,transparent 72%);box-shadow:0 0 0 1px rgba(160,255,210,.25) inset}
      #__brand .ring{position:absolute;left:50%;bottom:44px;width:820px;height:86px;margin-left:-410px;border-radius:50%;border:1px solid rgba(180,255,220,.5)}
      #__brand .cone{position:absolute;left:50%;bottom:86px;width:1100px;height:760px;margin-left:-550px;
        background:linear-gradient(0deg,rgba(93,255,177,.16),rgba(93,228,255,.05) 55%,transparent);clip-path:polygon(32% 100%,68% 100%,100% 0,0 0)}
      #__brand .holo{position:absolute;inset:0 0 120px;display:flex;flex-direction:column;align-items:center;justify-content:center}
      #__brand .bseal{width:250px;height:250px;margin-bottom:28px;filter:drop-shadow(0 0 22px rgba(var(--accent-rgb),.8)) drop-shadow(0 0 3px #fff)}
      #__brand .lock{position:relative;width:1500px;height:300px}
      #__brand .lay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
      #__brand .nm{margin:0;text-align:center;line-height:.95;color:transparent;-webkit-background-clip:text;background-clip:text;
        background-image:linear-gradient(180deg,#ffffff 0%,var(--frost) 42%,var(--cyan) 100%);filter:drop-shadow(0 0 18px rgba(var(--accent-rgb),.55))}
      #__brand .nm span{display:block}
      #__brand .nm .l2{font-size:.5em;letter-spacing:.5em;padding-left:.5em;margin-top:.2em}
      #__brand .f-future .nm{font:900 132px/.95 Orbitron,sans-serif;letter-spacing:.06em;text-transform:uppercase}
      #__brand .f-runic .nm{font:900 150px/.95 'Cinzel Decorative',serif;letter-spacing:.03em}
      #__brand .f-oldworld .nm{font:400 150px/.95 'Uncial Antiqua',serif;letter-spacing:.02em}
      #__brand .ml{margin-top:30px;font:400 26px/1.4 var(--f-mono);letter-spacing:.42em;text-transform:uppercase;color:var(--aurora);text-shadow:0 0 14px rgba(var(--accent-rgb),.7)}
      #__brand .scan{position:absolute;left:-80px;right:-80px;height:3px;background:linear-gradient(90deg,transparent,#e8fff4 20%,#fff 50%,#e8fff4 80%,transparent);box-shadow:0 0 22px var(--aurora),0 0 4px #fff}
      #__brand .lines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 2px,transparent 2px 5px);mix-blend-mode:multiply}
    </style>
    <div class="bst"><div class="cone"></div><div class="ped"></div><div class="ring"></div>
      <div class="holo">
        <span class="seal bseal"><img src="assets/img/brand/seal-600.png" alt=""></span>
        <div class="lock"><div class="lay la f-future">${lock}</div><div class="lay lb f-future">${lock}</div><div class="scan rs"></div></div>
        <div class="ml">Federally licensed · beyond the wall</div>
        <div class="lines"></div><div class="scan up"></div>
      </div></div>`;
    document.body.appendChild(br);
  }
  if (br) {
    const holo = br.querySelector('.holo');
    // the hologram comes up out of the pedestal's light, bottom first
    const up = ease.inOut(seg(t, 24.6, 26.0));
    holo.style.clipPath = `inset(${(1 - up) * 100}% 0 0 0)`;
    const upLine = br.querySelector('.scan.up');
    upLine.style.top = `calc(${(1 - up) * 100}% - 2px)`; upLine.style.opacity = up > 0 && up < 1 ? 1 : 0;
    // a hologram's faint unsteadiness (small, slow: no flashing)
    holo.style.opacity = String(0.9 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    const seal = br.querySelector('.bseal');
    seal.style.transform = `rotateY(${18 * Math.sin(t * 0.9)}deg) rotateX(${4 * Math.sin(t * 0.6)}deg)`;
    br.querySelector('.ring').style.transform = `scale(${1 + 0.05 * Math.sin(t * 2.6)})`;
    br.querySelector('.cone').style.opacity = String(0.55 + 0.45 * up);
    // the re-scans: the new script is drawn down from the top, over the old one
    const F = ['future', ...SCANS.map(([, f]) => f)];
    let n = 0; for (const [tc] of SCANS) if (t >= tc) n++;
    const p = n > 0 ? seg(t, SCANS[n - 1][0], SCANS[n - 1][0] + SCAN_DUR) : 1;
    const la = br.querySelector('.la'), lb = br.querySelector('.lb'), rs = br.querySelector('.scan.rs');
    if (p < 1) {
      la.className = 'lay la f-' + F[n - 1]; lb.className = 'lay lb f-' + F[n];
      const q = ease.inOut(p);
      lb.style.clipPath = `inset(0 0 ${(1 - q) * 100}% 0)`; la.style.clipPath = `inset(${q * 100}% 0 0 0)`;
      lb.style.display = ''; rs.style.top = `calc(${q * 100}% - 1px)`; rs.style.opacity = 1;
    } else {
      la.className = 'lay la f-' + F[n]; la.style.clipPath = ''; lb.style.display = 'none'; rs.style.opacity = 0;
    }
  }
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
  } else if (t < 24.0) {
    // into the crystal tunnel walled with the featured cards, and out into the line
    const tin = sm(seg(17.6, 18.4)), sun = sm(seg(19.4, 21.2)), out = sm(seg(21.0, 21.8));
    // PEAK 21.2-22.4: the line burns its brightest, the sky mirrored round it; COME DOWN to 23.8
    const peak = sm(seg(21.2, 21.8)) * (1 - sm(seg(22.4, 23.4)));
    u.kaleido = 0.7 * (1 - tin) + 0.45 * peak; u.kalN = 6 + 2 * peak;
    u.tunnel = [tin * (1 - out), (t - 17.6) * (1.8 + 2.5 * sun), 0.25, 0.6 + 2.2 * sun];
    u.trails = 0.4 + 0.3 * peak; u.chroma = 0.003 + 0.004 * peak; u.hue = 10 * Math.sin(t) + 45 * peak * Math.sin(t * 1.1);
    u.page = 1 - out;
    u.white = 0.55 * Math.exp(-Math.max(0, t - 21.2) * 2.5) * (t > 21.2 ? 1 : 0);
    u.sky = [0.9 * out, 1, 1.1];
    u.bloom = 0.5 + 0.3 * peak;
    const e = sm(seg(21.2, 22.6)) * (1 - sm(seg(22.9, 23.8)));
    u.plates = [{ i: 0, x: 0, y: 0.02, h: lerp(0.3, 0.42, sm(seg(21.2, 24))), a: e, glow: 0.3 + 0.5 * peak }];
  } else {
    // the brand, a hologram on its pedestal, re-scanned through the scripts; then dark
    u.page = sm(seg(24.0, 24.8));
    u.sky = [0.9, 1, 1.1];
    const settle = sm(seg(24.0, 26.0));
    u.cam = [1, 3 * Math.sin(t * 0.35) * (1 - 0.5 * settle), 1.5 * Math.sin(t * 0.27)];
    u.zoom = 1.03 + 0.05 * sm(seg(25.0, 32.0));
    let jolt = 0;
    for (const [tc] of RESCANS) if (t >= tc) jolt = Math.max(jolt, Math.exp(-(t - tc) * 4));
    u.trails = 0.3 + 0.2 * jolt; u.chroma = 0.0015 + 0.006 * jolt; u.warp = 0.004 * jolt;
    u.bloom = 0.45; u.glow = 0.75;
    u.black = sm(seg(31.2, 32.0));
  }
  return u;
}

export default {
  key: 'arsenal',
  poster: 8.6,
  title: 'Hyperborean Arsenal — the six vaults and their holograms, down a crystal tunnel to the line',
  dur: 32,
  url: '/index.html',
  prefs: { theme: 'vril', cursor: 'tictac', font: 'future' },
  act,
  lens,
  plates: ['tagline@future@vril'],
  cues: [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 0.6 + i * 0.8, kind: 'hover' })),
    { t: 5.6, kind: 'dim' },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 6.0 + i * 1.9, kind: 'holo' })),
    { t: 15.6, kind: 'mandala' }, { t: 17.6, kind: 'tunnel' }, { t: 21.2, kind: 'line' },
    { t: 21.2, kind: 'peak' }, { t: 22.4, kind: 'down' }, { t: 24.0, kind: 'calm' }, { t: 24.6, kind: 'logo' },
    ...RESCANS.map(([t, font]) => ({ t, kind: 'rescan', font })),
  ],
};
