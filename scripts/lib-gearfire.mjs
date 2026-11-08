/* =============================================================================
 * lib-gearfire.mjs — reading a Gearfire storefront (shop.agarthanarmory.com).
 *
 * Gearfire shops are SvelteKit apps. Every page carries its data inline, in
 * the script that starts the app (`kit.start(app, element, { data: [...] })`):
 *   - every page:     initData.navList — departments → categories → subs, with ids
 *   - a product page: product — the whole product line with ALL its variants
 *                     (subProducts): UPC, part number, attributes (caliber,
 *                     grain, rounds…), images, price, stock, ship limits
 * so one page per product line gives every variant, exactly, and the
 * category tree gives a listing page per subcategory to find every line
 * (the shop's sitemap lists only part of the store).
 *
 * That data is a JavaScript literal, not JSON. It is read with a small
 * parser below — never eval'd.
 * ===========================================================================*/

/* ---------- a JavaScript literal reader (objects, arrays, strings, numbers) ---------- */
export function parseLiteral(src, at = 0) {
  let i = at;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const fail = (m) => { throw new Error(`${m} at ${i}: ${JSON.stringify(src.slice(i, i + 40))}`); };
  const ident = () => { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 200)); if (!m) fail('expected a name'); i += m[0].length; return m[0]; };
  function str() {
    const q = src[i++]; let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const c = src[++i];
        if (c === 'u') { out += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 5; continue; }
        if (c === 'x') { out += String.fromCharCode(parseInt(src.slice(i + 1, i + 3), 16)); i += 3; continue; }
        out += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[c] ?? c; i++; continue;
      }
      out += src[i++];
    }
    if (src[i] !== q) fail('unterminated string');
    i++; return out;
  }
  function value() {
    ws();
    const c = src[i];
    if (c === '{') {
      i++; const o = {};
      for (;;) {
        ws(); if (src[i] === '}') { i++; return o; }
        const k = src[i] === '"' || src[i] === "'" ? str() : /[\d]/.test(src[i]) ? String(num()) : ident();
        ws(); if (src[i] !== ':') fail('expected :'); i++;
        o[k] = value(); ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return o; }
        fail('expected , or }');
      }
    }
    if (c === '[') {
      i++; const a = [];
      for (;;) {
        ws(); if (src[i] === ']') { i++; return a; }
        if (src[i] === ',') { a.push(null); i++; continue; }      // a hole
        a.push(value()); ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return a; }
        fail('expected , or ]');
      }
    }
    if (c === '"' || c === "'") return str();
    if (c === '-' || c === '.' || /\d/.test(c || '')) return num();
    if (c === '(') { i++; const v = value(); ws(); if (src[i] === ')') i++; return v; }
    const name = ident();
    if (name === 'true') return true;
    if (name === 'false') return false;
    if (name === 'null' || name === 'undefined') return null;
    if (name === 'NaN') return null;
    if (name === 'Infinity') return Infinity;
    if (name === 'void') { value(); return null; }
    if (name === 'new') { ws(); ident(); ws(); return src[i] === '(' ? call()[0] ?? null : null; }   // new Date("…") → "…", new Set([…]) → […]
    // a reference or call (`__sveltekit_x.defer(1)`): not data — skip it
    while (src[i] === '.') { i++; ident(); }
    ws(); if (src[i] === '(') call();
    return null;
  }
  function call() {
    i++; const args = [];
    for (;;) {
      ws(); if (src[i] === ')') { i++; return args; }
      args.push(value()); ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ')') { i++; return args; }
      fail('expected , or )');
    }
  }
  function num() {
    const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i, i + 40));
    if (!m) { if (src.startsWith('-Infinity', i)) { i += 9; return -Infinity; } fail('expected a number'); }
    i += m[0].length; return +m[0];
  }
  const v = value();
  return { value: v, end: i };
}

