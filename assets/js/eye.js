/* =============================================================================
 * eye.js — the eye in the wall (assets/img/eye/geode-eye.webp, cut from the client's
 * "geode eye" photograph) and the way to the forbidden knowledge behind it.
 *
 * [data-eye] elements get a WebGL canvas that animates the photograph procedurally, in a
 * shader over the image itself rather than a video:
 *   look     the slit pupil drifts toward the pointer (and wanders when nobody points)
 *   dilate   it breathes, and opens wide when the pointer is on it
 *   blink    lids close along the eye's own almond, every few seconds, sometimes twice
 *   glint    the amethyst points sparkle, a few at a time
 *   aura     a glow round the stone in the realm's own colour, pulsing
 * The hero's eye is pinned to the gate in the ice wall (assets/img/ice-wall.svg, gate at
 * 800,330 in its 1600×516 box) at any screen size.
 *
 * Degrades: no WebGL keeps the photograph with a CSS glow; reduced motion draws one still
 * frame; nothing animates while the eye is off screen or the tab is hidden.
 * ===========================================================================*/
(function () {
  'use strict';
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // measured off the cut-out: pupil slit centre, and the iris it sits in (fractions of the image)
  const PUPIL = [0.5, 0.58], IRIS = [0.41, 0.35];

  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `precision mediump float;
  varying vec2 v;
  uniform sampler2D T;
  uniform float uT, uDil, uBlink, uHover, uMotion;
  uniform vec2 uLook;
  uniform vec3 uAcc;
  uniform vec4 uBox;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec2 iu = (v - uBox.xy) / (uBox.zw - uBox.xy);
    iu.y = 1.0 - iu.y;
    vec2 c = vec2(${PUPIL[0].toFixed(3)}, ${PUPIL[1].toFixed(3)});
    // the pupil looks: sample away from the look direction inside the iris, fading to nothing at its edge
    vec2 d = (iu - c) / vec2(${IRIS[0].toFixed(3)}, ${IRIS[1].toFixed(3)});
    // separable, so the slit shifts as a straight line instead of bending
    float fall = smoothstep(1.0, 0.35, abs(d.x)) * smoothstep(1.05, 0.72, abs(d.y));
    vec2 su = iu - uLook * vec2(0.085, 0.045) * fall;
    // and dilates: near the slit, sample closer to its centre line, so the slit reads wider
    float near = exp(-pow((su.x - c.x) / 0.1, 2.0)) * smoothstep(0.42, 0.12, abs(su.y - c.y));
    su.x = c.x + (su.x - c.x) / mix(1.0, uDil, near);
    vec4 col = (su.x < 0.0 || su.x > 1.0 || su.y < 0.0 || su.y > 1.0) ? vec4(0.0) : texture2D(T, su);
    float lum = dot(col.rgb, vec3(0.3, 0.59, 0.11));
    // glints on the bright crystal points, a few at a time
    vec2 cell = floor(su * vec2(240.0, 140.0));
    float n = hash(cell);
    float tw = pow(max(0.0, sin(uT * (1.6 + 2.4 * n) + n * 60.0)), 40.0) * step(0.82, hash(cell + 7.1));
    col.rgb += tw * smoothstep(0.3, 0.75, lum) * 1.1 * col.a * uMotion;
    // the slit holds a light of its own, in the realm's colour
    float pg = exp(-pow((iu.x - c.x - uLook.x * 0.085) / 0.04, 2.0)) * smoothstep(0.3, 0.0, abs(iu.y - c.y) - 0.02);
    col.rgb += uAcc * pg * (0.18 + 0.4 * uHover + 0.12 * sin(uT * 2.0) * uMotion) * col.a;
    // the lids: the opening at x is the eye's own almond, closing toward its middle line
    float hx = 0.5 * pow(max(0.0, 1.0 - pow((iu.x - 0.5) / 0.5, 2.0)), 0.5);
    float open = hx * (1.0 - uBlink);
    float dy = abs(iu.y - 0.5);
    float shut = smoothstep(open - 0.012, open + 0.004, dy) * step(0.001, uBlink);
    vec3 lid = mix(vec3(0.05, 0.04, 0.08), uAcc * 0.35, 0.25);
    float rim = exp(-pow((dy - open) / 0.008, 2.0)) * step(0.001, uBlink);
    col.rgb = mix(col.rgb, lid * col.a, shut) + uAcc * rim * 0.8 * col.a;
    // the aura round the stone
    float e = length((iu - vec2(0.5, 0.5)) / vec2(0.5, 0.47));
    float aura = exp(-max(e - 0.9, 0.0) * 6.5) * (1.0 - col.a) * (0.32 + 0.12 * sin(uT * 1.3) * uMotion + 0.3 * uHover);
    vec3 rgb = col.rgb + uAcc * aura;
    float a = col.a + aura * (1.0 - col.a);
    gl_FragColor = vec4(rgb, a);
  }`;

  function accent() {
    const cs = getComputedStyle(document.documentElement);
    const rgb = (cs.getPropertyValue('--accent-rgb') || '93, 228, 255').split(',').map((x) => parseFloat(x) / 255);
    return rgb.length === 3 && rgb.every((x) => isFinite(x)) ? rgb : [0.36, 0.89, 1];
  }

  function mount(host) {
    const img = host.querySelector('img');
    const cv = document.createElement('canvas');
    cv.className = 'eye-gl'; cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    const gl = cv.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true });
    if (!gl) { cv.remove(); host.classList.add('eye-still'); return null; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); } catch (e) { cv.remove(); host.classList.add('eye-still'); return null; }
    gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['T', 'uT', 'uDil', 'uBlink', 'uHover', 'uMotion', 'uLook', 'uAcc', 'uBox'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // motion state
    let look = [0, 0], target = [0, 0], lastPointer = -1e9, nextSaccade = 0, hover = 0, hoverTarget = 0;
    let blinkAt = performance.now() + 2200, blinkTwice = false;
    const rnd = (k) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    let running = false, visible = true, raf = 0, last = performance.now();
    let ready = false, acc = accent();
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); ready = true; host.classList.add('eye-live'); frame(performance.now()); };
    const PAD = 0.18;
    function size() {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(2, Math.round(r.width * (1 + 2 * PAD) * dpr));
      cv.height = Math.max(2, Math.round(r.height * (1 + 2 * PAD) * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
    }
    size();
    if (img.complete && img.naturalWidth) upload(); else img.addEventListener('load', upload, { once: true });
    // the realm can change under it
    new MutationObserver(() => { acc = accent(); if (!running) frame(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    new ResizeObserver(() => { size(); if (!running) frame(performance.now()); }).observe(host);

    window.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / Math.max(260, r.width * 1.4);
      const dy = (e.clientY - (r.top + r.height / 2)) / Math.max(200, r.height * 2.2);
      const m = Math.hypot(dx, dy);
      target = m > 1 ? [dx / m, dy / m] : [dx, dy];
      lastPointer = performance.now();
    }, { passive: true });
    host.addEventListener('pointerenter', () => { hoverTarget = 1; });
    host.addEventListener('pointerleave', () => { hoverTarget = 0; });
    host.addEventListener('focus', () => { hoverTarget = 1; });
    host.addEventListener('blur', () => { hoverTarget = 0; });

    function blinkAmount(now) {
      const d = now - blinkAt;
      if (d < 0) return 0;
      const one = (x) => (x < 110 ? x / 110 : x < 150 ? 1 : x < 320 ? 1 - (x - 150) / 170 : 0);
      if (d < 330) return one(d);
      if (blinkTwice && d > 380 && d < 710) return one(d - 380);
      if (d > (blinkTwice ? 720 : 340)) { const k = now / 997; blinkAt = now + 3200 + rnd(k) * 5200; blinkTwice = rnd(k + 3) > 0.72; }
      return 0;
    }
    function frame(now) {
      if (!ready) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const t = now / 1000;
      if (!reduced) {
        // nobody pointing: the eye looks about on its own
        if (now - lastPointer > 2600 && now > nextSaccade) {
          const k = Math.floor(now / 1300);
          target = [(rnd(k) - 0.5) * 1.4, (rnd(k + 1.7) - 0.5) * 0.9];
          nextSaccade = now + 1100 + rnd(k + 9) * 1700;
        }
        const ease = 1 - Math.exp(-dt * 7);
        look = [look[0] + (target[0] - look[0]) * ease, look[1] + (target[1] - look[1]) * ease];
        hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 5));
      }
      // where the photograph sits inside the padded canvas
      const bx0 = PAD / (1 + 2 * PAD), bx1 = 1 - bx0;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.T, 0);
      gl.uniform1f(U.uT, reduced ? 0 : t);
      gl.uniform1f(U.uDil, reduced ? 1 : 1 + 0.16 * Math.sin(t * 0.8) + 1.1 * hover);
      gl.uniform1f(U.uBlink, reduced ? 0 : blinkAmount(now));
      gl.uniform1f(U.uHover, hover);
      gl.uniform1f(U.uMotion, reduced ? 0 : 1);
      gl.uniform2f(U.uLook, reduced ? 0 : look[0], reduced ? 0 : look[1]);
      gl.uniform3f(U.uAcc, acc[0], acc[1], acc[2]);
      gl.uniform4f(U.uBox, bx0, bx0, bx1, bx1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function loop(now) { frame(now); if (running) raf = requestAnimationFrame(loop); }
    function sync() {
      const go = ready && visible && !document.hidden && !reduced;
      if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
      if (!go && running) { running = false; cancelAnimationFrame(raf); }
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(host);
    document.addEventListener('visibilitychange', sync);
    img.addEventListener('load', sync);
    if (img.complete) setTimeout(sync, 0);
    return { size };
  }

  /* ---------- the hero's eye sits on the gate in the ice wall ---------- */
  function pinToGate(host) {
    const hero = host.closest('.hero'), wall = hero && hero.querySelector('.wall');
    if (!wall) return;
    const VB = [1600, 516], GATE = [800, 330], WIDTH = 330;
    function place() {
      const hr = hero.getBoundingClientRect(), wr = wall.getBoundingClientRect();
      if (!wr.width || !wr.height) return;
      // the wall is drawn object-fit: cover, anchored at its bottom centre
      const s = Math.max(wr.width / VB[0], wr.height / VB[1]);
      const x0 = wr.left + (wr.width - VB[0] * s) / 2, y0 = wr.bottom - VB[1] * s;
      let w = Math.max(120, WIDTH * s), y = y0 + GATE[1] * s - hr.top;
      // the gate rides up on a short, wide screen; the eye must not sit on the buttons
      const cta = hero.querySelector('.hero-cta');
      const floor = cta ? cta.getBoundingClientRect().bottom - hr.top + 22 : 0;
      const ceil = hr.height - 56;                       // clear of the scroll cue
      if (y - (w * 520 / 882) / 2 < floor) {
        const room = Math.max(60, ceil - floor);
        w = Math.min(w, Math.max(120, room * 882 / 520));
        y = floor + (w * 520 / 882) / 2;
      }
      host.style.width = w + 'px';
      host.style.left = (x0 + GATE[0] * s - hr.left) + 'px';
      host.style.top = y + 'px';
    }
    place();
    new ResizeObserver(place).observe(hero);
    wall.addEventListener('load', place);
  }

  function boot() {
    document.querySelectorAll('[data-eye]').forEach((host) => {
      if (host.dataset.eye === 'gate') pinToGate(host);
      try { mount(host); } catch (e) { host.classList.add('eye-still'); if (window.console) console.warn('eye:', e && e.message); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
