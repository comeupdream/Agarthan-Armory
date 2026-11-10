/* =============================================================================
 * edits.mjs — what the Ops Console may change, checked before anything is
 * committed. Pure functions: no files, no network.
 *
 * Product corrections go to assets/data/overrides.json (keyed by product id;
 * scripts/build-catalog.mjs applies them). The console sends a PATCH, not the
 * whole file — { id: { field: value | null } }, null removing a field — and
 * the server applies it to the file as it stands at that moment. Two people
 * editing different products never overwrite each other (merge, not replace,
 * as in the XAT console).
 *
 * Store facts, site notices and search synonyms go to
 * assets/data/site-settings.json; server.mjs merges them into config.js.
 * ===========================================================================*/

export const DEPTS = ['sidearms', 'longarms', 'shotguns', 'ammo', 'optics', 'gear', 'nfa'];
export const TYPES = ['pistol', 'revolver', 'ar', 'bolt', 'lever', 'rimfire', 'battle', 'shotgun', 'semishotgun', 'ammo', 'shells',
  'reddot', 'scope', 'thermal', 'light', 'mag', 'case', 'kit', 'safe', 'can'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

class EditError extends Error {}
const fail = (msg) => { throw new EditError(msg); };
export const isEditError = (e) => e instanceof EditError;

const clean = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
const str = (max) => (v, k) => {
  if (typeof v !== 'string') fail(`${k} must be text`);
  const s = clean(v);
  if (s.length > max) fail(`${k} is too long (${s.length} of ${max} characters)`);
  return s;
};
const bool = (v, k) => { if (typeof v !== 'boolean') fail(`${k} must be on or off`); return v; };
const oneOf = (list) => (v, k) => { if (!list.includes(v)) fail(`${k} must be one of ${list.join(', ')}`); return v; };
const num = (min, max) => (v, k) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${k} must be a number from ${min} to ${max}`);
  return Math.round(v * 100) / 100;
};

/* ---------------------------------------------------------------- products */
const SPEC = (v, k) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${k} must be a list of name → value`);
  const out = {};
  const entries = Object.entries(v);
  if (entries.length > 16) fail(`${k}: at most 16 rows`);
  for (const [sk, sv] of entries) {
    const name = str(40)(sk, `${k} name`);
    if (!/^[a-zA-Z][\w -]*$/.test(name)) fail(`${k}: "${name}" is not a usable spec name`);
    if (sv === null || sv === '') continue;
    out[name] = str(120)(String(sv), `${k} ${name}`);
  }
  return out;
};
export const UPLOAD_RE = /^assets\/img\/(products|uploads)\/u-[a-z0-9][a-z0-9-]{1,110}\.(webp|jpe?g|png)$/;
export const IMAGE_RE = /^assets\/img\/(products|uploads)\/[a-z0-9][a-z0-9._-]{2,119}\.(webp|jpe?g|png)$/i;
const IMAGES = (v, k) => {
  if (!Array.isArray(v) || v.length > 6) fail(`${k} must be a list of up to 6 photos`);
  return v.map((x) => { const p = str(160)(x, k); if (!IMAGE_RE.test(p)) fail(`${k}: "${p}" is not a photo on this site`); return p; });
};
const YT = (v, k) => { const s2 = str(20)(v, k); if (!/^[\w-]{11}$/.test(s2)) fail(`${k} must be a YouTube video id`); return s2; };
export const PRODUCT_FIELDS = {
  name: str(200), brand: str(80), price: num(0, 1_000_000), priceNote: str(60), lore: str(200), desc: str(6000),
  dept: oneOf(DEPTS), sub: str(80), type: oneOf(TYPES), specs: SPEC,
  firearm: bool, nfa: bool, featured: bool, hide: bool, noPhoto: bool,
  keywords: str(200), video: YT, cond: oneOf(['New', 'Used', 'Consignment', 'Demo']), images: IMAGES,
  _name: str(200), _photo: str(300), _note: str(300),
};

