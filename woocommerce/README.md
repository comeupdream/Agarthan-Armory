# Agarthan Armory — WooCommerce skin

A Storefront child theme that dresses the whole WooCommerce store in the
Agarthan Armory look: polar night, aurora light, the seal, the ticker, HUD
panels and hologram schematics. It matches the site in this repo, and it adds
the firearm handling a gun store's checkout needs.

```
woocommerce/
  theme/agarthan-armory/      the theme (style.css, functions.php, assets/)
  theme/agarthan-armory.zip   the same, ready to upload
  tools/                      tests, the render harness, the packer
```

## Install

1. In WordPress: **Appearance → Themes → Add New**, search **Storefront**, install it (don't activate).
2. **Add New → Upload Theme**, choose `theme/agarthan-armory.zip`, install, **Activate**.
3. **Appearance → Menus**: put the store's links (Shop / Firearms / Ammo / Optics / NFA / FFL Transfers / Visit) in a menu assigned to **Primary Menu**.
4. Make sure these pages exist and are published — the footer links to them by slug:
   `terms-and-conditions`, `privacy-policy`, `refund_returns` (or `returns`), and optionally `shipping`,
   `ffl-transfers`, `special-orders`, `contact`.
5. **WooCommerce → Settings → Shipping**: add **Local pickup** (firearms are released at the counter).

Activating the theme switches block-based Cart and Checkout pages to the
classic versions, which the skin, the firearm fields and payment gateways all
work with. Hand-edited pages are left alone. Uploading a newer zip later
updates the theme in place; menus, widgets and settings stay.

## What's skinned

Every page type a shopper can reach, plus the chrome around them:

| Page | Notes |
|---|---|
| Header | ticker with outpost time, seal + name, product search, menu, requisition (cart) count, mini-cart |
| Shop, categories, tags | HUD cards: department + stock light, photo on a white plate, brand line, price, sale badge, red NFA plate; sorting, pagination, category tiles |
| Search results / nothing found | same grid; "archive query" header |
| Product | gallery on a white plate, stock light, variations, add to cart, **firearm release note**, specs table, reviews, related / up-sells, sticky add-to-cart bar |
| Cart / empty cart | dark table, coupon, totals panel, cross-sells |
| Checkout | slim header (no menu competing with payment), coupon / login toggles, billing panels, **firearm release panel**, order review, payment box (card gateways included), terms |
| Order received | receipt pills, order table, firearm release summary, addresses |
| My Account | menu rail, dashboard, orders, addresses, account details, downloads |
| Login / register / lost password | two HUD panels |
| Policy and other pages, blog | readable long-form text, tables, quotes |
| 404 | search, promoted products, categories |
| Footer | the site's four columns, FFL plate, policy links + card marks (card processors require them), legal line |
| Order emails | navy header instead of WooCommerce purple |
| Age gate | the site's perimeter checkpoint on first visit (remembered 30 days) |
| Phones | two products per row, one-row header, Storefront's bottom bar (account / search / cart) |

For comparison, PAMAX's skin covers 4 page types in its live version (1.7.2: product, cart,
checkout, order received) and 11 in its staged 2.0 — this one covers the same 11 plus empty
cart, lost password, the age gate and the firearm panels, from the first release.

## Firearms

A product counts as a firearm when one of its categories sits under a firearm
department (Firearms, Handguns, Rifles, Shotguns, NFA, Suppressors, lower
receivers…) and under none of the never-firearm ones (ammunition, parts,
optics, apparel, air guns, muzzleloaders…). Names and slugs both count, so
"AR & Rifle-Caliber Pistols" works as written.

- **Product → Advanced → Firearm (FFL)** overrides it per product (always / never).
- On the product page a firearm shows how it is released (4473 + background check at the counter, or ship to your FFL).
- At checkout a cart with a firearm asks how it will be received — **pick up at the outpost** or **ship to my FFL dealer** (dealer name and phone required) — and requires an age / eligibility statement. The choice is saved on the order and shown in the admin, on the thank-you page, in My Account and in the order emails. It also rides on the order in the WooCommerce REST API (`agarthan_release`), so the site's Ops Console shows it in its Orders tab (theme 1.1.0+).
- Store managers can add `?aa-ffl-debug=1` to the cart or checkout URL to see which line counts as a firearm and why.

Products without a photo show the site's hologram for their kind (pistol,
rifle, shotgun, ammo, scope, thermal, suppressor, magazine, light, safe, kit…),
chosen from their categories, then their name.

## Settings

The store's facts (name, FFL number and type, phone, address, hours,
Instagram, age-gate age) sit at the top of `functions.php` in
`agarthan_facts()` — the same facts as the site's `assets/js/config.js`.
A snippet or plugin can change them without editing the theme:

```php
add_filter('agarthan_facts', function ($f) { $f['email'] = 'info@agarthanarmory.com'; return $f; });
add_filter('agarthan_card_marks', function () { return array('visa', 'mastercard', 'discover'); });
add_filter('agarthan_firearm_roots', function ($slugs) { $slugs[] = 'pistol-caliber-carbines'; return $slugs; });
```

`ship_to_ffl => false` turns checkout into counter-pickup only; `age_gate => false` turns the gate off.

## Questions for the owner before launch

- Ship firearms to other FFL dealers, or counter pickup only? (default: both)
- Which cards does the processor take? The footer shows Visa, Mastercard, Amex and Discover.
- The store's email address for the footer (blank for now, like the site).
- Age gate at 21 for the whole store (the site's setting), or 18?

## Testing

```bash
php woocommerce/tools/test-theme.php
```

```bash
node woocommerce/tools/skin-audit.mjs --out .skin-audit
```

`test-theme.php` loads the real `functions.php` on a small stand-in for
WordPress and checks the firearm rules, the hologram choice, stock labels and
the header / footer / gate markup. `skin-audit.mjs` renders all 16 page types
on a desktop and a phone, using Storefront's own default colours and layout and
the theme's real output, and fails if the canvas isn't dark, a light surface
slips through, any text is hard to read (under 3:1), a phone scrolls sideways,
or a font doesn't load. Screenshots land in `.skin-audit/`.

Both run without a WordPress install. They don't replace one: on the first real
install, open Shop, a category, a product, the cart, checkout (with a firearm in
the cart), My Account and a policy page, and screenshot anything that looks off.

After changing the theme: `node woocommerce/tools/skin-audit.mjs --theme-shot`
(refreshes `screenshot.png`), then `node woocommerce/tools/pack.mjs` (rebuilds the zip).
