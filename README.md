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
assets/video/      the client's Agartha art (looping piece + static piece) and their poster frames
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

## Product photos found online (find-images)

`scripts/find-images.mjs` searches the web for products without a photo
(brand + name + UPC, through the Brave Search API), prefers the manufacturer's
own site, downloads the best match and records where it came from. It also
writes `assets/data/scraped/photo-review.html`, a contact sheet to eyeball
before publishing (weaker matches outlined in pink). The API bills per search,
about $5 per 1,000; expect 1–2 searches per product.

**What gets searched first** (`--top N`): the cards on a first page that still
show a hologram, then everything else in the Armory's merit order (premium for
its category, deep distributor stock, a maker people ask for, on the store's
shelf). Out-of-stock products are skipped.

**The photo bar** (default; `--lenient` for the old one):
- **Strong match:** the maker's own site, or the product's name or UPC in
  the result's title.
- **Clean packshot:** a plain white or light-grey background. No lifestyle
  shots, dark backdrops, banners or listing screenshots.
- **Not cut off:** a product sliced through its stock or receiver is
  refused; one cropped tight with only its muzzle touching the edge is fine.
- **No watermark sites:** stock-photo, video and social sites are out.
- **Size is no bar:** bigger results rank first, and a small clean photo is
  enlarged to 800px.

**Recheck** (`--recheck`, free, no searches): photos already found online that
are plainly wrong (blank, or not a product shot) are taken down, and those
products go back on the list. So do the photos pulled by hand in
`overrides.json`. A photo taken down is never picked again. The store's own
products are never touched. Add `--dry-run` to see the list
(`photo-recheck.html`) first.

In PowerShell, in the project folder:

```bash
git pull
```

```bash
npm install sharp --no-save
```

```bash
node scripts/find-images.mjs --recheck --dry-run
```

```bash
node scripts/find-images.mjs --recheck
```

```bash
$env:BRAVE_API_KEY="paste-your-key-here"
```

```bash
node scripts/find-images.mjs --top 25
```

Open `assets\data\scraped\photo-review.html` in a browser; if they look
right, run the rest (about $12 at most):

```bash
node scripts/find-images.mjs --top 1500 --budget 2500
```

Then `npm run build:catalog`, commit and push. Runs resume where they left
off; `--retry` searches again for products nothing was found for. A dropped
connection, a timeout or a rate limit is retried; a product the API still
doesn't answer for is skipped (never marked "nothing found") and searched on
the next run. If the API stays down, the run stops with its progress saved.

## Product photos (by UPC)

Every scraped product carries a UPC. Gearfire's image server refuses
downloads, so photos come from the sources dealers are given them by: the
distributors' image packs and feed image links, and manufacturers' dealer
portals. `scripts/match-images.mjs` (`npm run images`) matches them by UPC:

```bash
npm i sharp
```

```bash
npm run images -- --folder path/to/image-pack
```

That covers files named by UPC. For a pack named by the distributor's own item
numbers, add their catalog file so the tool can translate them:

```bash
npm run images -- --folder rsr-images --csv rsr-inventory.txt --no-header --key-col 1 --upc-col 2
```

For a feed or spreadsheet with image links, point it at the file:

```bash
npm run images -- --csv feed.csv --upc-col UPC --image-cols "Image URL"
```

Then `npm run build:catalog` and push. Options: `--max 3` photos per product
(default 1 keeps the repo light), `--dry-run` to see how many would match first,
`--replace` to redo products that already have photos. `sharp` resizes to
1000 px JPEG (about 60–120 KB each); without it files are copied as-is.

## 3. Deploy

The repo root is the site, with no build step.

- **Netlify or Cloudflare Pages:** publish directory `/`, build command empty.
- **Render:** `render.yaml` is a ready blueprint (New + → Blueprint → this
  repo). It runs `npm start` as a Starter web service, which serves only the
  public files. On start it rebuilds the catalogue if the scrape, the
  corrections or the build code changed (`scripts/boot.mjs`), so pushing a new
  scrape is enough. A Static Site with publish directory `.` also works, but
  without the Ops Console.

Point the domain's DNS where the host says. HTTPS is automatic on all of them.

## Ops Console (/ops)