/* ------------------------------------------------- the store's own listings */
const CUSTOM_ID = /^c-[a-z0-9][a-z0-9-]{1,90}$/;
export function validateCustom(c, i = 0) {
  const k = `listing ${i + 1}`;
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail(`${k} must be an object`);
  if (!CUSTOM_ID.test(String(c.id || ''))) fail(`${k}: "${String(c.id).slice(0, 40)}" is not a listing id`);
  const allowed = { ...PRODUCT_FIELDS, status: oneOf(['in', 'low', 'ship', 'out']), sku: str(60) };
  const out = { id: c.id };
  for (const [f, v] of Object.entries(c)) {
    if (f === 'id' || v === null || v === '') continue;
    if (f.startsWith('_') || ['hide', 'noPhoto'].includes(f)) continue;
    if (!allowed[f]) fail(`${k}: ${f} is not a listing field`);
    out[f] = allowed[f](v, `${k} ${f}`);
  }
  if (!out.name) fail(`${k} needs a name`);
  if (!out.dept) fail(`${k} needs a department`);
  if (!out.status) out.status = 'in';
  return out;
}
export function validateCustomChange(ch) {
  if (!ch || typeof ch !== 'object') fail('listing changes must be an object');
  const upsert = Array.isArray(ch.upsert) ? ch.upsert : [];
  const remove = Array.isArray(ch.remove) ? ch.remove : [];
  if (upsert.length + remove.length > 500) fail('at most 500 listing changes per publish');
  return { upsert: upsert.map(validateCustom), remove: remove.map((id) => { if (!CUSTOM_ID.test(String(id))) fail(`"${id}" is not a listing id`); return id; }) };
}
export function applyCustomChange(list, ch) {
  const out = Array.isArray(list) ? list.slice() : [];
  for (const id of ch.remove) { const i = out.findIndex((x) => x.id === id); if (i >= 0) out.splice(i, 1); }
  for (const c of ch.upsert) { const i = out.findIndex((x) => x.id === c.id); if (i >= 0) out[i] = c; else out.unshift(c); }
  return out;
}

/* ------------------------------------------------------------------ uploads */
/** photos sent with a publish: [{ path, data (base64) }] → checked by their bytes, not their names */
export function validateUploads(list) {
  if (!Array.isArray(list)) fail('uploads must be a list');
  if (list.length > 24) fail('at most 24 photos per publish');
  return list.map((u, i) => {
    const k = `photo ${i + 1}`;
    const p = str(160)(u && u.path, `${k} path`);
    if (!IMAGE_RE.test(p)) fail(`${k}: "${p}" is not an allowed photo path`);
    if (!UPLOAD_RE.test(p)) fail(`${k}: uploads are named assets/img/products|uploads/u-…, so they never replace a store photo`);
    if (typeof u.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(u.data)) fail(`${k} is not image data`);
    const buf = Buffer.from(u.data, 'base64');
    if (buf.length > 1_600_000) fail(`${k} is too large (${Math.round(buf.length / 1024)} KB of 1,600)`);
    const isWebp = buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const ext = p.split('.').pop().toLowerCase();
    if (!((isWebp && ext === 'webp') || (isJpeg && /jpe?g/.test(ext)) || (isPng && ext === 'png'))) fail(`${k} is not a WebP, JPEG or PNG image`);
    return { path: p, base64: u.data };
  });
}

/** Check a product patch. Returns the cleaned patch. */
export function validateProductPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('product edits must be an object keyed by product id');
  const ids = Object.keys(patch);
  if (ids.length > 5000) fail('at most 5,000 products per publish');
  const out = {};
  for (const id of ids) {
    if (!ID_RE.test(id)) fail(`"${String(id).slice(0, 40)}" is not a product id`);
    const p = patch[id];
    if (p === null) { out[id] = null; continue; }                         // drop every correction for this product
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail(`edits for ${id} must be an object`);
    const fields = {};
    for (const [k, v] of Object.entries(p)) {
      const check = PRODUCT_FIELDS[k];
      if (!check) fail(`${k} is not a field the console can change`);
      fields[k] = v === null ? null : check(v, k);
    }
    out[id] = fields;
  }
  return out;
}

