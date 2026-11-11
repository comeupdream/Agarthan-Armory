/* home.js — the home page's live parts: department schematics + counts,
 * featured relics, directions link, and the contact form. */
(function () {
  'use strict';
  const AA = window.AA; if (!AA) return;
  const items = AA.catalog.items || [];

  // departments: hologram + how many can be had now (on the shelf, or ready to ship from a distributor)
  const available = (i) => i.status === 'in' || i.status === 'low' || i.status === 'ship';
  AA.$$('#deptGrid [data-dept]').forEach((el) => {
    const w = el.querySelector('.holo-wrap');
    if (w) w.innerHTML = `<span class="holo-glow" style="display:contents">${AA.icon(el.dataset.icon)}</span>`;
    const n = items.filter((i) => i.dept === el.dataset.dept && available(i)).length;
    const c = el.querySelector('[data-count]');
    if (c) c.textContent = n ? `${n.toLocaleString('en-US')} in stock` : 'Ask us';
  });
  // "Into the dark": how many of each chapter's category can be had now
  AA.$$('[data-sub-count]').forEach((el) => {
    const [d, sub] = el.dataset.subCount.split('|');
    const n = items.filter((i) => i.dept === d && i.sub === sub && available(i)).length;
    el.textContent = n ? `${n.toLocaleString('en-US')} in stock` : '';
  });

  // featured: flagged items first, then in-stock, one per department before repeats
  const grid = document.getElementById('featuredGrid');
  if (grid) {
    const pool = items.filter((i) => i.status !== 'out');
    const flagged = pool.filter((i) => i.featured);
    // the store's own shelf first, then priced and photographed items: the strongest first impression
    const score = (i) => (i.shelf ? 4 : 0) + (i.price != null ? 2 : 0) + (i.images && i.images.length ? 1 : 0);
    const rest = pool.filter((i) => !i.featured).sort((a, b) => score(b) - score(a));
    const pick = [...flagged];
    const seen = new Set(pick.map((i) => i.dept));
    for (const i of rest) { if (pick.length >= 8) break; if (!seen.has(i.dept)) { pick.push(i); seen.add(i.dept); } }
    for (const i of rest) { if (pick.length >= 8) break; if (!pick.includes(i)) pick.push(i); }
    grid.innerHTML = pick.slice(0, 8).map(AA.card).join('');
  }

  // directions: only when there is a street address to point at
  const dir = document.getElementById('directions');
  const addr = AA.addressLines().join(', ');
  if (dir && AA.cfg.address && AA.cfg.address.street) {
    dir.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${AA.cfg.name} ${addr}`);
    dir.hidden = false;
  }

  // contact form
  const f = document.getElementById('contactForm');
  f && f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const ok = await AA.send({ type: 'contact', ...d, page: location.href }, `${d.topic} — ${d.name}`,
      `Name: ${d.name}\nContact: ${d.contact}\nTopic: ${d.topic}\n\n${d.message}`);
    if (ok) f.reset();
  });

  /* ---------- the banner: slides scrolled through sideways ----------
     The track scrolls natively (swipe, trackpad, arrow keys) and snaps to each slide; the dots follow
     the scroll, the arrows and dots scroll it. It moves on by itself every 8 seconds while it is on
     screen and nobody is touching it, and never when the visitor has asked for less motion. */
  (function banner() {
    const track = document.querySelector('.banner-track');
    const nav = document.querySelector('.banner-nav');
    if (!track || !nav) return;
    const slides = [...track.children], dots = [...nav.querySelectorAll('.sp-dot')];
    let at = 0, held = false, onScreen = false, raf = 0;
    const width = () => track.clientWidth || 1;
    const go = (n) => {
      at = (n + slides.length) % slides.length;
      track.scrollTo({ left: at * width(), behavior: AA.reduced ? 'auto' : 'smooth' });
    };
    const mark = () => {
      raf = 0;
      at = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / width())));
      dots.forEach((d, i) => d.setAttribute('aria-pressed', String(i === at)));
    };
    track.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });
    nav.addEventListener('click', (e) => {
      const d = e.target.closest('.sp-dot'), a = e.target.closest('.sp-arrow');
      if (d) go(+d.dataset.i);
      if (a) go(at + +a.dataset.d);
    });
    const box = track.closest('.manifesto');
    for (const [ev, v] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false], ['touchstart', true]])
      box.addEventListener(ev, () => { held = v; }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0.5 }).observe(track);
    if (!AA.reduced) setInterval(() => { if (onScreen && !held && !document.hidden) go(at + 1); }, 8000);
  })();

  /* ---------- the map backdrop: the realm plate's picture, blown up behind the ice wall map ----------
     Off unless the visitor presses the Backdrop switch in the corner of the small picture; the choice
     is remembered on this browser. One switch for every realm: each realm shows its own picture. */
  (function mapBackdrop() {
    const sec = document.getElementById('map');
    const switches = [...document.querySelectorAll('[data-map-backdrop]')];
    if (!sec || !switches.length) return;
    const KEY = 'aa-map-backdrop';
    const set = (on) => {
      sec.classList.toggle('has-backdrop', on);
      switches.forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
        b.title = on ? 'Take this picture out from behind the map' : 'Show this picture behind the map';
      });
    };
    set(AA.store.get(KEY, false) === true);
    switches.forEach((b) => {
      b.hidden = false;
      b.addEventListener('click', () => {
        const on = !sec.classList.contains('has-backdrop');
        set(on);
        AA.store.set(KEY, on);
      });
    });
  })();

  /* ---------- Spotlight: the store's promotion slides, from the Ops Console ---------- */
  (function spotlight() {
    const box = document.getElementById('spotlight');
    const sp = AA.cfg.spotlight;
    if (!box || !sp || !Array.isArray(sp.slides)) return;
    const today = new Date().toISOString().slice(0, 10);
    const slides = sp.slides.filter((x) => x && x.on !== false && x.title && (!x.start || x.start <= today) && (!x.end || x.end >= today));
    if (!slides.length) return;
    const esc = AA.esc;
    const safeLink = (l) => (l && (/^\/(?!\/)/.test(l) || /^https:\/\//.test(l)) ? l : '');
    const media = (x) => {
      if (x.video && /^[\w-]{11}$/.test(x.video)) {
        const poster = x.image ? esc(x.image) : `https://i.ytimg.com/vi/${esc(x.video)}/hqdefault.jpg`;
        return `<button type="button" class="sp-media sp-video" data-yt="${esc(x.video)}" aria-label="Play the video: ${esc(x.title)}"><img src="${poster}" alt="" loading="lazy"><span aria-hidden="true">▶</span></button>`;
      }
      if (x.image) return `<div class="sp-media${/^assets\/img\/(products|uploads)\//.test(x.image) ? ' sp-plate' : ''}"><img src="${esc(x.image)}" alt="" loading="lazy"></div>`;
      return '<div class="sp-media sp-holo" aria-hidden="true">' + (AA.icon ? AA.icon('case') : '') + '</div>';
    };
    box.innerHTML = `<div class="sp-track">${slides.map((x, i) => `<article class="sp-slide hud brackets" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}" ${i ? 'hidden' : ''}>
        ${media(x)}<div class="sp-text">${x.eyebrow ? `<span class="eyebrow">${esc(x.eyebrow)}</span>` : ''}<h2>${esc(x.title)}</h2>${x.text ? `<p>${esc(x.text)}</p>` : ''}
        ${safeLink(x.link) ? `<a class="btn btn-ice arrow" href="${esc(safeLink(x.link))}"${/^https:/.test(x.link) ? ' target="_blank" rel="noopener"' : ''}>${esc(x.cta || 'Take a look')}</a>` : ''}</div></article>`).join('')}</div>
      ${slides.length > 1 ? `<div class="sp-nav"><button type="button" class="sp-arrow" data-d="-1" aria-label="Previous slide">‹</button>${slides.map((_, i) => `<button type="button" class="sp-dot" data-i="${i}" aria-label="Slide ${i + 1}" aria-pressed="${!i}"></button>`).join('')}<button type="button" class="sp-arrow" data-d="1" aria-label="Next slide">›</button></div>` : ''}`;
    box.hidden = false;
    const all = [...box.querySelectorAll('.sp-slide')], dots = [...box.querySelectorAll('.sp-dot')];
    let at = 0, timer = null, held = false;
    const show = (n) => {
      at = (n + all.length) % all.length;
      all.forEach((el, i) => { el.hidden = i !== at; });
      dots.forEach((d, i) => d.setAttribute('aria-pressed', String(i === at)));
    };
    const tick = () => { clearInterval(timer); if (all.length > 1 && !AA.reduced) timer = setInterval(() => { if (!held && !document.hidden) show(at + 1); }, Math.max(4, Math.min(30, sp.interval || 7)) * 1000); };
    box.addEventListener('click', (e) => {
      const d = e.target.closest('.sp-dot'), a = e.target.closest('.sp-arrow'), v = e.target.closest('.sp-video');
      if (d) { show(+d.dataset.i); tick(); }
      if (a) { show(at + +a.dataset.d); tick(); }
      if (v) {
        held = true;
        const f = document.createElement('iframe');
        f.className = 'sp-media yt-frame'; f.title = 'Video'; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
        f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.dataset.yt)}?autoplay=1&rel=0`;
        v.replaceWith(f);
      }
    });
    box.addEventListener('mouseenter', () => { held = true; });
    box.addEventListener('mouseleave', () => { if (!box.querySelector('iframe')) held = false; });
    box.addEventListener('focusin', () => { held = true; });
    box.addEventListener('focusout', () => { if (!box.querySelector('iframe')) held = false; });
    tick();
  })();
})();
