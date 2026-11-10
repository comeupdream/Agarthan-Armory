// The store's page types as WordPress + WooCommerce + Storefront render them —
// real body classes, real template markup — with the theme's own pieces
// (header, footer, cards, checkout panel…) taken from functions.php itself via
// render-parts.php. Used by skin-audit.mjs.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = JSON.parse(execFileSync('php', [path.join(HERE, 'render-parts.php')], { encoding: 'utf8' }));

const PHOTO = {
  101: '/assets/img/products/93288603-1582-49f1-8a0d-5d8bdb7e8b47-1.webp',
  102: '/assets/img/products/51f49fe2-3a4c-48b8-aec2-fb2e2469071d-1.webp',
  103: '/assets/img/products/7186a82d-a535-4947-aff9-c6f8f9db0f73-1.webp',
  104: '/assets/img/products/430727e0-11f1-4891-b17f-225a627b1544-1.webp',
};
const NAMES = {
  101: 'Rossi Brawler — 45 Colt, Fixed Sights', 102: 'Heckler &amp; Koch MR762 A4 Pistol — 7.62x51',
  103: 'TISHA 30 Cal Titanium Suppressor — FDE', 104: 'Personal Defense HST .40 S&amp;W 180 gr JHP',
  105: 'Thermion 2 LRF XP50 Pro Thermal Riflescope', 106: 'Glock 19 Gen5 9mm — 15 Round', 107: 'Agarthan Armory Expedition Tee',
};
const PRICE = { 101: [629.99], 102: [3499, 3899], 103: [949], 104: [36.99], 105: [5499.99], 106: [549], 107: [32] };
const money = (n) => `<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol">$</span>${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}</bdi></span>`;
const priceHtml = (id) => {
  const [now, was] = PRICE[id];
  return was ? `<del aria-hidden="true">${money(was)}</del> <span class="screen-reader-text">Original price was: $${was}.</span><ins aria-hidden="true">${money(now)}</ins>` : money(now);
};
const thumb = (id, size = 324) => PHOTO[id]
  ? `<img width="${size}" height="${size}" src="${PHOTO[id]}" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="" decoding="async" loading="lazy">`
  : P.cards[id].img;
const stars = (r = 4.67) => `<div class="star-rating" role="img" aria-label="Rated ${r} out of 5"><span style="width:${r * 20}%">Rated <strong class="rating">${r}</strong> out of 5</span></div>`;

const card = (id, i) => `
<li class="product type-product post-${id} status-publish ${i % 3 === 0 ? 'first' : i % 3 === 2 ? 'last' : ''} instock has-post-thumbnail purchasable product-type-simple">
  ${P.cards[id].top}
  <a href="#" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">${P.cards[id].tag}${PRICE[id][1] ? '<span class="onsale">Sale!</span>' : ''}${thumb(id)}${P.cards[id].brand}<h2 class="woocommerce-loop-product__title">${NAMES[id]}</h2>${id === 101 ? stars() : ''}<span class="price">${priceHtml(id)}</span></a>
  <a href="#" data-quantity="1" class="button product_type_simple add_to_cart_button ajax_add_to_cart" rel="nofollow">${id === 105 ? 'Read more' : 'Add to cart'}</a>
</li>`;
const grid = (ids, cols = 3) => `<ul class="products columns-${cols}">${ids.map(card).join('')}</ul>`;

const SEARCH = `<div class="widget woocommerce widget_product_search"><form role="search" method="get" class="woocommerce-product-search" action="#"><label class="screen-reader-text" for="woocommerce-product-search-field-0">Search for:</label><input type="search" id="woocommerce-product-search-field-0" class="search-field" placeholder="&gt; query the archive" value="" name="s"><button type="submit" value="Search">Search</button><input type="hidden" name="post_type" value="product"></form></div>`;
const MENU = `<li class="menu-item current-menu-item"><a href="#" aria-current="page">The Armory</a></li><li class="menu-item menu-item-has-children"><a href="#">Firearms</a><ul class="sub-menu"><li class="menu-item"><a href="#">Handguns</a></li><li class="menu-item"><a href="#">Rifles</a></li><li class="menu-item"><a href="#">Shotguns</a></li></ul></li><li class="menu-item"><a href="#">Ammo</a></li><li class="menu-item"><a href="#">Optics</a></li><li class="menu-item"><a href="#">NFA</a></li><li class="menu-item"><a href="#">FFL Transfers</a></li><li class="menu-item"><a href="#">Visit</a></li>`;
const MINICART = `<div class="widget woocommerce widget_shopping_cart"><div class="widget_shopping_cart_content"><ul class="woocommerce-mini-cart cart_list product_list_widget"><li class="woocommerce-mini-cart-item mini_cart_item"><a href="#" class="remove remove_from_cart_button" aria-label="Remove this item">×</a><a href="#">${thumb(101, 100)}${NAMES[101]}</a><span class="quantity">1 × ${money(629.99)}</span></li></ul><p class="woocommerce-mini-cart__total total"><strong>Subtotal:</strong> ${money(629.99)}</p><p class="woocommerce-mini-cart__buttons buttons"><a href="#" class="button wc-forward">View cart</a><a href="#" class="button checkout wc-forward">Checkout</a></p></div></div>`;