The staff back office, at **/ops** on the live site. It's ported from the
PAMAX and XAT Racing consoles and cut down to what an FFL store needs:

| Tab | What it does |
|---|---|
| Deck | Counts, setup checklist, deploy status, latest messages, dead-end searches |
| Inventory | Every product: search and filters (department, stock, photo, brand, flags), inline price, ★ featured, ◫ pull photo, ⊘ hide, bulk actions, and a full editor: name, brand, price note, lore, department, category, hologram, firearm/NFA, condition (New / Used / Consignment / Demo), search terms, a YouTube video, spec rows, description, and **photos** (upload, reorder, remove; the first is the cover) |
| Your listings | Products the distributor feed never carries: used and consignment guns, trade-ins, one-offs. Each has photos, a condition badge and a price, shows in the Armory like any product, and survives every scrape (`assets/data/custom-products.json`) |
| Photos & gaps | First-page cards still without a photo, pulled photos with Restore, and data-gap tiles (no photo, no price, no brand, featured but out of stock) that open Inventory filtered |
| Corrections | Everything in `overrides.json`, including hidden products (the only place to bring them back) |
| Store & notices | Store facts (hours, phone, fees, FFL, age gate, social links) and the notice bar above the ticker |
| Spotlight | Slides on the home page under the hero: headline, line, button, a product photo, an upload or a YouTube video, with optional dates; a live preview |
| Search | What people search for and what found nothing, synonyms (g19 = glock 19), and pins (these products first for a word) |
| Inbox | Requisitions (hold requests) and contact messages from the site's forms, with statuses and notes; each one is also emailed to the store |
| Traffic | Anonymous page views (no cookies, no IP addresses) and searches that found nothing |
| Orders | WooCommerce orders (status filter, firearm release: pickup or receiving FFL), a detail view, and a 30-day sales chart, read only |
| History | Every publish: what changed, who, when, with a link to the commit |
| Tools | Site check (pages, sitemap, robots, a sample of photos, published settings, the WooCommerce theme, email), test email, CSV diff, apply to a list of ids/SKUs, export/import, catalogue CSV, backup |
| Guide | How to do each common job, step by step |

**How saving works.**
1. Edits are staged in the browser. Photos are resized there (longest side
   1200px, WebP) and held until you publish.
2. **Publish** sends them all in one request.
3. The server checks every edit and every photo (by its bytes, not its name),
   then commits the changed files (`overrides.json`, `site-settings.json`,
   `custom-products.json`, and the photos under `assets/img/products/u-…` or
   `assets/img/uploads/u-…`) to this repo as **one commit**, through the GitHub
   API. If someone pushed in the meantime, it re-applies the edit on top of
   their commit; it never overwrites one it didn't see. Uploads always get new
   `u-…` names, so they can never replace a store photo.
4. Render redeploys, and `npm start` (`scripts/boot.mjs`) rebuilds the catalogue
   whenever its inputs changed. Edits go live in a few minutes and survive
   every later scrape, with git history as the audit trail (the History tab).
5. Store facts, notices, synonyms, pins and the Spotlight ride on `config.js`.
   The server merges them in when it serves that file.

**Switch it on** (Render → the service → Environment):

| Variable | For | |
|---|---|---|
| `OPS_PASSWORD` | Unlocking the console | Required. 8+ characters; changing it signs everyone out |
| `GH_TOKEN` | Publishing and History | A fine-grained GitHub token for **this repository only**, permission **Contents: Read and write** |
| `DATA_DIR` | Inbox, traffic, search log | `/var/data`, with a 1 GB disk mounted there (service → Disks). A service with a disk has a few seconds of downtime per deploy |
| `WOO_URL`, `WOO_CK`, `WOO_CS` | Orders tab, theme check | A **Read** REST key from WooCommerce → Settings → Advanced → REST API |
| `RESEND_API_KEY`, `ALERT_EMAIL` | Email alerts | A [Resend](https://resend.com) API key, and the store inbox the alerts go to. Without a key the alert is written to the server log instead |
| `MAIL_FROM`, `SITE_URL` | Optional | The sender once the store's domain is verified with Resend (`Agarthan Armory <alerts@yourdomain>`); the site address used in alert links |
| `GH_REPO`, `GH_BRANCH`, `OPS_SECRET`, `TRUST_PROXY` | Optional | The repo and branch default to what Render reports; `TRUST_PROXY=1` (the default) trusts the address Render appends |

Without the disk, the site's forms fall back to email (set the store email in
Store & notices). Without `GH_TOKEN`, use **Tools → Export staged edits** (it
includes listings and photos), then run:

