# Agarthan Armory — storefront + catalog sync

The site for **agarthanarmory.com**, a federally licensed firearms dealer,
themed as the last outpost before the ice wall: polar night and aurora, the
north-polar "flat earth" map as navigation, Hyperborea and Agartha at the
pole, UFO lore, holographic tech UI. Plus the scraper that pulls the store's
real catalog (prices, descriptions, specs, stock, photos) into it.

Plain static files, zero npm dependencies, Node ≥ 18 for the tools.

```
index.html        home: hero, departments, the ice wall map, featured, transfers, story, visit
armory.html       catalog: search, department/caliber/brand/stock filters, sort, item detail
transfers.html    FFL transfers: steps, fees, what to bring, services, FAQ
404.html          signal lost beyond the wall
assets/js/config.js        ← THE STORE'S FACTS (address, FFL #, phone, hours, fees…)
assets/data/catalog.js     what the Armory shows (sample until the first sync)
assets/data/overrides.json hand corrections to the synced catalog
scripts/           probe-site · scrape · build-catalog · test-scrape
.github/workflows/ Probe the store · Scrape catalog · Test
partials/          header, footer, age gate (stamped into every page)
tools/             art generators: hero wall, map coastlines, icons, share card
```

## Run it

```bash
npm start
```

That's http://localhost:3000. Any static server works too (`python3 -m http.server`).

## 1. Fill in the store's facts

Edit `assets/js/config.js`. Every fact left `null` shows on the site as a
dashed amber chip (`[ PHONE ]`, `[ FFL # ]`), so nothing missing is ever
invented or silently blank. Needed before launch: legal name, FFL number and
type, phone, email, address, hours, transfer fees, socials. Optional: `geo`
plots the store as a beacon on the map, `formEndpoint` (Formspree or similar)
lets the contact form and requisition list post instead of opening the
visitor's mail app, and `storeUrl` adds "Buy online" buttons that link to the
real store.

## 2. Pull the real catalog

The scraper runs on GitHub's runners, because Claude's sandbox can't reach the
store.

1. **Actions → Probe the store → Run workflow.** It reports what the site runs
   on (WooCommerce, Shopify, a gun-store platform…), whether the exact product
   feeds are open, and how product pages are built. Read it in the run's
   Summary tab.
2. **Actions → Scrape catalog → Run workflow.** Do a trial with `limit` = `20`
   first, then run again with it blank. The run:
   - commits `assets/data/scraped/` and the photos to `assets/img/products/`;
   - rebuilds `assets/data/catalog.js`.

   The site then shows the real inventory, and the "sample inventory" notice
   disappears by itself.
3. **Fix anything misfiled** in `assets/data/overrides.json`. Change a
   department, hide an item, feature it on the home page, or give it a lore
   line. Then run `npm run build:catalog`, or the workflow again.

If the store blocks datacenter IPs (a "bot protection" message in the run),
run the same thing from a normal connection:

```bash
npm run sync
```

That runs `npm run scrape` then `npm run build:catalog`. Extra flags pass
through, for example `npm run scrape -- --limit 20`.

**A second storefront** (for example a separate shop subdomain) goes in its own
folder, and `build-catalog` merges every folder under `assets/data/scraped/`:

```bash
npm run scrape:shop
```

The Gearfire shop sits behind a CloudFront firewall that refuses GitHub's
servers, so run that one from a normal home or office connection (Node 18+),
then `npm run build:catalog` and push. Catalogs over 400 products save one
photo each unless you pass `--max-images`.

**How it reads the store, cheapest and most exact first:**

1. The WooCommerce Store API (`/wp-json/wc/store/v1/products`).
2. Shopify `/products.json`.
3. The sitemap, then each product page's JSON-LD, microdata, `og:` meta and
   page structure.
4. A polite crawl from the home page.

It keeps brand, SKU, price, sale price, "call for price", stock, categories,
spec rows (caliber, capacity, barrel…), the full description and up to 6
photos.

