/* =============================================================================
 * order.js — the Armory's default ("Featured") order, in one place.
 *
 * The page loads it (window.AA.order) and so do the tools (require/import):
 * scripts/find-images.mjs --cover spends photo searches on exactly the
 * products a shopper sees first, so both must agree on what comes first.
 *
 *   hand-picked (featured) first; then what can be bought (on the store's
 *   shelf or shipping from a distributor), then special order, then out of
 *   stock; inside each, departments take turns; inside a department,
 *   products with a photo lead, one variant of every product line before a
 *   second of any, the subcategories rotate (a pistol, a revolver, a bolt
 *   gun, …), and inside a subcategory the best come first: the merit rank
 *   from the catalogue build (premium price for the category, how deep the
 *   distributors stock it, a maker people ask for, on the store's shelf).
 * ===========================================================================*/
(function (root) {
  'use strict';
  const DEPT_ORDER = ['sidearms', 'longarms', 'shotguns', 'ammo', 'optics', 'gear', 'nfa'];
  const ADDON = /mount|rings?\b|bases?\b|accessor|parts|reloading|black powder|receivers? & frames|combos|merch/i;
  const bucketOf = (i) => (i.status === 'in' || i.status === 'low' || i.status === 'ship' ? 0 : i.status === 'out' ? 2 : 1);

  /** stamps _bucket, _dept, _v and _mix on every item (once, after the catalog loads) */
  function prepare(items, deptOrder = DEPT_ORDER) {
    const groups = new Map();
    for (const i of items) {
      i._bucket = bucketOf(i); i._dept = deptOrder.indexOf(i.dept);
      const k = i._bucket + '|' + i.dept; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i);
    }
    for (const g of groups.values()) {
      g.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
      // the best variant of a line WITH a photo stands for it among the photos (another may lack one)
      const seen = new Map();
      for (const i of g) { const ph = i.images && i.images[0] ? 0 : 1; const k = ph + '|' + (i.ln || i.id); const n = seen.get(k) || 0; seen.set(k, n + 1); i._v = n; i._ph = ph; }
      const tiers = new Map();
      for (const i of g) {
        const t = `${i._ph}${String(Math.min(i._v, 999)).padStart(3, '0')}`;
        if (!tiers.has(t)) tiers.set(t, new Map());
        const bySub = tiers.get(t); if (!bySub.has(i.sub)) bySub.set(i.sub, []); bySub.get(i.sub).push(i);
      }
      // the subcategories take turns, the big ones more often (in proportion to the square root of their
      // size: Semi-Auto Pistols most, a derringer now and then); add-ons (mounts, rings, bases, parts,
      // reloading, black powder) less often and only after the first rows, which show what they go on
      const size = new Map(); for (const i of g) size.set(i.sub, (size.get(i.sub) || 0) + 1);
      let n = 0;
      for (const t of [...tiers.keys()].sort()) {
        const keyed = [];
        let order = 0;
        for (const [sub, l] of tiers.get(t)) {
          const addon = ADDON.test(sub || '');
          const w = Math.sqrt(size.get(sub)) * (addon ? 0.5 : 1);
          l.forEach((i, k) => keyed.push([(k + (addon ? 4 : 0.5)) / w, -w, order, i]));
          order++;
        }
        keyed.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
        for (const [, , , i] of keyed) i._mix = n++;
      }
    }
    return items;
  }

  /** the Featured comparator (items must be prepared) */
  const featured = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a._bucket - b._bucket || a._mix - b._mix || a._dept - b._dept;

  /**
   * The products on the first page of every view a shopper lands on — All,
   * each department, each category — most visible first: the first card of
   * every view, then the second of every view, and so on.
   */
  function coverIds(items, { page = 48, deptOrder = DEPT_ORDER } = {}) {
    prepare(items, deptOrder);
    const views = [items];
    for (const d of deptOrder) {
      const inDept = items.filter((i) => i.dept === d); if (!inDept.length) continue;
      views.push(inDept);
      const subs = new Set(); for (const i of inDept) { if (i.sub) subs.add(i.sub); for (const s of i.also || []) subs.add(s); }
      for (const s of subs) views.push(inDept.filter((i) => i.sub === s || (i.also && i.also.includes(s))));
    }
    const firsts = views.map((v) => v.slice().sort(featured).slice(0, page));
    const out = []; const seen = new Set();
    for (let r = 0; r < page; r++) for (const v of firsts) if (v[r] && !seen.has(v[r].id)) { seen.add(v[r].id); out.push(v[r].id); }
    return { ids: out, views: views.length };
  }

  const api = { DEPT_ORDER, bucketOf, prepare, featured, coverIds };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AA = root.AA || {}).order = api;
})(typeof window !== 'undefined' ? window : globalThis);