```bash
node scripts/apply-ops-edits.mjs ops-edits.json
```

Then commit and push.

**Security.**
- The passcode is checked once, in constant time. After 10 different wrong
  passcodes, that address is locked out for 15 minutes.
- After unlocking, the console carries a signed 12-hour token, never the
  passcode.
- Every edit is validated on the server, against an allowlist of fields with
  type and length checks. Photos must really be WebP, JPEG or PNG (checked by
  their first bytes), at most 1.6 MB each and 24 per publish, and only into the
  two photo folders. A publish that points at a photo that isn't on the site
  is refused.
- The WooCommerce proxy is GET-only, and its paths are normalised before the
  allowlist. That closes a `../` bypass found in the PAMAX console.
- `/ops` runs under a strict Content-Security-Policy, and the site never sends
  it to search engines.
- Tests: `node scripts/test-ops.mjs` (server, in `npm test`) and
  `npm run test:ops-ui` (the console and the storefront in a browser, against
  stand-ins for GitHub, WooCommerce and the email provider; needs Playwright).

## Display settings (Realm button, top right)

Visitors can switch, and the choice is saved on their device (`assets/js/prefs.js`):

- **Realm** (colour theme): Polar Night, Inner Earth, Black & White, Agarthan
  Crystal, Vril. Each is one block of CSS variables in `assets/css/site.css`
  (`html[data-theme="…"]`). The decorative art (sky, ice wall, map, logo,
  craft) takes the theme's `--deco-filter`; product photos are never tinted.
- **Script** (typeface set): Ancient Tech (Cinzel), Future Tech (Orbitron +
  Exo 2), Old World (Uncial Antiqua + EB Garamond), Runic (Cinzel Decorative,
  with Elder Futhark lines under the headings).
- **Cursor**: standard, reticle, or a craft (disc, Tic Tac, black triangle,
  foo fighter) drawn in the theme's colours, with a tractor-beam flash on click.

To add a realm: copy a theme block in `site.css`, then add it to `THEMES` in
`prefs.js`.

## Editing

- **Header, footer or age gate:** edit `partials/*.html`, then run
  `npm run stamp`. Run it after changing any stylesheet or script too: it
  stamps each link with a content version so browsers never keep a stale copy.
- **Agartha art videos** (from the client): the static piece
  (`agarthan-rotating.mp4`) stands on a lit pedestal in the home page's
  "Agarthan code" section; it plays once and rests on its last frame, with a
  Replay button. The looping piece (`agarthan-tech.mp4`) is the "checkpoint
  feed" in the transfers page hero. Both play only while on screen, start
  paused for visitors who ask for reduced motion, and have a Hold / Play
  button. To swap one, replace the `.mp4` in `assets/video/` (muted, with no
  audio track), its `.jpg` poster (the first frame) and, for the static piece,
  `-still.jpg` (the last frame). The `loop` attribute on the `<video>` decides
  which behavior it gets.
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

## On phones and tablets

The Armory below 960px follows the PAMAX Armory's mobile rebuild:
- **Products first:** a shorter hero, so products start on the first screen.
  The header art steps aside on narrow screens.
- **Departments:** one row of chips you swipe.
- **Filters:** a Filters button that always names what is filtering
  ("Sidearms · Revolvers · 2 more"), with a Clear button beside it. It opens
  every other filter as a bottom sheet: categories two to a row, manufacturer,
  caliber, price, in stock. A "Show N relics" button closes it.
- **Two products per row** below 600px. Names are clamped so prices line up.
- **Back to top:** a button on every page, after a screen and a half of
  scrolling.
- **Changing a filter or page** lands on the top of the results, below the
  sticky header.

Desktop keeps the sticky filter sidebar. Test it with `npm run test:mobile`
(390 and 360px phones, a tablet and a desktop pass; needs Playwright).

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
