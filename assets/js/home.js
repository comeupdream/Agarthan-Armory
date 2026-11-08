/* home.js — the home page's live parts: department schematics + counts,
 * featured relics, directions link, and the contact form. */
(function () {
  'use strict';
  const AA = window.AA; if (!AA) return;
  const items = AA.catalog.items || [];

  // departments: hologram + how many are in the vault
  AA.$$('#deptGrid [data-dept]').forEach((el) => {
    const w = el.querySelector('.holo-wrap');
    if (w) w.innerHTML = `<span class="holo-glow" style="display:contents">${AA.icon(el.dataset.icon)}</span>`;
    const n = items.filter((i) => i.dept === el.dataset.dept && i.status !== 'out').length;
    const c = el.querySelector('[data-count]');
    if (c) c.textContent = n ? `${n} in vault` : 'Ask us';
  });

  // featured: flagged items first, then in-stock, one per department before repeats
  const grid = document.getElementById('featuredGrid');
  if (grid) {
    const pool = items.filter((i) => i.status !== 'out');
    const flagged = pool.filter((i) => i.featured);
    // priced, photographed items make the strongest first impression
    const score = (i) => (i.price != null ? 2 : 0) + (i.images && i.images.length ? 1 : 0);
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
})();