const chrome = (inner, { crumb = 'Shop', slim = false, sidebar = '' } = {}) => `
<div id="page" class="hfeed site">
  ${P.ticker}
  <header id="masthead" class="site-header" role="banner">
    <div class="col-full">
      <a class="skip-link screen-reader-text" href="#site-navigation">Skip to navigation</a>
      <a class="skip-link screen-reader-text" href="#content">Skip to content</a>
      ${P.branding}
      ${slim ? '' : `<div class="site-search">${SEARCH}</div>`}
    </div>
    ${slim ? '' : `<div class="storefront-primary-navigation"><div class="col-full">
      <nav id="site-navigation" class="main-navigation" role="navigation" aria-label="Primary Navigation">
        <button id="site-navigation-menu-toggle" class="menu-toggle" aria-controls="site-navigation" aria-expanded="false"><span>Menu</span></button>
        <div class="primary-navigation"><ul id="menu-primary" class="menu">${MENU}</ul></div>
        <div class="handheld-navigation"><ul id="menu-handheld" class="menu">${MENU}</ul></div>
      </nav>
      <ul id="site-header-cart" class="site-header-cart menu">
        <li><a class="cart-contents" href="#" title="View your shopping cart">${money(629.99)} <span class="count">1 item</span></a></li>
        <li>${MINICART}</li>
      </ul>
    </div></div>`}
  </header>
  ${slim ? '' : `<div class="storefront-breadcrumb"><div class="col-full"><nav class="woocommerce-breadcrumb" aria-label="breadcrumbs"><a href="#">Home</a><span class="breadcrumb-separator"> / </span>${crumb}</nav></div></div>`}
  <div id="content" class="site-content" tabindex="-1">
    <div class="col-full">
      <div class="woocommerce"></div>
      <div id="primary" class="content-area"><main id="main" class="site-main" role="main">
${inner}
      </main></div>
      ${sidebar}
    </div>
  </div>
  <footer id="colophon" class="site-footer" role="contentinfo"><div class="col-full">${P.footer}</div></footer>
  <div class="storefront-handheld-footer-bar"><ul class="columns-3"><li class="my-account"><a href="#">My Account</a></li><li class="search"><a href="#">Search</a><div class="site-search">${SEARCH}</div></li><li class="cart"><a class="footer-cart-contents" href="#">Cart <span class="count">1</span></a></li></ul></div>
</div>
${P.gate}`;

const page = (title, inner, extra = '') => `<article class="page type-page status-publish hentry"><header class="entry-header"><h1 class="entry-title">${title}</h1></header><div class="entry-content">${extra}<div class="woocommerce">${inner}</div></div></article>`;
const BODY = 'logged-in wp-embed-responsive theme-storefront woocommerce-active storefront-align-wide right-sidebar agarthan';
const FULL = ' page-template-template-fullwidth-php';
const sorting = (count) => `<div class="storefront-sorting"><div class="woocommerce-notices-wrapper"></div><form class="woocommerce-ordering" method="get"><select name="orderby" class="orderby" aria-label="Shop order"><option selected>Default sorting</option><option>Sort by popularity</option><option>Sort by price: low to high</option></select></form><p class="woocommerce-result-count">${count}</p><nav class="woocommerce-pagination" aria-label="Product Pagination"><ul class="page-numbers"><li><span aria-current="page" class="page-numbers current">1</span></li><li><a class="page-numbers" href="#">2</a></li><li><a class="page-numbers" href="#">3</a></li><li><span class="page-numbers dots">…</span></li><li><a class="page-numbers" href="#">771</a></li><li><a class="next page-numbers" href="#">→</a></li></ul></nav></div>`;
const field = (key, label, value = '', cls = 'form-row-wide', type = 'text') => `<p class="form-row ${cls} validate-required" id="${key}_field"><label for="${key}">${label}&nbsp;<abbr class="required" title="required">*</abbr></label><span class="woocommerce-input-wrapper"><input type="${type}" class="input-text " name="${key}" id="${key}" value="${value}"></span></p>`;
const select2 = (key, label, value) => `<p class="form-row form-row-wide address-field update_totals_on_change validate-required" id="${key}_field"><label for="${key}">${label}&nbsp;<abbr class="required" title="required">*</abbr></label><span class="woocommerce-input-wrapper"><select name="${key}" id="${key}" class="country_to_state country_select select2-hidden-accessible" tabindex="-1" aria-hidden="true" style="display:none"><option>${value}</option></select><span class="select2 select2-container select2-container--default" dir="ltr" style="width: 100%;"><span class="selection"><span class="select2-selection select2-selection--single" role="combobox" aria-haspopup="true" aria-expanded="false" tabindex="0"><span class="select2-selection__rendered" id="select2-${key}-container" role="textbox" aria-readonly="true" title="${value}">${value}</span><span class="select2-selection__arrow" role="presentation"><b role="presentation"></b></span></span></span><span class="dropdown-wrapper" aria-hidden="true"></span></span></span></p>`;
const privacy = `<div class="woocommerce-privacy-policy-text"><p>Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our <a href="#" class="woocommerce-privacy-policy-link" target="_blank">privacy policy</a>.</p></div>`;

const RELATED = `<section class="related products"><h2>Related products</h2>${grid([106, 104, 103])}</section>`;