/** Apply a validated patch to the overrides document (in place). Returns a change summary. */
export function applyProductPatch(doc, patch) {
  const summary = { products: 0, set: 0, cleared: 0 };
  for (const [id, fields] of Object.entries(patch)) {
    summary.products++;
    if (fields === null) { if (doc[id]) summary.cleared += Object.keys(doc[id]).length; delete doc[id]; continue; }
    const cur = { ...(doc[id] || {}) };
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === false && ['featured', 'hide', 'noPhoto'].includes(k)) {
        if (k in cur) { delete cur[k]; summary.cleared++; }
      } else { cur[k] = v; summary.set++; }
    }
    // a pulled photo keeps its note; anything else without a real correction left goes
    const real = Object.keys(cur).filter((k) => !k.startsWith('_'));
    if (!cur.noPhoto) delete cur._photo;
    if (real.length) doc[id] = cur; else delete doc[id];
  }
  return summary;
}

/* -------------------------------------------------------------- store facts */
const url = (v, k) => {
  if (v === null || v === '') return null;
  const s = str(300)(v, k);
  let u;
  try { u = new URL(s); } catch { fail(`${k} must be a full web address (https://…)`); }
  if (u.protocol !== 'https:') fail(`${k} must start with https://`);
  return u.href;
};
const email = (v, k) => {
  if (v === null || v === '') return null;
  const s = str(120)(v, k);
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(s)) fail(`${k} is not an email address`);
  return s;
};
const fee = (v, k) => (v === null || v === '' ? null : num(0, 2000)(v, k));
const obj = (shape) => (v, k) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${k} must be a group of settings`);
  const out = {};
  for (const [sk, sv] of Object.entries(v)) {
    if (!shape[sk]) fail(`${k}.${sk} is not a setting the console can change`);
    out[sk] = shape[sk](sv, `${k}.${sk}`);
  }
  return out;
};
const hours = (v, k) => {
  if (!Array.isArray(v) || v.length !== 7) fail(`${k} must list all seven days`);
  return v.map((row, i) => {
    if (!Array.isArray(row) || row[0] !== DAYS[i]) fail(`${k} day ${i + 1} must be ${DAYS[i]}`);
    return [DAYS[i], row[1] === null || row[1] === '' ? null : str(40)(row[1], `${k} ${DAYS[i]}`)];
  });
};
const geo = (v, k) => (v === null ? null : obj({ lat: num(-90, 90), lon: num(-180, 180) })(v, k));
export const FACT_FIELDS = {
  name: str(80), legalName: str(120), phone: str(30), email,
  address: obj({ street: str(120), city: str(60), state: str(30), zip: str(12) }),
  hours, ageMin: (v, k) => oneOf([18, 21])(v, k),
  ffl: obj({ number: str(30), type: str(60), sot: bool }),
  fees: obj({ longGun: fee, handgun: fee, additional: fee, privateParty: fee, nfa: fee }),
  social: obj({ instagram: url, facebook: url, x: url, youtube: url, tiktok: url }),
  nfaLabels: obj({ suppressor: bool, sbr: bool, sbs: bool }),
  formEndpoint: url, storeUrl: url, geo,
};
export function validateFacts(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) fail('store facts must be an object');
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (!FACT_FIELDS[k]) fail(`${k} is not a store fact the console can change`);
    out[k] = FACT_FIELDS[k](v, k);
  }
  return out;
}

/* ------------------------------------------------------------------ notices */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function validateNotices(list) {
  if (!Array.isArray(list)) fail('notices must be a list');
  if (list.length > 8) fail('at most 8 notices');
  return list.map((n, i) => {
    const k = `notice ${i + 1}`;
    if (!n || typeof n !== 'object') fail(`${k} must be an object`);
    const text = str(160)(n.text ?? '', `${k} text`);
    if (!text) fail(`${k} needs some text`);
    let link = null;
    if (n.link) {
      const l = str(300)(n.link, `${k} link`);
      if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(l)) link = l;               // a page on this site
      else link = url(l, `${k} link`);
    }
    const out = { id: str(40)(String(n.id || `n${i + 1}`), `${k} id`), text, link, tone: oneOf(['info', 'alert', 'aurora'])(n.tone || 'info', `${k} tone`), on: n.on !== false };
    for (const d of ['start', 'end']) {
      if (n[d]) { if (!DATE_RE.test(n[d])) fail(`${k} ${d} must be a date (YYYY-MM-DD)`); out[d] = n[d]; }
    }
    if (out.start && out.end && out.end < out.start) fail(`${k} ends before it starts`);
    return out;
  });
}

/* ----------------------------------------------------------------- synonyms */
export function validateSynonyms(list) {
  if (!Array.isArray(list)) fail('synonyms must be a list of groups');
  if (list.length > 300) fail('at most 300 synonym groups');
  return list.map((g, i) => {
    if (!Array.isArray(g)) fail(`group ${i + 1} must be a list of words`);
    const words = [...new Set(g.map((w) => str(40)(String(w), `group ${i + 1}`).toLowerCase()).filter(Boolean))];
    if (words.length < 2 || words.length > 12) fail(`group ${i + 1} needs 2 to 12 words`);
    return words;
  });
}

/* ------------------------------------------------------------ search pins */
export function validatePins(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('pins must be search words → product ids');
  const entries = Object.entries(v);
  if (entries.length > 150) fail('at most 150 pinned searches');
  const out = {};
  for (const [q, ids] of entries) {
    const term = str(40)(q, 'pinned search').toLowerCase();
    if (!term) continue;
    if (!Array.isArray(ids) || !ids.length || ids.length > 12) fail(`"${term}" needs 1 to 12 products`);
    out[term] = ids.map((id) => { if (!ID_RE.test(String(id))) fail(`"${id}" is not a product id`); return String(id); });
  }
  return out;
}

/* ---------------------------------------------------------------- spotlight */
export function validateSpotlight(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('spotlight must be an object');
  const interval = v.interval == null ? 7 : num(4, 30)(v.interval, 'slide interval');
  if (!Array.isArray(v.slides) || v.slides.length > 8) fail('spotlight needs a list of up to 8 slides');
  const slides = v.slides.map((sl, i) => {
    const k = `slide ${i + 1}`;
    if (!sl || typeof sl !== 'object') fail(`${k} must be an object`);
    const out = { id: str(40)(String(sl.id || `s${i + 1}`), `${k} id`), on: sl.on !== false, title: str(90)(sl.title ?? '', `${k} title`) };
    if (!out.title) fail(`${k} needs a headline`);
    for (const [f, max] of [['eyebrow', 40], ['text', 220], ['cta', 30]]) if (sl[f]) out[f] = str(max)(sl[f], `${k} ${f}`);
    if (sl.link) { const l = str(300)(sl.link, `${k} link`); out.link = /^\/(?!\/)[\w\-./?=&%#+]*$/.test(l) ? l : url(l, `${k} link`); }
    if (sl.image) { const im = str(160)(sl.image, `${k} image`); if (!IMAGE_RE.test(im) && !/^assets\/img\/[\w/-]+\.(webp|jpe?g|png|avif)$/i.test(im)) fail(`${k}: the image must be a photo on this site`); out.image = im; }
    if (sl.video) out.video = YT(sl.video, `${k} video`);
    for (const d of ['start', 'end']) if (sl[d]) { if (!DATE_RE.test(sl[d])) fail(`${k} ${d} must be a date`); out[d] = sl[d]; }
    return out;
  });
  return { interval, slides };
}

/** the whole settings file, checked */
export function validateSettings(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail('settings must be an object');
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'facts') out.facts = validateFacts(v);
    else if (k === 'notices') out.notices = validateNotices(v);
    else if (k === 'synonyms') out.synonyms = validateSynonyms(v);
    else if (k === 'pins') out.pins = validatePins(v);
    else if (k === 'spotlight') out.spotlight = validateSpotlight(v);
    else fail(`${k} is not a settings section`);
  }
  return out;
}

/** every photo path a publish refers to (product edits, listings, spotlight) */
export function photosIn({ patch, custom, settings }) {
  const set = new Set();
  for (const st of Object.values(patch || {})) for (const p of (st && st.images) || []) set.add(p);
  for (const c of (custom && custom.upsert) || []) for (const p of c.images || []) set.add(p);
  for (const x of ((settings && settings.spotlight) || {}).slides || []) if (x.image) set.add(x.image);
  return [...set];
}
