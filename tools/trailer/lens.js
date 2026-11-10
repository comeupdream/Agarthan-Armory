/* =============================================================================
 * lens.js — Stage B, the trip: a WebGL2 compositor over the filmed site.
 *
 * render.mjs opens lens.html?film=<key>&w=&h= and, for every frame, calls
 * __lens.frame(f, t, u): f is the Stage A frame to read from .trailer-cache/<key>/a/,
 * u the film's lens(t) — the knobs below. Nothing here reads a clock or calls
 * Math.random, so a frame is a function of (frame image, t, u); the only state is
 * the previous output, for the trails, and render.mjs always runs a film in order.
 *
 *   cam [dolly 0→1, turn°, tilt°]   the page as a plane in space (1 = fills the frame)
 *   zoom, pan [x, y]                 2D camera on the page
 *   wipe 0→1, held f, wipeKind       repaint from frame `held` (1 scan line, 2 glitch slices)
 *   hue°, sat, warp, chroma          colour drift, liquid displacement, RGB split
 *   trails 0→1                       lighten-feedback of the last frame, zoomed and hue-turned
 *   kaleido 0→1, kalN                mirror the frame into kalN wedges
 *   bh [x, y, shadow r, einstein r]  a black hole lensing everything behind it
 *   disk [glow, flatten, phase, outer], swirl
 *   tunnel [mix, depth, twist, sun]  the page wrapped round a tunnel, a sun at its end
 *   sky [aurora, stars, nebula], page (opacity), accent, accent2
 *   bloom, white, black, grain
 *   breathe [amount, phase]          the page's art swells and settles (the trip's breathing surface)
 *   edge [amount, echoes, spread, phase]  the art's own outlines, echoed outward in colour and
 *                                    pulsing with the phase: tracers round the edges of the art
 *   bubble [amount, scale, drift]    the print melting into gooey psychedelic bubbles that keep
 *                                    the picture's colours
 *   plates [{i, x, y, h, rot, a, add}]  images (wordmark…) drawn over, in screen units
 * ===========================================================================*/
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const FILM = qs.get('film');
  const W = +qs.get('w') || 1920, H = +qs.get('h') || 1080;
  const cv = document.getElementById('c');
  cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('no webgl2');

  const VS = `#version 300 es
  in vec2 aP; out vec2 vUV;
  void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

  const COMMON = `#version 300 es
  precision highp float;
  in vec2 vUV; out vec4 o;
  uniform vec2 uRes; uniform float uT;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
  vec3 hueRot(vec3 c, float deg){
    mat3 Y = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    mat3 R = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
    vec3 q = Y * c; float h = atan(q.z, q.y) + radians(deg); float ch = length(q.yz);
    q.yz = ch * vec2(cos(h), sin(h)); return R * q; }
  `;

  const FS_SCENE = COMMON + `
  uniform sampler2D uPage, uHeld, uPrev;
  uniform vec3 uCam; uniform float uZoom; uniform vec2 uPan;
  uniform float uWipe, uWipeKind, uHasHeld;
  uniform float uHue, uSat, uWarp, uChroma, uTrails, uKal, uKalN, uBloom, uPageA;
  uniform vec4 uBH, uDisk, uTun; uniform float uSwirl;
  uniform vec3 uSky, uAcc, uAcc2;
  uniform vec4 uEdge; uniform vec2 uBreathe; uniform vec3 uBubble;
  float A;

  vec3 space(vec2 p){
    vec3 c = vec3(0.004, 0.009, 0.02);
    if (uSky.z > 0.0) {
      float n = fbm(p * 1.4 + vec2(uT * 0.012, 0.0));
      float n2 = fbm(p * 2.7 - vec2(0.0, uT * 0.017) + 7.3);
      c += uSky.z * (uAcc * 0.16 * smoothstep(0.42, 0.95, n) + uAcc2 * 0.12 * smoothstep(0.5, 1.0, n2));
    }
    if (uSky.y > 0.0) {
      for (int L = 0; L < 2; L++) {
        float sc = L == 0 ? 90.0 : 190.0;
        vec2 g = p * sc + float(L) * 31.7; vec2 id = floor(g), f = fract(g) - 0.5;
        float h = hash(id);
        if (h > 0.93) {
          vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
          float d = length(f - off);
          float tw = 0.6 + 0.4 * sin(uT * (1.5 + 3.0 * h) + h * 60.0);
          c += uSky.y * tw * (L == 0 ? 1.3 : 0.6) * (smoothstep(0.12, 0.0, d) + 0.25 * smoothstep(0.35, 0.0, d)) * mix(vec3(0.85, 0.93, 1.0), uAcc, 0.3);
        }
      }
    }
    if (uSky.x > 0.0) {
      // aurora: two folded curtains, rays rising from a wandering hem, green at the hem
      // and the realm's accent above
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float fold = fbm(vec2(p.x * 0.7 + uT * 0.025 + fk * 4.1, uT * 0.02 + fk));
        float hem = 0.12 + 0.09 * fk + 0.08 * sin(p.x * (1.6 + fk * 0.7) + uT * (0.13 + fk * 0.05) + fold * 6.0);
        float d = p.y - hem;
        float rays = 0.25 + 0.75 * pow(noise(vec2(p.x * (70.0 + fk * 40.0) + fold * 30.0, uT * 0.3 + fk * 9.0)), 1.6);
        float a = smoothstep(-0.006, 0.012, d) * exp(-max(d, 0.0) * (6.0 + fk * 3.0)) * rays * (1.0 - 0.35 * fk);
        vec3 ac = mix(uAcc2, uAcc, smoothstep(0.0, 0.16, d));
        c += uSky.x * a * ac * 1.1;
      }
    }
    return c;
  }

  vec3 samplePage(vec2 uv, float lod){
    vec3 c = textureLod(uPage, uv, lod).rgb;
    if (uWipe >= 0.0 && uHasHeld > 0.5) {
      vec3 h = textureLod(uHeld, uv, lod).rgb;
      float line = uWipe * 1.12 - 0.06;
      float m = uWipeKind < 1.5 ? step(uv.y, line) : step(hash(vec2(floor(uv.y * 26.0), floor(uWipe * 10.0))), uWipe);
      c = mix(h, c, m);
    }
    return c;
  }
  // ---- the trip's surface: breathing, tracers round the edges of the art, bubble print ----
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }
  float lumAt(vec2 uv){ return dot(textureLod(uPage, uv, 1.2).rgb, vec3(0.299, 0.587, 0.114)); }
  float edgeAt(vec2 uv){
    vec2 px = 2.6 / uRes;   // read a little blurred and wide, so an outline has some body
    float l = lumAt(uv - vec2(px.x, 0.0)), r = lumAt(uv + vec2(px.x, 0.0));
    float d = lumAt(uv - vec2(0.0, px.y)), u = lumAt(uv + vec2(0.0, px.y));
    return length(vec2(r - l, u - d));
  }
  // the art's outlines, echoed outward from the middle of the frame, each echo a step round the
  // colour wheel and fainter; the spread swells and settles with the phase, so the edges breathe.
  // Returns the echoes' colour and how much of them there is, to be painted on, never added as light.
  vec4 edgeTrace(vec2 uv){
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float spread = uEdge.z * (0.55 + 0.45 * sin(uEdge.w));
    for (int k = 0; k < 9; k++) {
      float fk = float(k);
      if (fk >= uEdge.y) break;
      vec2 q = 0.5 + (uv - 0.5) * (1.0 - spread * fk);
      float e = smoothstep(0.035, 0.2, edgeAt(q));
      float pulse = 0.65 + 0.35 * sin(uEdge.w * 2.0 - fk * 0.9);
      float wk = e * (1.0 - fk / max(uEdge.y, 1.0)) * pulse;
      acc += wk * pal(fk * 0.11 + uT * 0.09); wsum += wk;
    }
    return vec4(acc / max(wsum, 1e-3), wsum);
  }
  // metaball bubbles on a drifting cell grid: each cell's size and colour come from the picture
  // under it, so the print melts into bubbles of its own colours, rimmed in shifting colour
  vec3 bubbles(vec2 uv){
    float ar = uRes.x / uRes.y;
    vec2 drift = vec2(uT * 0.04, -uT * 0.025) * uBubble.z;
    vec2 p = uv * vec2(ar, 1.0) * uBubble.y + drift;
    vec2 ip = floor(p), fp = fract(p);
    float field = 0.0; vec3 fc = vec3(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash(ip + g), hash(ip + g + 7.31));
      o = 0.5 + 0.36 * sin(uT * 0.7 + 6.2831853 * o);
      vec2 cuv = ((ip + g + o) - drift) / uBubble.y / vec2(ar, 1.0);
      vec3 pc = textureLod(uPage, clamp(cuv, 0.0, 1.0), 2.5).rgb;
      float l = dot(pc, vec3(0.299, 0.587, 0.114));
      float r = 0.2 + 0.55 * l;
      float d = length(g + o - fp);
      float m = r * r / (d * d + 0.002);
      field += m; fc += m * pc;
    }
    vec3 base = fc / max(field, 1e-3);
    float inside = smoothstep(0.9, 1.3, field);
    float rim = smoothstep(0.75, 0.95, field) * (1.0 - smoothstep(0.95, 1.2, field));
    vec3 psy = pal(dot(base, vec3(0.3, 0.55, 0.15)) * 1.7 + uT * 0.07);
    vec3 body = base * 0.35 + psy * 0.5;
    return mix(base * 0.2, body, inside) + rim * psy * 0.75;
  }
  vec3 pageColor(vec2 uv){
    if (uBreathe.x > 0.0) {
      // the surface swells and settles, with a slow ripple running out from the middle
      vec2 cq = uv - 0.5;
      float r = length(cq * vec2(A, 1.0));
      uv = 0.5 + cq * (1.0 - 0.045 * uBreathe.x * sin(uBreathe.y)) + normalize(cq + 1e-5) * 0.006 * uBreathe.x * sin(r * 26.0 - uBreathe.y * 2.0);
    }
    vec2 dir = (uv - 0.5) * uChroma;
    vec3 c;
    if (uChroma > 0.0) c = vec3(samplePage(uv + dir, 0.0).r, samplePage(uv, 0.0).g, samplePage(uv - dir, 0.0).b);
    else c = samplePage(uv, 0.0);
    // the trip needs room: a pale print is brought down to the middle tones before anything is painted on it
    float fx = max(uEdge.x, uBubble.x);
    if (fx > 0.0) c *= 1.0 - 0.45 * fx;
    if (uBubble.x > 0.0) c = mix(c, bubbles(uv), uBubble.x);
    if (uBloom > 0.0) {
      vec3 b = textureLod(uPage, uv, 4.0).rgb * 0.6 + textureLod(uPage, uv, 6.0).rgb * 0.6;
      c += max(b - 0.28, 0.0) * uBloom * 1.8;
    }
    if (uEdge.x > 0.0) { vec4 et = edgeTrace(uv); c = mix(c, et.rgb * 1.15, clamp(et.a * 1.3, 0.0, 1.0) * uEdge.x); }
    return c;
  }

  // the page as a plane in space, seen from a pinhole camera
  vec3 scene(vec2 p){
    vec2 sp = p / uZoom - uPan;
    float D = mix(3.6, 1.0, uCam.x);
    vec3 ro = vec3(0.0, 0.0, D), rd = vec3(sp, -1.0);
    float ay = radians(uCam.y), ax = radians(uCam.z);
    mat3 Ry = mat3(cos(ay), 0.0, -sin(ay), 0.0, 1.0, 0.0, sin(ay), 0.0, cos(ay));
    mat3 Rx = mat3(1.0, 0.0, 0.0, 0.0, cos(ax), sin(ax), 0.0, -sin(ax), cos(ax));
    mat3 Ri = transpose(Ry * Rx);
    vec3 o2 = Ri * ro, d2 = Ri * rd;
    float th = -o2.z / d2.z;
    vec3 hit = o2 + th * d2;
    vec2 uv = vec2(hit.x / A + 0.5, 0.5 - hit.y);
    if (uWipe >= 0.0 && uWipeKind > 1.5) {
      float sl = floor(uv.y * 26.0);
      uv.x += (hash(vec2(sl, floor(uWipe * 10.0) + 3.0)) - 0.5) * 0.07 * sin(3.14159 * uWipe);
    }
    if (th <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      // a faint frame of light where the page's edge would be
      float e = max(max(-uv.x, uv.x - 1.0), max(-uv.y, uv.y - 1.0));
      return space(p) + uAcc * 0.35 * exp(-e * 140.0) * step(0.0, th) * step(0.001, 1.0 - uCam.x) * uPageA;
    }
    // the sky is only worked out where some of it shows through
    vec3 bg = uPageA < 0.999 ? space(p) : vec3(0.0);
    vec3 c = pageColor(uv);
    if (uWipe >= 0.0) {
      float line = uWipe * 1.12 - 0.06;
      float band = exp(-abs(uv.y - line) * (uWipeKind < 1.5 ? 90.0 : 30.0)) * sin(3.14159 * uWipe);
      c += band * mix(uAcc, vec3(1.0), 0.35) * (uWipeKind < 1.5 ? 0.9 : 0.4);
    }
    return mix(bg, c, uPageA);
  }

  vec2 kaleido(vec2 p, float n){
    float r = length(p), a = atan(p.y, p.x) + uT * 0.12;
    float s = 6.2831853 / n;
    a = mod(a, s); a = abs(a - s * 0.5);
    return r * vec2(cos(a), sin(a));
  }

  vec3 diskAt(vec2 p, out float front){
    vec2 d = p - uBH.xy;
    float e = max(uDisk.y, 0.05);
    vec2 q = vec2(d.x, d.y / e);
    float r = length(q) / uBH.z;
    front = step(d.y, 0.0);
    float rin = 1.45, rout = uDisk.w;
    if (r < rin * 0.85 || r > rout * 1.1) return vec3(0.0);
    float ang = atan(q.y, q.x);
    float streak = fbm(vec2(ang * 3.0 + uDisk.z - 2.6 * log(r), r * 5.0));
    float band = smoothstep(rin * 0.9, rin * 1.2, r) * (1.0 - smoothstep(rout * 0.55, rout, r));
    float hot = 1.0 - smoothstep(rin, rout, r);
    // the realm's colours outside, white-hot only at the inner edge
    vec3 col = mix(mix(uAcc, uAcc2, smoothstep(0.3, 0.8, streak)), vec3(1.0, 0.95, 0.88), hot * hot * hot);
    float dop = 1.0 + 0.7 * (-q.x / (length(q) + 1e-3));
    return col * band * (0.15 + 1.1 * streak * streak) * dop * (0.45 + 1.3 * hot) * uDisk.x;
  }

  vec3 tunnel(vec2 p){
    float r = length(p) + 1e-4, a = atan(p.y, p.x);
    float z = 0.3 / r + uTun.y;
    vec2 tuv = vec2(fract(a / 6.2831853 * 2.0 + uTun.z * z), fract(z * 0.32));
    tuv.x = abs(tuv.x * 2.0 - 1.0); // mirror the seam away
    float lod = 3.5 * (1.0 - smoothstep(0.02, 0.5, r));
    vec3 c = textureLod(uPage, tuv, lod).rgb;
    float fog = smoothstep(0.0, 0.42, r);
    float ringz = fract(z * 2.0);
    vec3 rings = uAcc * 0.5 * exp(-abs(ringz - 0.5) * 18.0) * fog;
    vec3 sun = vec3(1.0, 0.93, 0.78) * (exp(-r * 9.0) * 1.2 + exp(-r * 3.0) * 0.25) * uTun.w;
    return c * fog * 1.15 + rings + sun;
  }

  vec3 full(vec2 p){
    // liquid warp
    if (uWarp > 0.0) p += (vec2(fbm(p * 2.2 + uT * 0.13), fbm(p * 2.2 + 3.7 - uT * 0.11)) - 0.47) * 2.0 * uWarp;
    float shadow = 0.0; vec2 pl = p;
    if (uBH.z > 0.0) {
      vec2 d = p - uBH.xy; float r = length(d);
      d = rot(uSwirl * pow(uBH.z / max(r, uBH.z * 0.6), 1.6)) * d;
      pl = uBH.xy + d - normalize(d) * (uBH.w * uBH.w / max(r, uBH.z * 0.6));
      shadow = smoothstep(uBH.z * 1.03, uBH.z * 0.97, r);
    }
    vec3 c = scene(pl);
    if (uTun.x > 0.0) c = mix(c, tunnel(p), uTun.x);
    if (uBH.z > 0.0) {
      c *= 1.0 - shadow;
      float fr; vec3 dk = diskAt(p, fr);
      float fl; vec3 dl = diskAt(pl, fl);
      c += dk * mix(1.0 - shadow, 1.0, fr) + dl * 0.75 * (1.0 - shadow) * (1.0 - fr);
      float rr = length(p - uBH.xy) / uBH.z;
      c += mix(uAcc, vec3(1.0), 0.6) * exp(-pow((rr - 1.05) * 26.0, 2.0)) * uDisk.x * 1.3;
    }
    return c;
  }

  void main(){
    A = uRes.x / uRes.y;
    vec2 p = (vUV - 0.5) * vec2(A, 1.0);
    vec3 c = full(p);
    if (uKal > 0.001) c = mix(c, full(kaleido(p, uKalN) * 0.92), uKal);
    if (uHue != 0.0) c = hueRot(c, uHue);
    if (uSat != 1.0) { float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat); }
    if (uTrails > 0.0) {
      vec2 q = (vUV - 0.5) * vec2(A, 1.0);
      q = rot(0.006) * q / 1.014;
      vec3 pr = texture(uPrev, q / vec2(A, 1.0) + 0.5).rgb;
      c = max(c, hueRot(pr, 16.0) * uTrails);
    }
    o = vec4(max(c, 0.0), 1.0);
  }`;

  const FS_PLATE = COMMON + `
  uniform sampler2D uTex; uniform float uA, uAdd, uGlow;
  void main(){
    // plates are straight-alpha PNGs: premultiply before blending, glow from a blurred copy
    vec4 c = texture(uTex, vec2(vUV.x, 1.0 - vUV.y));
    vec4 b = textureLod(uTex, vec2(vUV.x, 1.0 - vUV.y), 4.0);
    vec3 rgb = c.rgb * c.a + b.rgb * b.a * uGlow;
    o = vec4(rgb * uA, clamp(c.a + b.a * uGlow * 0.5, 0.0, 1.0) * uA * (1.0 - uAdd));
  }`;
  const VS_PLATE = `#version 300 es
  in vec2 aP; out vec2 vUV; uniform vec4 uBox; uniform float uRot; uniform vec2 uRes;
  void main(){ vUV = aP * 0.5 + 0.5; vec2 p = aP * uBox.zw * 0.5; float c = cos(uRot), s = sin(uRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + uBox.xy;
    gl_Position = vec4(p.x / (uRes.x / uRes.y) * 2.0, p.y * 2.0, 0.0, 1.0); }`;

  const FS_GRADE = COMMON + `
  uniform sampler2D uScene; uniform float uWhite, uBlack, uGrain, uFrame, uGlow2;
  void main(){
    vec3 c = texture(uScene, vUV).rgb;
    vec3 b = textureLod(uScene, vUV, 3.0).rgb * 0.5 + textureLod(uScene, vUV, 5.0).rgb * 0.7;
    c += max(b - 0.45, 0.0) * uGlow2;
    float A = uRes.x / uRes.y;
    float v = length((vUV - 0.5) * vec2(A, 1.0));
    c *= mix(1.0, smoothstep(1.15, 0.3, v), 0.5);
    c = c / (1.0 + max(c - 1.0, 0.0) * 0.6);  // soft shoulder
    c += (hash(vUV * uRes + uFrame * 7.13) - 0.5) * uGrain;
    c = mix(c, vec3(1.0), uWhite);
    c = mix(c, vec3(0.0), uBlack);
    o = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

  function prog(vs, fs) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 4000)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function tex(mip = true) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function upload(t, img) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); }
  function target() {
    const t = tex(true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb };
  }

  let P, PP, G, rtA, rtB, tPage, tHeld, plates = [];
  const frameUrl = (f) => `/.trailer-cache/${FILM}/a/${String(f).padStart(5, '0')}.jpg`;
  const loadImg = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('missing ' + url); return createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); };
  let heldIdx = -2;

  window.__lens = {
    async init(plateList) {
      P = prog(VS, FS_SCENE); PP = prog(VS_PLATE, FS_PLATE); G = prog(VS, FS_GRADE);
      rtA = target(); rtB = target(); tPage = tex(); tHeld = tex();
      plates = [];
      for (const src of plateList) { const t = tex(); const im = await loadImg(src); upload(t, im); plates.push({ t, ar: im.width / im.height }); }
      return true;
    },
    async frame(f, t, u, fresh) {
      const pageF = u.src != null ? u.src : f;
      upload(tPage, await loadImg(frameUrl(pageF)));
      const hasHeld = u.held != null && u.held >= 0 && u.wipe != null && u.wipe >= 0;
      if (hasHeld && u.held !== heldIdx) { upload(tHeld, await loadImg(frameUrl(u.held))); heldIdx = u.held; }
      if (fresh) for (const rt of [rtA, rtB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }

      // scene → rtA, reading the last output (rtB) for the trails
      gl.bindFramebuffer(gl.FRAMEBUFFER, rtA.fb); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
      gl.useProgram(P.p);
      const U = P.u, d = (k, v) => (u[k] == null ? v : u[k]);
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uT, t);
      const cam = d('cam', [1, 0, 0]); gl.uniform3f(U.uCam, cam[0], cam[1], cam[2]);
      gl.uniform1f(U.uZoom, d('zoom', 1)); const pan = d('pan', [0, 0]); gl.uniform2f(U.uPan, pan[0], pan[1]);
      gl.uniform1f(U.uWipe, hasHeld ? u.wipe : -1); gl.uniform1f(U.uWipeKind, d('wipeKind', 1)); gl.uniform1f(U.uHasHeld, hasHeld ? 1 : 0);
      gl.uniform1f(U.uHue, d('hue', 0)); gl.uniform1f(U.uSat, d('sat', 1)); gl.uniform1f(U.uWarp, d('warp', 0));
      gl.uniform1f(U.uChroma, d('chroma', 0)); gl.uniform1f(U.uTrails, fresh ? 0 : d('trails', 0));
      gl.uniform1f(U.uKal, d('kaleido', 0)); gl.uniform1f(U.uKalN, d('kalN', 6)); gl.uniform1f(U.uBloom, d('bloom', 0.3));
      gl.uniform1f(U.uPageA, d('page', 1));
      const bh = d('bh', [0, 0, 0, 0]); gl.uniform4f(U.uBH, bh[0], bh[1], bh[2], bh[3]);
      const dk = d('disk', [0, 0.3, 0, 4]); gl.uniform4f(U.uDisk, dk[0], dk[1], dk[2], dk[3]);
      gl.uniform1f(U.uSwirl, d('swirl', 0));
      const tn = d('tunnel', [0, 0, 0, 0]); gl.uniform4f(U.uTun, tn[0], tn[1], tn[2], tn[3]);
      const sky = d('sky', [0.6, 1, 1]); gl.uniform3f(U.uSky, sky[0], sky[1], sky[2]);
      const ed = d('edge', [0, 0, 0, 0]); gl.uniform4f(U.uEdge, ed[0], ed[1], ed[2], ed[3]);
      const br = d('breathe', [0, 0]); gl.uniform2f(U.uBreathe, br[0], br[1]);
      const bu = d('bubble', [0, 40, 1]); gl.uniform3f(U.uBubble, bu[0], bu[1], bu[2]);
      const ac = d('accent', [0.365, 0.894, 1]); gl.uniform3f(U.uAcc, ac[0], ac[1], ac[2]);
      const ac2 = d('accent2', [0.365, 1, 0.694]); gl.uniform3f(U.uAcc2, ac2[0], ac2[1], ac2[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tPage); gl.uniform1i(U.uPage, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tHeld); gl.uniform1i(U.uHeld, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, rtB.t); gl.uniform1i(U.uPrev, 2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // plates over the scene (they trail too)
      if (u.plates && u.plates.length) {
        gl.useProgram(PP.p); gl.enable(gl.BLEND);
        for (const pl of u.plates) {
          const P2 = plates[pl.i]; if (!P2 || !(pl.a > 0)) continue; const tx = P2.t;
          gl.blendFunc(gl.ONE, pl.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
          gl.uniform2f(PP.u.uRes, W, H);
          const ar = pl.ar || P2.ar;
          gl.uniform4f(PP.u.uBox, pl.x || 0, pl.y || 0, (pl.h || 0.3) * ar, pl.h || 0.3);
          gl.uniform1f(PP.u.uRot, pl.rot || 0); gl.uniform1f(PP.u.uA, pl.a); gl.uniform1f(PP.u.uAdd, pl.add ? 1 : 0); gl.uniform1f(PP.u.uGlow, pl.glow || 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(PP.u.uTex, 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.disable(gl.BLEND);
      }
      gl.bindTexture(gl.TEXTURE_2D, rtA.t); gl.generateMipmap(gl.TEXTURE_2D);

      // grade → the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.useProgram(G.p);
      gl.uniform2f(G.u.uRes, W, H); gl.uniform1f(G.u.uT, t);
      gl.uniform1f(G.u.uWhite, d('white', 0)); gl.uniform1f(G.u.uBlack, d('black', 0));
      gl.uniform1f(G.u.uGrain, d('grain', 0.018)); gl.uniform1f(G.u.uFrame, f); gl.uniform1f(G.u.uGlow2, d('glow', 0.5));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rtA.t); gl.uniform1i(G.u.uScene, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
      [rtA, rtB] = [rtB, rtA];
      return true;
    },
  };
})();
