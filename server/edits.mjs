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
export const PRODUCT_FIELDS = {
  name: str(200), brand: str(80), price: num(0, 1_000_000), priceNote: str(60), lore: str(200), desc: str(6000),
  dept: oneOf(DEPTS), sub: str(80), type: oneOf(TYPES), specs: SPEC,
  firearm: bool, nfa: bool, featured: bool, hide: bool, noPhoto: bool,
  _name: str(200), _photo: str(300), _note: str(300),
};

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

/** the whole settings file, checked */
export function validateSettings(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail('settings must be an object');
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'facts') out.facts = validateFacts(v);
    else if (k === 'notices') out.notices = validateNotices(v);
    else if (k === 'synonyms') out.synonyms = validateSynonyms(v);
    else fail(`${k} is not a settings section`);
  }
  return out;
}