export const PAGES = {
  shop: {
    label: 'Shop',
    bodyClass: `archive post-type-archive post-type-archive-product woocommerce-shop woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<header class="woocommerce-products-header"><h1 class="woocommerce-products-header__title page-title">Shop</h1></header>
${sorting('Showing 1–12 of 9,246 results')}${grid([101, 102, 103, 104, 105, 106, 107])}${sorting('Showing 1–12 of 9,246 results')}`),
  },
  category: {
    label: 'Category archive',
    bodyClass: `archive tax-product_cat term-firearms term-1 woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<header class="woocommerce-products-header"><h1 class="woocommerce-products-header__title page-title">Firearms</h1><div class="term-description"><p>Handguns, rifles and shotguns recovered from beyond the wall. Every one leaves the counter after a 4473 and a background check.</p></div></header>
<ul class="products columns-3"><li class="product-category product first"><a aria-label="Visit product category Handguns" href="#">${P.cards[106].img}<h2 class="woocommerce-loop-category__title">Handguns <mark class="count">(758)</mark></h2></a></li><li class="product-category product"><a href="#"><img src="${PHOTO[102]}" alt="AR Pistols" width="324" height="324"><h2 class="woocommerce-loop-category__title">AR &amp; Rifle-Caliber Pistols <mark class="count">(64)</mark></h2></a></li><li class="product-category product last"><a href="#">${P.cards[105].img}<h2 class="woocommerce-loop-category__title">Shotguns <mark class="count">(421)</mark></h2></a></li></ul>
${sorting('Showing 1–12 of 2,168 results')}${grid([101, 106, 102])}`, { crumb: 'Firearms' }),
  },
  search: {
    label: 'Search results',
    bodyClass: `search search-results post-type-archive post-type-archive-product woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<header class="woocommerce-products-header"><h1 class="woocommerce-products-header__title page-title">Search results: “9mm”</h1></header>${sorting('Showing all 2 results')}${grid([106, 104])}`, { crumb: 'Search results for “9mm”' }),
  },
  noresults: {
    label: 'Search — nothing found',
    bodyClass: `search search-no-results post-type-archive post-type-archive-product woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<header class="woocommerce-products-header"><h1 class="woocommerce-products-header__title page-title">Search results: “hyperborean blaster”</h1></header><div class="woocommerce-no-products-found"><div class="woocommerce-info">No products were found matching your selection.</div></div>`, { crumb: 'Search results' }),
  },
  product: {
    label: 'Product — firearm with photos',
    bodyClass: `product-template-default single single-product postid-101 woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<div class="woocommerce-notices-wrapper"></div>
<div id="product-101" class="product type-product post-101 status-publish first instock product_cat-handguns has-post-thumbnail shipping-taxable purchasable product-type-simple">
  <div class="woocommerce-product-gallery woocommerce-product-gallery--with-images woocommerce-product-gallery--columns-4 images" data-columns="4">
    <a href="#" class="woocommerce-product-gallery__trigger"><span aria-hidden="true">🔍</span><span class="screen-reader-text">View full-screen image gallery</span></a>
    <div class="flex-viewport"><div class="woocommerce-product-gallery__wrapper"><div class="woocommerce-product-gallery__image flex-active-slide"><a href="#"><img width="600" height="600" src="${PHOTO[101]}" class="wp-post-image" alt=""></a></div></div></div>
    <ol class="flex-control-nav flex-control-thumbs"><li><img src="${PHOTO[101]}" class="flex-active" width="100" height="100" alt=""></li><li><img src="${PHOTO[102]}" width="100" height="100" alt=""></li><li><img src="${PHOTO[103]}" width="100" height="100" alt=""></li></ol>
  </div>
  <div class="summary entry-summary">
    <h1 class="product_title entry-title">${NAMES[101]}</h1>
    <p class="price">${money(629.99)}</p>
    <div class="woocommerce-product-rating">${stars()}<a href="#reviews" class="woocommerce-review-link" rel="nofollow">(<span class="count">3</span> customer reviews)</a></div>
    <div class="woocommerce-product-details__short-description"><p>A single-action revolver built for the long night: forged steel frame, 4.75" barrel, fixed sights and a transfer bar safety.</p></div>
    <p class="stock in-stock">4 in stock</p>
    <form class="cart" method="post"><div class="quantity"><label class="screen-reader-text" for="quantity_1">Quantity</label><input type="number" id="quantity_1" class="input-text qty text" name="quantity" value="1" min="1" max="4" step="1"></div><button type="submit" name="add-to-cart" value="101" class="single_add_to_cart_button button alt">Add to cart</button></form>
    ${P.releaseNote}
    <div class="product_meta"><span class="sku_wrapper">SKU: <span class="sku">BRAWLER-45-BLK</span></span><span class="posted_in">Category: <a href="#" rel="tag">Handguns</a></span></div>
  </div>
  <div class="woocommerce-tabs wc-tabs-wrapper">
    <ul class="tabs wc-tabs" role="tablist"><li class="description_tab active" role="tab"><a href="#tab-description">Description</a></li><li class="additional_information_tab" role="tab"><a href="#tab-additional_information">Additional information</a></li><li class="reviews_tab" role="tab"><a href="#tab-reviews">Reviews (3)</a></li></ul>
    <div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--description panel entry-content wc-tab" id="tab-description" role="tabpanel"><h2>Description</h2><p>The Brawler pairs a classic Colt-pattern profile with modern metallurgy. Every revolver is test-fired at the factory and inspected again at our counter before release.</p><ul><li>Caliber: .45 Colt</li><li>Capacity: 6 rounds</li><li>Barrel: 4.75"</li></ul></div>
  </div>
</div>
${RELATED}`, { crumb: '<a href="#">Firearms</a><span class="breadcrumb-separator"> / </span><a href="#">Handguns</a><span class="breadcrumb-separator"> / </span>Rossi Brawler' }),
  },
  productHolo: {
    label: 'Product — no photo, variations, specs, reviews',
    bodyClass: `product-template-default single single-product postid-104 woocommerce woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<div class="woocommerce-notices-wrapper"><div class="woocommerce-message" role="alert"><a href="#" tabindex="1" class="button wc-forward">View cart</a> “Personal Defense HST” has been added to your cart.</div></div>
<div id="product-104" class="product type-product post-104 status-publish instock product_cat-handgun-ammo product-type-variable has-default-attributes">
  <span class="onsale">Sale!</span>
  <div class="woocommerce-product-gallery woocommerce-product-gallery--without-images woocommerce-product-gallery--columns-4 images" data-columns="4">
    <div class="woocommerce-product-gallery__wrapper"><div class="woocommerce-product-gallery__image--placeholder"><img src="${P.galleryHolo}" alt="Awaiting product image" class="wp-post-image"></div></div>
  </div>
  <div class="summary entry-summary">
    <h1 class="product_title entry-title">Federal Personal Defense HST</h1>
    <p class="price"><del aria-hidden="true">${money(42.99)}</del> <ins aria-hidden="true">${money(36.99)}</ins></p>
    <div class="woocommerce-product-details__short-description"><p>Law-enforcement duty load. Choose caliber and box size.</p></div>
    <form class="variations_form cart" method="post">
      <table class="variations" cellspacing="0" role="presentation"><tbody>
        <tr><th class="label"><label for="pa_caliber">Caliber</label></th><td class="value"><select id="pa_caliber" name="attribute_pa_caliber"><option value="">Choose an option</option><option selected>9mm Luger</option><option>.40 S&amp;W</option><option>.45 ACP</option></select></td></tr>
        <tr><th class="label"><label for="pa_box">Box</label></th><td class="value"><select id="pa_box" name="attribute_pa_box"><option>20 rounds</option><option>50 rounds</option></select><a class="reset_variations" href="#">Clear</a></td></tr>
      </tbody></table>
      <div class="single_variation_wrap"><div class="woocommerce-variation single_variation"><div class="woocommerce-variation-price"><span class="price">${money(36.99)}</span></div><div class="woocommerce-variation-availability"><p class="stock available-on-backorder">Available on backorder</p></div></div>
        <div class="woocommerce-variation-add-to-cart variations_button"><div class="quantity"><input type="number" class="input-text qty text" value="1"></div><button type="submit" class="single_add_to_cart_button button alt">Add to cart</button></div></div>
    </form>
    <div class="product_meta"><span class="sku_wrapper">SKU: <span class="sku">P40HST1</span></span><span class="posted_in">Category: <a href="#" rel="tag">Handgun Ammo</a></span><span class="tagged_as">Tags: <a href="#">duty</a>, <a href="#">jhp</a></span></div>
  </div>
  <div class="woocommerce-tabs wc-tabs-wrapper">
    <ul class="tabs wc-tabs" role="tablist"><li class="description_tab" role="tab"><a href="#tab-description">Description</a></li><li class="additional_information_tab active" role="tab"><a href="#tab-additional_information">Additional information</a></li><li class="reviews_tab" role="tab"><a href="#tab-reviews">Reviews (1)</a></li></ul>
    <div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--additional_information panel entry-content wc-tab" id="tab-additional_information" role="tabpanel"><h2>Additional information</h2>
      <table class="woocommerce-product-attributes shop_attributes"><tr class="woocommerce-product-attributes-item"><th class="woocommerce-product-attributes-item__label">Caliber</th><td class="woocommerce-product-attributes-item__value"><p>9mm Luger, .40 S&amp;W, .45 ACP</p></td></tr><tr><th class="woocommerce-product-attributes-item__label">Bullet</th><td class="woocommerce-product-attributes-item__value"><p>JHP</p></td></tr><tr><th class="woocommerce-product-attributes-item__label">Case</th><td class="woocommerce-product-attributes-item__value"><p>Brass</p></td></tr></table></div>
    <div class="woocommerce-Tabs-panel woocommerce-Tabs-panel--reviews panel entry-content wc-tab" id="tab-reviews" role="tabpanel"><div id="reviews" class="woocommerce-Reviews"><div id="comments"><h2 class="woocommerce-Reviews-title">1 review for <span>Federal Personal Defense HST</span></h2>
      <ol class="commentlist"><li class="review even thread-even depth-1" id="li-comment-9"><div id="comment-9" class="comment_container"><div class="comment-text">${stars(5)}<p class="meta"><strong class="woocommerce-review__author">R. Byrd</strong> <span class="woocommerce-review__dash">–</span> <time class="woocommerce-review__published-date">October 2, 2026</time></p><div class="description"><p>Feeds flawlessly. Same load my department carries.</p></div></div></div></li></ol></div>
      <div id="review_form_wrapper"><div id="review_form"><div id="respond" class="comment-respond"><span id="reply-title" class="comment-reply-title">Add a review</span><form class="comment-form"><div class="comment-form-rating"><label for="rating">Your rating&nbsp;<span class="required">*</span></label><p class="stars"><span><a class="star-1" href="#">1 of 5 stars</a><a class="star-2" href="#">2</a><a class="star-3" href="#">3</a><a class="star-4" href="#">4</a><a class="star-5" href="#">5</a></span></p></div><p class="comment-form-comment"><label for="comment">Your review&nbsp;<span class="required">*</span></label><textarea id="comment" name="comment" cols="45" rows="4"></textarea></p><p class="form-submit"><input name="submit" type="submit" id="submit" class="submit" value="Submit"></p></form></div></div></div></div></div>
  </div>
</div>
<section class="up-sells upsells products"><h2>You may also like…</h2>${grid([103, 101])}</section>`, { crumb: '<a href="#">Ammunition</a><span class="breadcrumb-separator"> / </span>Federal Personal Defense HST' }),
  },
  cart: {
    label: 'Cart',
    bodyClass: `page-template-default page page-id-7 woocommerce-cart woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('Cart', `<div class="woocommerce-notices-wrapper"></div>
<form class="woocommerce-cart-form" method="post"><table class="shop_table shop_table_responsive cart woocommerce-cart-form__contents" cellspacing="0">
<thead><tr><th class="product-remove"><span class="screen-reader-text">Remove item</span></th><th class="product-thumbnail"><span class="screen-reader-text">Thumbnail image</span></th><th class="product-name">Product</th><th class="product-price">Price</th><th class="product-quantity">Quantity</th><th class="product-subtotal">Subtotal</th></tr></thead>
<tbody>
<tr class="woocommerce-cart-form__cart-item cart_item"><td class="product-remove"><a href="#" class="remove" aria-label="Remove this item">×</a></td><td class="product-thumbnail"><a href="#">${thumb(101, 100)}</a></td><td class="product-name" data-title="Product"><a href="#">${NAMES[101]}</a></td><td class="product-price" data-title="Price">${money(629.99)}</td><td class="product-quantity" data-title="Quantity"><div class="quantity"><input type="number" class="input-text qty text" value="1"></div></td><td class="product-subtotal" data-title="Subtotal">${money(629.99)}</td></tr>
<tr class="woocommerce-cart-form__cart-item cart_item"><td class="product-remove"><a href="#" class="remove">×</a></td><td class="product-thumbnail"><a href="#">${P.cards[105].img}</a></td><td class="product-name" data-title="Product"><a href="#">${NAMES[105]}</a><dl class="variation"><dt class="variation-Reticle">Reticle:</dt><dd class="variation-Reticle"><p>Pulsar 1</p></dd></dl></td><td class="product-price" data-title="Price">${money(5499.99)}</td><td class="product-quantity" data-title="Quantity"><div class="quantity"><input type="number" class="input-text qty text" value="1"></div></td><td class="product-subtotal" data-title="Subtotal">${money(5499.99)}</td></tr>
<tr><td colspan="6" class="actions"><div class="coupon"><label for="coupon_code" class="screen-reader-text">Coupon:</label> <input type="text" name="coupon_code" class="input-text" id="coupon_code" value="" placeholder="Coupon code"> <button type="submit" class="button" name="apply_coupon" value="Apply coupon">Apply coupon</button></div><button type="submit" class="button" name="update_cart" value="Update cart" disabled aria-disabled="true">Update cart</button></td></tr>
</tbody></table></form>
<div class="cart-collaterals"><div class="cross-sells"><h2>You may be interested in…</h2>${grid([104, 103], 2)}</div>
<div class="cart_totals"><h2>Cart totals</h2><table cellspacing="0" class="shop_table shop_table_responsive"><tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">${money(6129.98)}</td></tr><tr class="woocommerce-shipping-totals shipping"><th>Shipping</th><td data-title="Shipping"><ul id="shipping_method" class="woocommerce-shipping-methods"><li><input type="radio" name="shipping_method[0]" id="sm0" value="local_pickup" class="shipping_method" checked><label for="sm0">Pick up at the outpost</label></li><li><input type="radio" name="shipping_method[0]" id="sm1" class="shipping_method"><label for="sm1">Ship to my FFL: ${money(35)}</label></li></ul><p class="woocommerce-shipping-destination">Pompano Beach, FL</p></td></tr><tr class="order-total"><th>Total</th><td data-title="Total"><strong>${money(6129.98)}</strong></td></tr></table>
<div class="wc-proceed-to-checkout"><a href="#" class="checkout-button button alt wc-forward">Proceed to checkout</a></div></div></div>`), { crumb: 'Cart' }),
  },
  cartEmpty: {
    label: 'Cart — empty',
    bodyClass: `page-template-default page page-id-7 woocommerce-cart woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('Cart', `<div class="woocommerce-notices-wrapper"></div><div class="wc-empty-cart-message"><div class="cart-empty woocommerce-info" role="status">Your cart is currently empty.</div></div><p class="return-to-shop"><a class="button wc-backward" href="#">Return to shop</a></p>`), { crumb: 'Cart' }),
  },
  checkout: {
    label: 'Checkout — firearm in the cart',
    bodyClass: `page-template-default page page-id-8 woocommerce-checkout woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('Checkout', `<div class="woocommerce-notices-wrapper"></div>
<div class="woocommerce-form-coupon-toggle"><div class="woocommerce-info">Have a coupon? <a href="#" class="showcoupon">Click here to enter your code</a></div></div>
<form class="checkout_coupon woocommerce-form-coupon" method="post"><p>If you have a coupon code, please apply it below.</p><p class="form-row form-row-first"><label for="coupon_code" class="screen-reader-text">Coupon:</label><input type="text" name="coupon_code" class="input-text" placeholder="Coupon code" id="coupon_code" value=""></p><p class="form-row form-row-last"><button type="submit" class="button" name="apply_coupon" value="Apply coupon">Apply coupon</button></p><div class="clear"></div></form>
<form name="checkout" method="post" class="checkout woocommerce-checkout" enctype="multipart/form-data">
<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout"><ul class="woocommerce-error" role="alert"><li>Please confirm the firearm eligibility statement.</li></ul></div>
<div class="col2-set" id="customer_details">
<div class="col-1"><div class="woocommerce-billing-fields"><h3>Billing details</h3><div class="woocommerce-billing-fields__field-wrapper">
${field('billing_first_name', 'First name', 'Ada', 'form-row-first')}${field('billing_last_name', 'Last name', 'Byrd', 'form-row-last')}${select2('billing_country', 'Country / Region', 'United States (US)')}${field('billing_address_1', 'Street address', '1460 Polar Ave')}${field('billing_city', 'Town / City', 'Fort Lauderdale')}${select2('billing_state', 'State', 'Florida')}${field('billing_postcode', 'ZIP Code', '33301')}${field('billing_phone', 'Phone', '(954) 555-0142', 'form-row-wide', 'tel')}${field('billing_email', 'Email address', 'ada@example.com', 'form-row-wide', 'email')}
</div>${P.firearmFields}</div></div>
<div class="col-2"><div class="woocommerce-shipping-fields"></div><div class="woocommerce-additional-fields"><h3>Additional information</h3><div class="woocommerce-additional-fields__field-wrapper"><p class="form-row notes" id="order_comments_field"><label for="order_comments">Order notes&nbsp;<span class="optional">(optional)</span></label><span class="woocommerce-input-wrapper"><textarea name="order_comments" class="input-text " id="order_comments" placeholder="Notes about your order, e.g. a time you plan to pick up." rows="2" cols="5"></textarea></span></p></div></div></div>
</div>
<h3 id="order_review_heading">Your order</h3>
<div id="order_review" class="woocommerce-checkout-review-order">
<table class="shop_table woocommerce-checkout-review-order-table"><thead><tr><th class="product-name">Product</th><th class="product-total">Subtotal</th></tr></thead>
<tbody><tr class="cart_item"><td class="product-name">${NAMES[101]}&nbsp;<strong class="product-quantity">×&nbsp;1</strong></td><td class="product-total">${money(629.99)}</td></tr></tbody>
<tfoot><tr class="cart-subtotal"><th>Subtotal</th><td>${money(629.99)}</td></tr><tr class="woocommerce-shipping-totals shipping"><th>Shipping</th><td data-title="Shipping">Pick up at the outpost</td></tr><tr class="order-total"><th>Total</th><td><strong>${money(629.99)}</strong></td></tr></tfoot></table>
<div id="payment" class="woocommerce-checkout-payment"><ul class="wc_payment_methods payment_methods methods">
<li class="wc_payment_method payment_method_cod"><input id="payment_method_cod" type="radio" class="input-radio" name="payment_method" value="cod"><label for="payment_method_cod">Pay at pickup</label></li>
<li class="wc_payment_method payment_method_authnet"><input id="payment_method_authnet" type="radio" class="input-radio" name="payment_method" value="authnet" checked><label for="payment_method_authnet">Credit card</label><div class="payment_box payment_method_authnet"><p>Pay securely with your card.</p><fieldset id="wc-authnet-cc-form" class="wc-credit-card-form wc-payment-form"><p class="form-row form-row-wide"><label for="cc">Card number&nbsp;<span class="required">*</span></label><input id="cc" class="input-text wc-credit-card-form-card-number" inputmode="numeric" placeholder="•••• •••• •••• ••••" type="tel"></p><p class="form-row form-row-first"><label>Expiry (MM/YY)&nbsp;<span class="required">*</span></label><input class="input-text" placeholder="MM / YY" type="tel"></p><p class="form-row form-row-last"><label>Card code&nbsp;<span class="required">*</span></label><input class="input-text" placeholder="CVC" type="tel"></p><div class="clear"></div></fieldset></div></li>
</ul>
<div class="form-row place-order"><div class="woocommerce-terms-and-conditions-wrapper">${privacy}<p class="form-row validate-required"><label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox"><input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" name="terms" id="terms"> <span class="woocommerce-terms-and-conditions-checkbox-text">I have read and agree to the website <a href="#" class="woocommerce-terms-and-conditions-link">terms and conditions</a></span>&nbsp;<abbr class="required" title="required">*</abbr></label></p></div>
<button type="submit" class="button alt" name="woocommerce_checkout_place_order" id="place_order" value="Place order">Place order</button>${P.secureLine}</div></div>
</div></form>`), { slim: true }),
  },
  thankyou: {
    label: 'Order received',
    bodyClass: `page-template-default page page-id-8 woocommerce-checkout woocommerce-order-received woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('Order received', `<div class="woocommerce-order">
<p class="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">Thank you. Your order has been received.</p>
<ul class="woocommerce-order-overview woocommerce-thankyou-order-details order_details"><li class="woocommerce-order-overview__order order">Order number: <strong>4213</strong></li><li class="woocommerce-order-overview__date date">Date: <strong>November 10, 2026</strong></li><li class="woocommerce-order-overview__email email">Email: <strong>ada@example.com</strong></li><li class="woocommerce-order-overview__total total">Total: <strong>${money(629.99)}</strong></li><li class="woocommerce-order-overview__payment-method method">Payment method: <strong>Pay at pickup</strong></li></ul>
<p>Pay with cash or card when you pick up.</p>
<section class="woocommerce-order-details"><h2 class="woocommerce-order-details__title">Order details</h2><table class="woocommerce-table woocommerce-table--order-details shop_table order_details"><thead><tr><th class="woocommerce-table__product-name product-name">Product</th><th class="woocommerce-table__product-table product-total">Total</th></tr></thead><tbody><tr class="woocommerce-table__line-item order_item"><td class="woocommerce-table__product-name product-name"><a href="#">${NAMES[101]}</a> <strong class="product-quantity">×&nbsp;1</strong></td><td class="woocommerce-table__product-total product-total">${money(629.99)}</td></tr></tbody><tfoot><tr><th scope="row">Subtotal:</th><td>${money(629.99)}</td></tr><tr><th scope="row">Shipping:</th><td>Pick up at the outpost</td></tr><tr><th scope="row">Payment method:</th><td>Pay at pickup</td></tr><tr><th scope="row">Total:</th><td>${money(629.99)}</td></tr></tfoot></table>${P.releasePanel}</section>
<section class="woocommerce-customer-details"><h2 class="woocommerce-column__title">Billing address</h2><address>Ada Byrd<br>1460 Polar Ave<br>Fort Lauderdale, FL 33301<p class="woocommerce-customer-details--phone">(954) 555-0142</p><p class="woocommerce-customer-details--email">ada@example.com</p></address></section>
</div>`), { crumb: 'Checkout' }),
  },
  account: {
    label: 'My account — dashboard',
    bodyClass: `page-template-default page page-id-9 woocommerce-account woocommerce-page woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('My account', `<nav class="woocommerce-MyAccount-navigation" aria-label="Account pages"><ul><li class="woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--dashboard is-active"><a href="#" aria-current="page">Dashboard</a></li><li class="woocommerce-MyAccount-navigation-link woocommerce-MyAccount-navigation-link--orders"><a href="#">Orders</a></li><li class="woocommerce-MyAccount-navigation-link--downloads"><a href="#">Downloads</a></li><li class="woocommerce-MyAccount-navigation-link--edit-address"><a href="#">Addresses</a></li><li class="woocommerce-MyAccount-navigation-link--edit-account"><a href="#">Account details</a></li><li class="woocommerce-MyAccount-navigation-link--customer-logout"><a href="#">Log out</a></li></ul></nav>
<div class="woocommerce-MyAccount-content"><div class="woocommerce-notices-wrapper"></div><p>Hello <strong>ada</strong> (not <strong>ada</strong>? <a href="#">Log out</a>)</p><p>From your account dashboard you can view your <a href="#">recent orders</a>, manage your <a href="#">shipping and billing addresses</a>, and <a href="#">edit your password and account details</a>.</p>
<table class="woocommerce-orders-table woocommerce-MyAccount-orders shop_table shop_table_responsive my_account_orders account-orders-table"><thead><tr><th class="woocommerce-orders-table__header"><span class="nobr">Order</span></th><th><span class="nobr">Date</span></th><th><span class="nobr">Status</span></th><th><span class="nobr">Total</span></th><th><span class="nobr">Actions</span></th></tr></thead><tbody>
<tr class="woocommerce-orders-table__row order"><td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-number" data-title="Order"><a href="#">#4213</a></td><td data-title="Date"><time>November 10, 2026</time></td><td class="woocommerce-orders-table__cell-order-status" data-title="Status">Processing</td><td data-title="Total">${money(629.99)} for 1 item</td><td class="woocommerce-orders-table__cell-order-actions" data-title="Actions"><a href="#" class="woocommerce-button button view">View</a></td></tr>
<tr class="woocommerce-orders-table__row order"><td class="woocommerce-orders-table__cell woocommerce-orders-table__cell-order-number" data-title="Order"><a href="#">#4108</a></td><td data-title="Date"><time>October 3, 2026</time></td><td class="woocommerce-orders-table__cell-order-status" data-title="Status">Completed</td><td data-title="Total">${money(73.98)} for 2 items</td><td class="woocommerce-orders-table__cell-order-actions" data-title="Actions"><a href="#" class="woocommerce-button button view">View</a></td></tr>
</tbody></table></div>`), { crumb: 'My account' }),
  },
  accountEdit: {
    label: 'My account — addresses + account details',
    bodyClass: `page-template-default page page-id-9 woocommerce-account woocommerce-page woocommerce-edit-account woocommerce-js ${BODY}${FULL}`,
    html: chrome(page('Account details', `<nav class="woocommerce-MyAccount-navigation"><ul><li><a href="#">Dashboard</a></li><li><a href="#">Orders</a></li><li><a href="#">Addresses</a></li><li class="is-active"><a href="#">Account details</a></li><li><a href="#">Log out</a></li></ul></nav>
<div class="woocommerce-MyAccount-content"><p>The following addresses will be used on the checkout page by default.</p>
<div class="u-columns woocommerce-Addresses col2-set addresses"><div class="u-column1 col-1 woocommerce-Address"><header class="woocommerce-Address-title title"><h2>Billing address</h2><a href="#" class="edit">Edit</a></header><address>Ada Byrd<br>1460 Polar Ave<br>Fort Lauderdale, FL 33301</address></div><div class="u-column2 col-2 woocommerce-Address"><header class="woocommerce-Address-title title"><h2>Shipping address</h2><a href="#" class="edit">Add</a></header><address>You have not set up this type of address yet.</address></div></div>
<form class="woocommerce-EditAccountForm edit-account" method="post"><p class="woocommerce-form-row woocommerce-form-row--first form-row form-row-first"><label for="account_first_name">First name&nbsp;<span class="required">*</span></label><input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="account_first_name" id="account_first_name" value="Ada"></p><p class="woocommerce-form-row woocommerce-form-row--last form-row form-row-last"><label for="account_last_name">Last name&nbsp;<span class="required">*</span></label><input type="text" class="woocommerce-Input woocommerce-Input--text input-text" id="account_last_name" value="Byrd"></p><div class="clear"></div>
<p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label for="account_email">Email address&nbsp;<span class="required">*</span></label><input type="email" class="woocommerce-Input woocommerce-Input--email input-text" id="account_email" value="ada@example.com"></p>
<fieldset><legend>Password change</legend><p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label for="password_current">Current password (leave blank to leave unchanged)</label><span class="password-input"><input type="password" class="woocommerce-Input woocommerce-Input--password input-text" id="password_current"><span class="show-password-input"></span></span></p></fieldset>
<p><button type="submit" class="woocommerce-Button button" name="save_account_details" value="Save changes">Save changes</button></p></form></div>`), { crumb: 'My account' }),
  },
  login: {
    label: 'Login / register',
    bodyClass: `page-template-default page page-id-9 woocommerce-account woocommerce-page woocommerce-js wp-embed-responsive theme-storefront woocommerce-active storefront-align-wide right-sidebar agarthan${FULL}`,
    html: chrome(page('My account', `<div class="woocommerce-notices-wrapper"></div><div class="u-columns col2-set" id="customer_login">
<div class="u-column1 col-1"><h2>Login</h2><form class="woocommerce-form woocommerce-form-login login" method="post"><p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label for="username">Username or email address&nbsp;<span class="required">*</span></label><input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="username" id="username"></p><p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label for="password">Password&nbsp;<span class="required">*</span></label><span class="password-input"><input class="woocommerce-Input woocommerce-Input--text input-text" type="password" name="password" id="password"><span class="show-password-input"></span></span></p><p class="form-row"><label class="woocommerce-form__label woocommerce-form__label-for-checkbox woocommerce-form-login__rememberme"><input class="woocommerce-form__input woocommerce-form__input-checkbox" name="rememberme" type="checkbox" id="rememberme" value="forever"> <span>Remember me</span></label><button type="submit" class="woocommerce-button button woocommerce-form-login__submit" name="login" value="Log in">Log in</button></p><p class="woocommerce-LostPassword lost_password"><a href="#">Lost your password?</a></p></form></div>
<div class="u-column2 col-2"><h2>Register</h2><form method="post" class="woocommerce-form woocommerce-form-register register"><p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label for="reg_email">Email address&nbsp;<span class="required">*</span></label><input type="email" class="woocommerce-Input woocommerce-Input--text input-text" name="email" id="reg_email"></p><p>A link to set a new password will be sent to your email address.</p>${privacy}<p class="woocommerce-form-row form-row"><button type="submit" class="woocommerce-Button woocommerce-button button woocommerce-form-register__submit" name="register" value="Register">Register</button></p></form></div>
</div>`), { crumb: 'My account' }),
  },
  lostPassword: {
    label: 'Lost password',
    bodyClass: `page-template-default page page-id-9 woocommerce-account woocommerce-page woocommerce-lost-password woocommerce-js wp-embed-responsive theme-storefront woocommerce-active right-sidebar agarthan${FULL}`,
    html: chrome(page('Lost password', `<div class="woocommerce-notices-wrapper"></div><form method="post" class="woocommerce-ResetPassword lost_reset_password"><p>Lost your password? Please enter your username or email address. You will receive a link to create a new password via email.</p><p class="woocommerce-form-row woocommerce-form-row--first form-row form-row-first"><label for="user_login">Username or email&nbsp;<span class="required">*</span></label><input class="woocommerce-Input woocommerce-Input--text input-text" type="text" name="user_login" id="user_login"></p><div class="clear"></div><p class="woocommerce-form-row form-row"><button type="submit" class="woocommerce-Button button" value="Reset password">Reset password</button></p></form>`), { crumb: 'Lost password' }),
  },
  policy: {
    label: 'Policy page',
    bodyClass: `privacy-policy page-template-default page page-id-3 woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<article class="page type-page status-publish hentry"><header class="entry-header"><h1 class="entry-title">Privacy Policy</h1></header><div class="entry-content">
<h2>Who we are</h2><p>Agarthan Armory LLC is a federally licensed firearms dealer in Pompano Beach, Florida. Our website address is <a href="#">agarthanarmory.com</a>.</p>
<h3>What we collect</h3><ul><li>Order details: name, address, phone and email.</li><li>Firearm release details: how you collect a firearm and your receiving FFL dealer.</li><li>Payment is handled by our card processor; we never store card numbers.</li></ul>
<blockquote><p>ATF Form 4473 records are kept as federal law requires and are never shared for marketing.</p></blockquote>
<table><thead><tr><th>Record</th><th>Kept for</th></tr></thead><tbody><tr><td>Orders</td><td>7 years</td></tr><tr><td>Form 4473</td><td>As required by federal law</td></tr></tbody></table>
<p>Questions? Call <strong>(561) 830-3366</strong>.</p></div></article>`, { crumb: 'Privacy Policy' }),
  },
  notFound: {
    label: '404',
    bodyClass: `error404 woocommerce-js ${BODY}${FULL}`,
    html: chrome(`<div class="error-404 not-found"><div class="page-content"><header class="page-header"><h1 class="page-title">Oops! That page can’t be found.</h1></header><p>Nothing was found at this location. Try searching, or check out the links below.</p>
<section aria-label="Search">${SEARCH}</section>
<div class="fourohfour-columns-2"><section class="col-1" aria-label="Promoted Products"><h2>Promoted Products</h2><div class="woocommerce columns-2">${grid([101, 103], 2)}</div></section>
<section class="col-2" aria-label="Product Categories"><div class="widget woocommerce widget_product_categories"><h2 class="widget-title">Product Categories</h2><ul class="product-categories"><li class="cat-item"><a href="#">Firearms</a> <span class="count">(2,168)</span></li><li class="cat-item"><a href="#">Ammunition</a> <span class="count">(1,844)</span></li><li class="cat-item"><a href="#">Optics</a> <span class="count">(1,663)</span></li><li class="cat-item"><a href="#">NFA &amp; Suppressors</a> <span class="count">(62)</span></li></ul></div></section></div></div></div>`, { crumb: 'Error 404' }),
  },
};