/** the data nodes SvelteKit renders into the page (null if this is not one) */
export function kitData(html) {
  for (const m of String(html).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const s = m[1];
    if (!/kit\.start\(/.test(s)) continue;
    const at = s.search(/\bdata:\s*\[/);
    if (at < 0) continue;
    try { return parseLiteral(s, s.indexOf('[', at)).value; } catch { return null; }
  }
  return null;
}
const nodeData = (nodes) => (Array.isArray(nodes) ? nodes : []).map((n) => (n && n.data) || {}).filter(Boolean);

export const isGearfire = (html) => /__sveltekit_\w+/.test(html) && /navList:\s*\[/.test(html);

/** the store's category tree */
export function navOf(html) {
  for (const d of nodeData(kitData(html))) if (d.initData && Array.isArray(d.initData.navList)) return d.initData.navList;
  return [];
}
// Gearfire's own spelling: drop anything but letters, digits, spaces and hyphens, then spaces → hyphens
// ("Red Dots / Holographic" → red-dots--holographic, "G33 Magnifier " → g33-magnifier-)
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');

/** one listing page per subcategory (or per category when it has none) */
export function listingsOf(origin, nav) {
  const out = [];
  for (const d of nav || []) for (const c of d.categories || []) {
    const subs = (c.subCategories || []).filter((s) => s && s.subCategoryId);
    if (!subs.length) out.push({ label: `${c.categoryName}`, path: [d.departmentName, c.categoryName], url: `${origin}/${slug(d.departmentName)}/${slug(c.categoryName)}/${d.departmentId}/${c.categoryId}` });
    for (const s of subs) out.push({
      label: `${c.categoryName} › ${s.subCategoryName}`, path: [d.departmentName, c.categoryName, s.subCategoryName],
      url: `${origin}/${slug(d.departmentName)}/${slug(c.categoryName)}/${slug(s.subCategoryName)}/${d.departmentId}/${c.categoryId}/${s.subCategoryId}`,
    });
  }
  return out;
}

const DETAIL_RE = /\/detail\/([0-9a-f-]{36})\/([0-9a-f-]{36})/i;
/** product lines a page points at: product links in the markup, and productId/subProductId pairs in its data */
export function linesOn(html, base) {
  const found = new Map();   // productId → url
  // a listing at /<dept>/<category>/<sub>/<ids…> gives the first three for links built from data
  const segs = new URL(base).pathname.split('/').filter(Boolean);
  const slugs = segs.length >= 6 ? segs.slice(0, 3).join('/') : null;
  for (const m of String(html).matchAll(/href=["']([^"']*\/detail\/[0-9a-f-]{36}\/[0-9a-f-]{36})[^"']*["']/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), base).toString(); } catch { continue; }
    const d = u.match(DETAIL_RE); if (d && !found.has(d[1])) found.set(d[1], u);
  }
  const walk = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
    const pid = o.productId;
    if (typeof pid === 'string' && /^[0-9a-f-]{36}$/i.test(pid) && !found.has(pid) && slugs) {
      const sid = o.subProductId || o.defaultSubProductId || (Array.isArray(o.subProducts) && o.subProducts[0] && o.subProducts[0].subProductId);
      // product pages live at /<dept>/<category>/<sub>/<model>/detail/<line>/<variant>
      if (sid) found.set(pid, new URL(`/${slugs}/${slug(o.modelName || o.name || 'product') || 'product'}/detail/${pid}/${sid}`, base).toString());
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(nodeData(kitData(html)), 0);
  return found;
}

/** pagination hints in a listing's data (total counts, page sizes) — for the log */
export function pagingHints(html) {
  const hits = {};
  const walk = (o, depth, key) => {
    if (!o || typeof o !== 'object' || depth > 6) return;
    for (const [k, v] of Object.entries(o)) {
      if (/total|count|page|size|skip|take|offset|limit/i.test(k) && (typeof v === 'number' || typeof v === 'boolean')) hits[(key ? key + '.' : '') + k] = v;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1, k);
    }
  };
  walk(nodeData(kitData(html)), 0, '');
  return hits;
}

/**
 * Every product line in every listing. `get(url)` returns { text } or throws.
 * Pages: tries ?page=2, ?pageNumber=2, ?p=2 and keeps the first that brings
 * new lines; walks on until a page adds nothing.
 */
export async function crawlListings(get, origin, nav, { log = () => {}, maxPages = 200, only = null, onPage = null } = {}) {
  const lines = new Map();
  const list = listingsOf(origin, nav).filter((l) => !only || only.some((o) => l.label.toLowerCase().includes(o.toLowerCase())));
  const PARAMS = ['page', 'pageNumber', 'p'];
  for (const l of list) {
    const before = lines.size; let pages = 0, param = null, how = '';
    const take = (html) => { let n = 0; for (const [pid, u] of linesOn(html, l.url)) if (!lines.has(pid)) { lines.set(pid, { url: u, path: l.path }); n++; } return n; };
    let first;
    try { first = (await get(l.url)).text; } catch (e) { log(`  ✗ ${l.label}: ${e.message}`); continue; }
    pages++; if (onPage) await onPage(l, 1, first);
    const firstCount = linesOn(first, l.url).size; take(first);
    if (firstCount) {
      for (const p of PARAMS) {
        let t; try { t = (await get(`${l.url}?${p}=2`)).text; } catch { continue; }
        if (onPage) await onPage(l, 2, t, p);
        if (take(t)) { param = p; pages++; break; }
      }
      for (let n = 3; param && n <= maxPages; n++) {
        let t; try { t = (await get(`${l.url}?${param}=${n}`)).text; } catch { break; }
        pages++;
        if (!take(t)) break;
      }
      how = param ? ` (${pages} pages via ?${param}=)` : ' (one page)';
    }
    log(`  ${l.label}: ${lines.size - before} product lines${how}`);
  }
  return lines;
}

/* ---------- a product page → one record per variant ---------- */
const plain = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export function productsFromPage(html, url) {
  const data = nodeData(kitData(html)).find((d) => d.product && Array.isArray(d.product.subProducts));
  if (!data) return null;
  const pr = data.product;
  const origin = new URL(url).origin;
  const seoUrl = (data.seo && data.seo.openGraph && data.seo.openGraph.url) || url;
  const base = new URL(seoUrl, origin).pathname.replace(/\/detail\/.*$/, '');
  const info = (pr.departmentInfos || []).find((d) => d.isPrimary) || (pr.departmentInfos || [])[0] || {};
  const categories = [info.departmentName, info.categoryName, info.subCategoryName].filter(Boolean);
  const storeId = ((data.dealerProfiles || [])[0] || {}).storeId;
  const subs = pr.subProducts.filter((s) => s && s.subProductId && (s.storeSubProductDataVms || []).length);
  // the attributes that tell this line's variants apart (what the size/caliber buttons pick)
  const vals = {};
  for (const s of subs) for (const a of s.attributes || []) { const k = String(a.attributeName || '').trim(); if (k) (vals[k] = vals[k] || new Set()).add(String(a.valueName ?? '').trim()); }
  const picks = Object.keys(vals).filter((k) => vals[k].size > 1);
  return subs.map((s) => {
    const v = s.storeSubProductDataVms.find((x) => x.storeId === storeId) || s.storeSubProductDataVms[0];
    const attributes = {};
    if (s.upc) attributes.UPC = String(s.upc);
    if (s.manufacturerPartNumber) attributes['Manufacturer Part Number'] = String(s.manufacturerPartNumber);
    for (const a of [...(s.attributes || []), ...(s.optionalAttributes || [])]) {
      const k = String((a && a.attributeName) || '').trim(), val = String((a && a.valueName) ?? '').trim();
      if (k && val) attributes[k] = val;
    }
    const variant = {};
    for (const k of picks) if (attributes[k]) variant[k] = attributes[k];
    const hidden = !!v.addToCartToSeePrice;
    const sale = +v.salePrice || 0, full = +v.fullPrice || 0;
    const price = hidden ? null : (sale || full || null);
    const qty = Number.isFinite(+v.quantityOnHand) ? +v.quantityOnHand : null;
    const availability = v.isStoreInventory ? (qty > 2 ? 'in' : qty > 0 ? 'low' : 'out') : (qty > 0 ? 'ship' : qty === 0 ? 'out' : null);
    return {
      source: 'gearfire',
      id: s.subProductId,
      line: pr.productId,
      name: String(pr.modelName || '').trim(),
      subtitle: String(s.description || '').trim() || null,
      variant: Object.keys(variant).length ? variant : null,
      brand: pr.manufacturerName || null,
      sku: s.manufacturerPartNumber ? String(s.manufacturerPartNumber) : null,
      upc: s.upc ? String(s.upc) : null,
      price, regularPrice: !hidden && full > price ? full : null,
      priceNote: hidden ? 'Call for price' : null,
      currency: 'USD',
      availability, stock: qty, storeStock: !!v.isStoreInventory,
      firearm: !!s.isFirearm, nfa: !!s.isNfa,
      noShipTo: (v.doNotShipToStates || []).length ? v.doNotShipToStates : null,
      categories, tags: [],
      attributes,
      description: plain(pr.modelDescription) || null,
      images: (s.imageUrls || []).filter(Boolean),
      permalink: `${origin}${base}/detail/${pr.productId}/${s.subProductId}`,
    };
  });
}
