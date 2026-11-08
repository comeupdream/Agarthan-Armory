/* =============================================================================
 * prefs.js — the display settings in the top bar: realm (colour theme),
 * script (typeface set) and cursor. Choices persist per visitor (aa-prefs);
 * the inline head script applies theme + font before first paint.
 *
 *   themes   html[data-theme]  polar (default) · inner-earth · mono · crystal · vril
 *   fonts    html[data-font]   ancient (default) · future · oldworld · runic
 *   cursors  html[data-cursor] + --cursor/--cursor-hot (SVG data URIs tinted
 *            to the current theme; the tractor-beam tip is the click point)
 * ===========================================================================*/
(function () {
  'use strict';
  const AA = window.AA || (window.AA = {});
  const root = document.documentElement;
  const KEY = 'aa-prefs';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const save = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } };

  const THEMES = [
    { id: 'polar', name: 'Polar Night', sw: ['#5de4ff', '#5dffb1', '#0b1f3a'] },
    { id: 'inner-earth', name: 'Inner Earth', sw: ['#ffb347', '#ff7a45', '#3a1708'] },
    { id: 'mono', name: 'Black & White', sw: ['#ffffff', '#9a9a9a', '#1c1c1c'] },
    { id: 'crystal', name: 'Agarthan Crystal', sw: ['#c79bff', '#ffd27a', '#2a1550'] },
    { id: 'vril', name: 'Vril', sw: ['#5dff9c', '#d6ff5d', '#0b2e1c'] },
  ];
  const FONTS = [
    { id: 'ancient', name: 'Ancient Tech', family: "'Cinzel', serif" },
    { id: 'future', name: 'Future Tech', family: "'Orbitron', sans-serif" },
    { id: 'oldworld', name: 'Old World', family: "'Uncial Antiqua', serif" },
    { id: 'runic', name: 'Runic', family: "'Cinzel Decorative', serif" },
  ];

  /* ---------- cursors: 32×32 SVG, a = accent, h = highlight, d = outline ---------- */
  const beam = (on, a) => `<path d="M14 14h4l5 13H9z" fill="${a}" fill-opacity="${on ? 0.6 : 0.28}"/><circle cx="16" cy="28" r="1.6" fill="${a}" stroke="#03101c" stroke-width=".8"/>`;
  const CURSORS = [
    { id: 'system', name: 'Standard', hot: [0, 0], svg: null },
    { id: 'reticle', name: 'Reticle', hot: [16, 16], svg: (a, h, on) =>
      `<g fill="none" stroke="#03101c" stroke-width="3.4" opacity=".7"><circle cx="16" cy="16" r="9"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6"/></g>
       <g fill="none" stroke="${on ? h : a}" stroke-width="1.6"><circle cx="16" cy="16" r="9"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6"/></g><circle cx="16" cy="16" r="1.8" fill="${h}"/>` },
    { id: 'disc', name: 'Disc', hot: [16, 28], svg: (a, h, on) => `${beam(on, a)}
       <path d="M11.5 9.5Q16 3 20.5 9.5z" fill="${a}" fill-opacity=".75" stroke="#03101c" stroke-width=".8"/>
       <ellipse cx="16" cy="11" rx="12" ry="3.6" fill="${h}" stroke="#03101c" stroke-width="1"/>
       <g fill="${a}"><circle cx="8" cy="11.4" r="1"/><circle cx="12" cy="12.3" r="1"/><circle cx="16" cy="12.6" r="1"/><circle cx="20" cy="12.3" r="1"/><circle cx="24" cy="11.4" r="1"/></g>` },
    { id: 'tictac', name: 'Tic Tac', hot: [16, 28], svg: (a, h, on) => `${beam(on, a)}
       <rect x="4.5" y="6" width="23" height="8" rx="4" fill="${h}" stroke="#03101c" stroke-width="1"/>
       <path d="M9 9h14" stroke="${a}" stroke-width="1.2" stroke-linecap="round"/>` },
    { id: 'triangle', name: 'Black Triangle', hot: [16, 28], svg: (a, h, on) => `${beam(on, a)}
       <path d="M16 3L28.5 14H3.5z" fill="#0a0f18" stroke="${a}" stroke-width="1.2"/>
       <g fill="${h}"><circle cx="16" cy="5.6" r="1.3"/><circle cx="6" cy="12.6" r="1.3"/><circle cx="26" cy="12.6" r="1.3"/></g><circle cx="16" cy="11" r="1.2" fill="#ff5f73"/>` },
    { id: 'orb', name: 'Foo Fighter', hot: [16, 28], svg: (a, h, on) => `${beam(on, a)}
       <defs><radialGradient id="o"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${h}"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs>
       <circle cx="16" cy="9" r="8" fill="url(#o)"/><circle cx="16" cy="9" r="3" fill="#fff" stroke="#03101c" stroke-width=".6"/>` },
  ];
  const svgUri = (inner) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${inner}</svg>`)}`;
  const colors = () => {
    const cs = getComputedStyle(root);
    return [cs.getPropertyValue('--cyan').trim() || '#5de4ff', cs.getPropertyValue('--frost').trim() || '#ecf9ff'];
  };

  /* ---------- runic script: rune lines under the headings ---------- */
  function runeEchoes(on) {
    document.querySelectorAll('.rune-echo').forEach((e) => e.remove());
    if (!on || !AA.runes) return;
    document.querySelectorAll('.section-head h2, .page-hero h1, .truth h3, .gate h2').forEach((h) => {
      const r = AA.runes(h.textContent);
      if (!r) return;
      const s = document.createElement('span');
      s.className = 'rune-echo'; s.setAttribute('aria-hidden', 'true'); s.textContent = r;
      h.after(s);
    });
  }

  /* ---------- apply ---------- */
  let prefs = load();
  function apply() {
    const t = THEMES.some((x) => x.id === prefs.theme) ? prefs.theme : 'polar';
    const f = FONTS.some((x) => x.id === prefs.font) ? prefs.font : 'ancient';
    const c = CURSORS.find((x) => x.id === prefs.cursor) || CURSORS[0];
    if (t === 'polar') delete root.dataset.theme; else root.dataset.theme = t;
    if (f === 'ancient') delete root.dataset.font; else root.dataset.font = f;
    if (c.svg) {
      const [a, h] = colors();
      root.dataset.cursor = c.id;
      root.style.setProperty('--cursor', `url("${svgUri(c.svg(a, h, false))}") ${c.hot[0]} ${c.hot[1]}, auto`);
      root.style.setProperty('--cursor-hot', `url("${svgUri(c.svg(a, h, true))}") ${c.hot[0]} ${c.hot[1]}, pointer`);
    } else {
      delete root.dataset.cursor;
      root.style.removeProperty('--cursor'); root.style.removeProperty('--cursor-hot');
    }
    runeEchoes(f === 'runic');
    document.querySelectorAll('.prefs-opt').forEach((b) => b.setAttribute('aria-pressed', String(
      (b.dataset.k === 'theme' && b.dataset.v === t) || (b.dataset.k === 'font' && b.dataset.v === f) || (b.dataset.k === 'cursor' && b.dataset.v === c.id))));
  }

  /* ---------- the panel ---------- */
  function buildPanel() {
    const panel = document.getElementById('prefsPanel');
    const btn = document.querySelector('.prefs-btn');
    if (!panel || !btn) return;
    const [a, h] = colors();
    const opt = (k, v, inner, label) => `<button type="button" class="prefs-opt" data-k="${k}" data-v="${v}" aria-pressed="false">${inner}<span>${label}</span></button>`;
    panel.innerHTML = `
      <fieldset><legend>Realm</legend><div class="prefs-opts">${THEMES.map((t) =>
        opt('theme', t.id, `<span class="sw">${t.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`, t.name)).join('')}</div></fieldset>
      <fieldset><legend>Script</legend><div class="prefs-opts">${FONTS.map((f) =>
        opt('font', f.id, `<span class="ff" style="font-family:${f.family}">${f.id === 'runic' ? 'ᚨᚷ' : 'Ag'}</span>`, f.name)).join('')}</div></fieldset>
      <fieldset><legend>Cursor</legend><div class="prefs-opts">${CURSORS.map((c) =>
        opt('cursor', c.id, `<span class="cur">${c.svg ? `<img src="${svgUri(c.svg(a, h, false))}" alt="">` : '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 3l14 8-6 1.5L10 19z" fill="#fff" stroke="#03101c" stroke-width="1.2"/></svg>'}</span>`, c.name)).join('')}</div></fieldset>
      <p class="prefs-note">Saved on this device. Product photos keep their true colors in every realm.</p>`;
    const open = (on) => {
      panel.hidden = !on; btn.setAttribute('aria-expanded', String(on));
      if (on) { const p = panel.querySelector('[aria-pressed="true"]') || panel.querySelector('button'); p && p.focus(); }
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(panel.hidden); });
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('.prefs-opt'); if (!b) return;
      prefs = { ...prefs, [b.dataset.k]: b.dataset.v };
      save(prefs); apply();
      if (b.dataset.k === 'theme') refreshCursorPreviews(panel);
    });
    document.addEventListener('click', () => { if (!panel.hidden) open(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
  }
  function refreshCursorPreviews(panel) {
    const [a, h] = colors();
    panel.querySelectorAll('.prefs-opt[data-k="cursor"]').forEach((b) => {
      const c = CURSORS.find((x) => x.id === b.dataset.v); const img = b.querySelector('img');
      if (c && c.svg && img) img.src = svgUri(c.svg(a, h, false));
    });
  }

  /* ---------- a tractor-beam flash on click, when a craft is the cursor ---------- */
  document.addEventListener('pointerdown', (e) => {
    const c = root.dataset.cursor;
    if (!c || c === 'reticle' || e.pointerType !== 'mouse' || AA.reduced) return;
    const fx = document.createElement('div');
    fx.className = 'beam-fx';
    fx.style.left = e.clientX + 'px'; fx.style.top = (e.clientY - 16) + 'px';
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 600);
  });

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { buildPanel(); apply(); });
  else { buildPanel(); apply(); }
})();