**Safety:**
- A failed or empty run writes nothing.
- A run that finds less than half the last good catalog stops; pass
  `--allow-shrink` if the store really shrank.
- `robots.txt` is respected unless you pass `--ignore-robots`.
- Photos are checked to be real images.
- No SKU, price or spec is ever made up.

**How items are sorted** (`scripts/build-catalog.mjs`):
- **Department and firearm status:** the store's own categories first, then
  the listing name. A cartridge plus a barrel length reads as a gun; buckshot
  is ammo, not a shotgun; a scope mount is gear, not an optic.
- **Firearm status** drives the FFL / 4473 note.
- **Icon:** the hologram schematic is chosen from the platform: pistol,
  revolver, AR, bolt, lever, rimfire, battle rifle, pump or semi shotgun, ammo,
  shells, red dot, scope, thermal, light, magazine, case, kit or safe.
- **Store photos** replace the schematic when the scrape has them.

`npm test` runs the scraper and the classifier against mock stores (65 checks).
The Test workflow runs it on every push that touches `scripts/`.

Lineage: PAMAX's WooCommerce and BigCommerce scrapers and XAT Racing's
prober, X-Cart and Shopify scrapers, merged into one adaptive tool.

## 3. Deploy

The repo root is the site, with no build step.

- **Netlify or Cloudflare Pages:** publish directory `/`, build command empty.
- **Render:** `render.yaml` is a ready blueprint (New + → Blueprint → this
  repo). It runs `npm start` as a Starter web service, which serves only the
  public files. A Static Site with publish directory `.` also works.

Point the domain's DNS where the host says. HTTPS is automatic on all of them.

## Editing

- **Header, footer or age gate:** edit `partials/*.html`, then run
  `npm run stamp`.
- **Map outposts** (which lore place stands for which department): the
  `NODES` list in `assets/js/map.js`.
- **Art:**
  - Hero wall: `npm run build:wall`.
  - Product schematics: `npm run build:icons`.
  - Map coastlines: `node tools/build-map.mjs land-50m.json`, using the file
    from the `world-atlas` npm package.
  - Share card and app icon: `node tools/gen-social-card.mjs`, which needs
    Playwright.

## Before going live — compliance checklist

- [ ] FFL number, license type, legal name and address shown (config.js).
- [ ] Age gate age set (`ageMin`, default 21).
- [ ] Transfer fees, services and the transfer FAQ match how the store
      actually operates; the owner has read every answer.
- [ ] State rules covered for anything sold or shipped (ammo shipping,
      magazine limits, waiting periods).
- [ ] No checkout on this site. The requisition list is a reservation request.
      If online checkout is wanted, link to the store platform's own checkout
      (`storeUrl`). Firearms are a high-risk merchant category, and payment
      stays with the platform's processor.

## Theme notes

The theme draws on:
- Hyperborea, the Greek land beyond the north wind, and Mercator's 1595 polar
  chart.
- Agartha, the hollow-earth kingdom, and Vril, the inner-earth energy from
  Bulwer-Lytton's *The Coming Race* (1871).
- The ice wall and the polar map, with Antarctica as the edge of the world.
- Admiral Byrd and Operation Highjump.
- UFOs:
  - Roswell, Tunguska and Nazca outposts on the map.
  - A rotating craft registry over the hero: disc, Tic Tac, black triangle and
    foo fighter.
- Runic inscriptions in Elder Futhark (`AA.runes()` in `assets/js/site.js`,
  set with the Noto Sans Runic font).
- Advanced-tech HUD styling.

## Where this came from

Started in `comeupdream/pamax-tactical` (branch `claude/brave-cori-gprd7a`,
folder `agarthan-armory/`) and moved here as this repo's root, so the
workflows in `.github/workflows/` run from the Actions tab. This repo is the
source of truth from here on; the copy in the PAMAX branch is frozen and can
be deleted.
