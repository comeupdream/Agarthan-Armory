<?php
/**
 * Agarthan Armory — Storefront child theme.
 *
 * Skins the whole WooCommerce store to match the Agarthan Armory site
 * (polar night, aurora light, holographic tech) and adds what a gun store
 * needs on top of Storefront:
 *   - the outpost header (seal + name), ticker, and the site's four-column footer
 *   - hologram schematics for products that have no photo yet
 *   - firearm handling at checkout: pick up at the counter (4473 + background
 *     check) or ship to the buyer's FFL, with an age / eligibility statement
 *   - an age gate, branded order emails, classic (skinnable) cart + checkout
 *
 * Store facts live in agarthan_facts() below — the same facts as the site's
 * assets/js/config.js. Change them there, or with the agarthan_facts filter.
 */

defined('ABSPATH') || exit;

define('AGARTHAN_THEME_VERSION', '1.1.0');

/* =============================================================================
   STORE FACTS
   ============================================================================= */
function agarthan_facts() {
    static $facts = null;
    if ($facts === null) {
        $facts = apply_filters('agarthan_facts', array(
            'name'       => 'Agarthan Armory',
            'legal_name' => 'Agarthan Armory LLC',
            'tagline'    => 'Federally licensed · beyond the wall',
            'ffl_number' => '1-59-011-07-8A-59532',
            'ffl_type'   => 'Type 07 Manufacturer',
            'phone'      => '(561) 830-3366',
            'email'      => '',                       // e.g. info@agarthanarmory.com — empty hides it
            'street'     => '1460 SW 3rd St, Suite B10',
            'city'       => 'Pompano Beach',
            'state'      => 'FL',
            'zip'        => '33069',
            'hours'      => 'Mon–Fri 10 AM – 6 PM · Sat–Sun closed',
            'instagram'  => 'https://www.instagram.com/agarthanarmory/',
            'age_min'    => 21,                       // the age gate's number (handguns from a dealer)
            'age_gate'   => true,
            // Firearms can be shipped to the buyer's own FFL dealer as well as
            // picked up at the counter. false = counter pickup only.
            'ship_to_ffl' => true,
        ));
    }
    return $facts;
}

function agarthan_address_line() {
    $f = agarthan_facts();
    return trim($f['street'] . ', ' . $f['city'] . ', ' . $f['state'] . ' ' . $f['zip'], ', ');
}

function agarthan_asset($path) {
    return get_stylesheet_directory_uri() . '/assets/' . ltrim($path, '/');
}

/* =============================================================================
   STYLES, SCRIPTS, FONTS
   Storefront enqueues the child stylesheet itself as storefront-child-style.
   We take that over so the skin always prints AFTER Storefront's WooCommerce
   stylesheet and both of its customizer inline blocks — equal-specificity
   rules then go our way. Fonts are self-hosted (assets/fonts), so Storefront's
   Google Fonts request is dropped.
   ============================================================================= */
add_action('wp_enqueue_scripts', function () {
    wp_dequeue_style('storefront-child-style');
    wp_dequeue_style('storefront-fonts');
    $deps = array('storefront-style');
    if (wp_style_is('storefront-woocommerce-style', 'registered')) {
        $deps[] = 'storefront-woocommerce-style';
    }
    if (wp_style_is('storefront-icons', 'registered')) {
        $deps[] = 'storefront-icons';
    }
    wp_enqueue_style('agarthan-skin', get_stylesheet_uri(), $deps, AGARTHAN_THEME_VERSION);
    wp_enqueue_script('agarthan', agarthan_asset('js/agarthan.js'), array(), AGARTHAN_THEME_VERSION, true);
}, 99);

add_action('wp_head', function () {
    $f = agarthan_facts();
    // fonts the first screen needs, before the stylesheet asks for them
    foreach (array('orbitron-latin-900-normal', 'exo-2-latin-400-normal', 'share-tech-mono-latin-400-normal') as $font) {
        echo '<link rel="preload" href="' . esc_url(agarthan_asset('fonts/' . $font . '.woff2')) . '" as="font" type="font/woff2" crossorigin>' . "\n";
    }
    echo '<meta name="theme-color" content="#03060c">' . "\n";
    // the age gate: hide it before first paint for anyone who already passed
    if (!empty($f['age_gate'])) {
        echo "<script>try{if(localStorage.getItem('aa-age')==='1'||document.cookie.indexOf('aa_age=1')>-1)document.documentElement.classList.add('aa-age-ok')}catch(e){}</script>\n";
    }
}, 2);

/* =============================================================================
   FULL-WIDTH STORE PAGES
   The shop grid, category archives, search, product pages, cart, checkout,
   My Account and static (policy) pages drop the Storefront sidebar and use the
   full content width.
   ============================================================================= */
function agarthan_is_fullwidth_view() {
    if (function_exists('is_woocommerce') && (is_woocommerce() || is_cart() || is_checkout() || is_account_page())) {
        return true;
    }
    return is_search() || is_page() || is_404();
}
add_filter('body_class', function ($classes) {
    $classes[] = 'agarthan';
    if (agarthan_is_fullwidth_view()) {
        $classes[] = 'page-template-template-fullwidth-php';
    }
    return $classes;
});
add_action('get_header', function () {
    if (agarthan_is_fullwidth_view()) {
        remove_action('storefront_sidebar', 'storefront_get_sidebar', 10);
    }
});

/* =============================================================================
   CLASSIC CART + CHECKOUT
   New WooCommerce installs build Cart and Checkout from blocks, which neither
   this skin, the firearm fields below, nor most payment gateways target. On
   activation (or as soon as WooCommerce appears) a default block cart/checkout
   page is switched to the classic shortcode. Hand-edited pages are left alone.
   ============================================================================= */
function agarthan_ensure_classic_checkout() {
    if (!function_exists('wc_get_page_id')) {
        return; // WooCommerce not active yet — admin_init retries until it is
    }
    foreach (array('checkout' => 'woocommerce_checkout', 'cart' => 'woocommerce_cart') as $slug => $shortcode) {
        $page_id = wc_get_page_id($slug);
        $page    = $page_id > 0 ? get_post($page_id) : null;
        if ($page && strpos($page->post_content, 'wp:woocommerce/' . $slug) !== false) {
            wp_update_post(array(
                'ID'           => $page_id,
                'post_content' => '<!-- wp:shortcode -->[' . $shortcode . ']<!-- /wp:shortcode -->',
            ));
        }
    }
    update_option('agarthan_classic_checkout', 'done');
}
add_action('after_switch_theme', function () {
    delete_option('agarthan_classic_checkout');
    agarthan_ensure_classic_checkout();
});
add_action('admin_init', function () {
    if (get_option('agarthan_classic_checkout') !== 'done') {
        agarthan_ensure_classic_checkout();
    }
});

/* =============================================================================
   HEADER: ticker, seal + name, a slim header on checkout
   ============================================================================= */
add_action('storefront_before_header', 'agarthan_ticker', 5);
function agarthan_ticker() {
    $f = agarthan_facts();
    $line = '◈ Federal firearms licensee · <b>transfers accepted</b> ◈ Outpost time <i data-aa-clock>--:--:--</i>'
          . ' ◈ Surface temp −89.2°C (Vostok record) ◈ Signal <b>strong</b> ◈ Vril reserves <b>98%</b>'
          . ' ◈ Aurora activity <b>high</b> ◈ ' . esc_html($f['city']) . ' outpost · <b>' . esc_html($f['hours']) . '</b>'
          . ' ◈ Special orders from every major distributor';
    echo '<div class="aa-ticker" aria-hidden="true"><div class="aa-ticker-track"><span>' . $line . '</span><span>' . $line . '</span></div></div>';
}

add_action('init', function () {
    remove_action('storefront_header', 'storefront_site_branding', 20);
    add_action('storefront_header', 'agarthan_branding', 20);
    remove_action('storefront_footer', 'storefront_credit', 20);
    add_action('storefront_footer', 'agarthan_footer', 20);
});

function agarthan_branding() {
    $f = agarthan_facts();
    echo '<div class="site-branding aa-branding">';
    echo '<a class="aa-brand" href="' . esc_url(home_url('/')) . '" rel="home" aria-label="' . esc_attr($f['name']) . ' — home">';
    echo '<span class="aa-seal" aria-hidden="true"><img src="' . esc_url(agarthan_asset('img/seal-160.png')) . '" alt="" width="46" height="46"></span>';
    echo '<span class="aa-brand-name"><strong>' . esc_html($f['name']) . '</strong><small>' . esc_html($f['tagline']) . '</small></span>';
    echo '</a></div>';
}

/* checkout keeps the branding row only — no nav, search or mini-cart competing with payment */
add_action('wp', function () {
    if (function_exists('is_checkout') && is_checkout() && !is_order_received_page()) {
        remove_action('storefront_header', 'storefront_secondary_navigation', 30);
        remove_action('storefront_header', 'storefront_product_search', 40);
        remove_action('storefront_header', 'storefront_primary_navigation_wrapper', 42);
        remove_action('storefront_header', 'storefront_primary_navigation', 50);
        remove_action('storefront_header', 'storefront_header_cart', 60);
        remove_action('storefront_header', 'storefront_primary_navigation_wrapper_close', 68);
    }
});

/* search box placeholder in the site's voice */
add_filter('get_product_search_form', function ($form) {
    return str_replace(
        array('placeholder="' . esc_attr__('Search products&hellip;', 'woocommerce') . '"', 'placeholder="Search products…"'),
        'placeholder="&gt; query the archive"',
        $form
    );
});

/* =============================================================================
   FOOTER: the site's four columns, policy links + card marks, the legal line
   ============================================================================= */
function agarthan_page_url($slugs, $fallback = '') {
    foreach ((array) $slugs as $slug) {
        $page = get_page_by_path($slug);
        if ($page && $page->post_status === 'publish') {
            return get_permalink($page);
        }
    }
    return $fallback;
}

function agarthan_footer() {
    $f = agarthan_facts();

    // The Armory column: the store's own top-level categories
    $cats = get_terms(array(
        'taxonomy'   => 'product_cat',
        'parent'     => 0,
        'hide_empty' => true,
        'number'     => 8,
        'orderby'    => 'menu_order',
        'exclude'    => array((int) get_option('default_product_cat')),
    ));
    $shop = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/');

    $services = array_filter(array(
        array('FFL transfers', agarthan_page_url(array('ffl-transfers', 'transfers', 'ffl-transfer'))),
        array('Special orders', agarthan_page_url(array('special-orders', 'special-order'))),
        array('Contact', agarthan_page_url(array('contact', 'contact-us'))),
        array('My account', function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : ''),
        array('Requisition (cart)', function_exists('wc_get_cart_url') ? wc_get_cart_url() : ''),
    ), function ($l) { return !empty($l[1]); });

    echo '<div class="aa-footer">';
    echo '<div class="aa-foot-grid">';

    echo '<div class="aa-foot-brand">';
    echo '<a class="aa-brand" href="' . esc_url(home_url('/')) . '"><span class="aa-seal" aria-hidden="true"><img src="' . esc_url(agarthan_asset('img/seal-160.png')) . '" alt="" width="40" height="40" loading="lazy"></span>';
    echo '<span class="aa-brand-name"><strong>' . esc_html($f['name']) . '</strong><small>The last outpost before the wall</small></span></a>';
    echo '<p>Firearms, ammunition, optics and FFL transfers. Hyperborean steel, Agarthan engineering, and every form filled out properly.</p>';
    if ($f['ffl_number']) {
        echo '<div class="aa-ffl-plate">FFL · ' . esc_html($f['ffl_number']) . '<br>' . esc_html($f['ffl_type']) . '</div>';
    }
    echo '</div>';

    echo '<div><h4>The Armory</h4><ul>';
    echo '<li><a href="' . esc_url($shop) . '">All inventory</a></li>';
    if (!is_wp_error($cats)) {
        foreach ($cats as $cat) {
            $link = get_term_link($cat);
            if (!is_wp_error($link)) {
                echo '<li><a href="' . esc_url($link) . '">' . esc_html($cat->name) . '</a></li>';
            }
        }
    }
    echo '</ul></div>';

    echo '<div><h4>Services</h4><ul>';
    foreach ($services as $l) {
        echo '<li><a href="' . esc_url($l[1]) . '">' . esc_html($l[0]) . '</a></li>';
    }
    echo '</ul></div>';

    echo '<div><h4>Contact</h4><ul>';
    if ($f['phone']) {
        echo '<li><a href="tel:' . esc_attr(preg_replace('/[^0-9+]/', '', $f['phone'])) . '">' . esc_html($f['phone']) . '</a></li>';
    }
    if ($f['email']) {
        echo '<li><a href="mailto:' . esc_attr($f['email']) . '">' . esc_html($f['email']) . '</a></li>';
    }
    echo '<li>' . esc_html(agarthan_address_line()) . '</li>';
    echo '<li>' . esc_html($f['hours']) . '</li>';
    if ($f['instagram']) {
        echo '<li><a href="' . esc_url($f['instagram']) . '" rel="noopener" target="_blank">Instagram</a></li>';
    }
    echo '</ul></div>';

    echo '</div>'; // grid

    agarthan_footer_compliance();

    echo '<div class="aa-legal">&copy; ' . esc_html(gmdate('Y')) . ' ' . esc_html($f['legal_name']) . '. Federally licensed firearms dealer. '
       . 'Every firearm transfer requires ATF Form 4473 and a background check and must comply with federal, state and local law. '
       . 'Handguns 21+ · long guns &amp; ammunition 18+. We reserve the right to refuse any sale. What lies beyond the wall remains classified.</div>';
    echo '</div>';
}

/* Card processors require Terms, Privacy and Returns links plus the accepted
   card marks in the footer of every page. Remove a card the store doesn't take
   with the agarthan_card_marks filter. */
function agarthan_footer_compliance() {
    $terms   = function_exists('wc_terms_and_conditions_page_id') && wc_terms_and_conditions_page_id()
        ? get_permalink(wc_terms_and_conditions_page_id())
        : agarthan_page_url(array('terms-and-conditions', 'terms-conditions', 'terms'), home_url('/terms-and-conditions/'));
    $privacy = function_exists('get_privacy_policy_url') && get_privacy_policy_url()
        ? get_privacy_policy_url()
        : agarthan_page_url(array('privacy-policy', 'privacy'), home_url('/privacy-policy/'));
    $returns  = agarthan_page_url(array('returns', 'refund_returns', 'refund-and-returns-policy', 'returns-and-refunds', 'return-policy'), home_url('/refund_returns/'));
    $shipping = agarthan_page_url(array('shipping', 'shipping-policy'));

    $links = array(array('Terms &amp; Conditions', $terms), array('Privacy Policy', $privacy), array('Returns &amp; Refunds', $returns));
    if ($shipping) {
        $links[] = array('Shipping', $shipping);
    }

    $marks = apply_filters('agarthan_card_marks', array('visa', 'mastercard', 'amex', 'discover'));
    $svg = array(
        'visa'       => '<svg viewBox="0 0 46 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="46" height="30" rx="4" fill="#1a1f71"/><text x="23" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" font-style="italic" fill="#fff">VISA</text></svg>',
        'mastercard' => '<svg viewBox="0 0 46 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="46" height="30" rx="4" fill="#16161a"/><circle cx="17.5" cy="15" r="8" fill="#eb001b"/><circle cx="28.5" cy="15" r="8" fill="#f79e1b" fill-opacity=".85"/></svg>',
        'amex'       => '<svg viewBox="0 0 46 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="46" height="30" rx="4" fill="#2e77bc"/><text x="23" y="19" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="bold" fill="#fff">AMEX</text></svg>',
        'discover'   => '<svg viewBox="0 0 46 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="46" height="30" rx="4" fill="#f4f4f4"/><circle cx="35.5" cy="15" r="6.5" fill="#f47216"/><text x="16" y="18.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.5" font-weight="bold" fill="#231f20">DISC</text></svg>',
    );
    $names = array('visa' => 'Visa', 'mastercard' => 'Mastercard', 'amex' => 'American Express', 'discover' => 'Discover');

    echo '<div class="aa-compliance"><p class="aa-policy-links">';
    foreach ($links as $l) {
        echo '<a href="' . esc_url($l[1]) . '">' . $l[0] . '</a>';
    }
    echo '</p>';
    $shown = array_values(array_intersect($marks, array_keys($svg)));
    if ($shown) {
        $label = implode(', ', array_map(function ($m) use ($names) { return $names[$m]; }, $shown));
        echo '<div class="aa-cards" role="img" aria-label="' . esc_attr('We accept ' . $label) . '">';
        foreach ($shown as $m) {
            echo $svg[$m]; // static markup above
        }
        echo '</div>';
    }
    echo '</div>';
}

/* =============================================================================
   HOLOGRAMS FOR PRODUCTS WITHOUT A PHOTO
   Every product without an image shows the site's hologram schematic for its
   kind — a pistol, a rifle, a box of ammunition, a scope… — instead of
   WooCommerce's grey placeholder. The kind comes from the product's
   categories and name.
   ============================================================================= */
function agarthan_holo_type($product) {
    if (!$product || !is_a($product, 'WC_Product')) {
        return 'case';
    }
    $id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
    // the categories decide ("Handguns" beats a name that says "15 Round");
    // the product name is the fallback when no category says what it is
    $cats = '';
    $terms = get_the_terms($id, 'product_cat');
    if ($terms && !is_wp_error($terms)) {
        foreach ($terms as $term) {
            for ($hops = 0; $term && !is_wp_error($term) && $hops < 10; $hops++) {
                $cats .= ' ' . strtolower($term->slug . ' ' . $term->name);
                $term = $term->parent ? get_term($term->parent, 'product_cat') : null;
            }
        }
    }
    $type = agarthan_holo_type_from_words($cats);
    if ($type === '') {
        $type = agarthan_holo_type_from_words(strtolower($product->get_name()));
    }
    return $type === '' ? 'case' : $type;
}

/* pure: the hologram for some words (category names/slugs, or a product name); '' when nothing fits */
function agarthan_holo_type_from_words($w) {
    $rules = array(
        'can'         => '/suppress|silencer|\bnfa\b|\bcans?\b/',
        'thermal'     => '/thermal|night[ -]?vision|\bnvg?\b|monocular|binocular/',
        'reddot'      => '/red[ -]?dot|reflex|holographic|\bprism/',
        'scope'       => '/scope|optic|riflescope|magnifier|rangefinder/',
        'shells'      => '/shotshell|buckshot|birdshot|\bslugs?\b|shotgun ammo|\bgauge ammo/',
        'ammo'        => '/ammo|ammunition|cartridge|\brounds?\b|bullets|projectile|primer|reloading/',
        'mag'         => '/magazine|\bmags?\b|pmag|drum/',
        'light'       => '/flashlight|weapon ?light|\blights?\b|laser/',
        'safe'        => '/\bsafes?\b|vault|lock ?box/',
        'kit'         => '/clean|kit|tool|maintenance|lube|solvent/',
        'revolver'    => '/revolver/',
        'semishotgun' => '/semi[ -]?auto(matic)? shotgun/',
        'shotgun'     => '/shotgun|\b(12|20|28|410) ?ga|gauge/',
        'ar'          => '/\bar[ -]?15\b|\bar[ -]?10\b|\bar pistol|\bm4\b|ar-platform|modern sporting|\bar & rifle|\barp\b|carbine/',
        'lever'       => '/lever/',
        'rimfire'     => '/rimfire|\.22|22 lr/',
        'bolt'        => '/bolt[ -]?action|\brifles?\b|long ?guns?|muzzleloader/',
        'pistol'      => '/pistol|handgun|sidearm|\bglock\b|1911/',
        'case'        => '/case|bag|holster|sling|pouch|gear|apparel/',
    );
    foreach ($rules as $type => $re) {
        if (preg_match($re, $w)) {
            return $type;
        }
    }
    return '';
}

function agarthan_holo_src($type) {
    return agarthan_asset('holo/' . sanitize_key($type) . '.svg');
}

/* product images everywhere get_image() is used (shop grid, cart, mini-cart, widgets) */
add_filter('woocommerce_product_get_image', function ($image, $product, $size, $attr, $placeholder) {
    if (!$placeholder || !$product || $product->get_image_id()) {
        return $image;
    }
    $parent = $product->get_parent_id() ? wc_get_product($product->get_parent_id()) : null;
    if (!$parent || !$parent->get_image_id()) {
        $type = agarthan_holo_type($product);
        $image = '<img src="' . esc_url(agarthan_holo_src($type)) . '" alt="' . esc_attr($product->get_name()) . '" class="woocommerce-placeholder wp-post-image aa-holo aa-holo-' . esc_attr($type) . '" width="600" height="600" loading="lazy" decoding="async">';
    }
    return $image;
}, 10, 5);

/* the single-product gallery and anything else asking for the placeholder URL */
add_filter('woocommerce_placeholder_img_src', function ($src) {
    global $product;
    return agarthan_holo_src(agarthan_holo_type($product instanceof WC_Product ? $product : null));
});
add_filter('woocommerce_placeholder_img', function ($html) {
    return str_replace('class="woocommerce-placeholder', 'class="aa-holo woocommerce-placeholder', $html);
});

/* =============================================================================
   SHOP CARDS: department + stock line on top, brand above the title, NFA plate
   ============================================================================= */
function agarthan_stock_state($product) {
    if (!$product) {
        return array('', '');
    }
    $status = $product->get_stock_status();
    if ($status === 'outofstock') {
        return array('out', __('Out of stock', 'agarthan'));
    }
    if ($status === 'onbackorder') {
        return array('order', __('Special order', 'agarthan'));
    }
    if ($product->managing_stock()) {
        $qty = (int) $product->get_stock_quantity();
        $low = function_exists('wc_get_low_stock_amount') ? (int) wc_get_low_stock_amount($product) : (int) get_option('woocommerce_notify_low_stock_amount', 2);
        if ($qty > 0 && $low > 0 && $qty <= $low) {
            return array('low', __('Few left', 'agarthan'));
        }
    }
    return array('in', __('In stock', 'agarthan'));
}

function agarthan_primary_category($product) {
    $id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
    $terms = get_the_terms($id, 'product_cat');
    if (!$terms || is_wp_error($terms)) {
        return '';
    }
    // the deepest category reads best ("Night Vision" rather than "Optics")
    $best = null; $best_depth = -1;
    foreach ($terms as $t) {
        $depth = count(get_ancestors($t->term_id, 'product_cat'));
        if ($depth > $best_depth) { $best = $t; $best_depth = $depth; }
    }
    return $best ? $best->name : '';
}

function agarthan_brand_name($product) {
    $id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
    foreach (array('product_brand', 'pwb-brand', 'yith_product_brand', 'brand') as $tax) {
        if (taxonomy_exists($tax)) {
            $terms = get_the_terms($id, $tax);
            if ($terms && !is_wp_error($terms)) {
                return $terms[0]->name;
            }
        }
    }
    $attr = $product->get_attribute('brand');
    if (!$attr) {
        $attr = $product->get_attribute('pa_brand');
    }
    if (!$attr) {
        $attr = $product->get_attribute('manufacturer');
    }
    return $attr ? trim(explode(',', $attr)[0]) : '';
}

add_action('woocommerce_before_shop_loop_item', function () {
    global $product;
    if (!$product) {
        return;
    }
    list($state, $label) = agarthan_stock_state($product);
    echo '<div class="aa-card-top"><span>' . esc_html(agarthan_primary_category($product)) . '</span>'
       . '<span class="aa-stock aa-stock-' . esc_attr($state) . '">' . esc_html($label) . '</span></div>';
}, 5);

add_action('woocommerce_before_shop_loop_item_title', function () {
    global $product;
    if ($product && agarthan_product_is_nfa($product->get_id())) {
        echo '<span class="aa-nfa-tag">NFA</span>';
    }
}, 9);

add_action('woocommerce_shop_loop_item_title', function () {
    global $product;
    if ($product) {
        $brand = agarthan_brand_name($product);
        if ($brand) {
            echo '<span class="aa-brandline">' . esc_html($brand) . '</span>';
        }
    }
}, 5);

/* =============================================================================
   FIREARMS
   A product is a firearm when one of its categories sits under a firearm
   department (Firearms, Handguns, Rifles, Shotguns, NFA, lower receivers …)
   and under none of the never-firearm departments (ammunition, parts, optics,
   air guns, muzzleloaders …). Product → Advanced → "Firearm (FFL)" overrides
   that per product. Store managers can add ?aa-ffl-debug=1 to the cart or
   checkout URL to see which line counts as a firearm and why.
   ============================================================================= */
function agarthan_slug($s) {
    $s = strtolower(remove_accents((string) $s));
    $s = preg_replace('/&(amp;)?/', ' and ', $s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim(preg_replace('/-\d+$/', '', trim($s, '-')), '-');   // WordPress adds -2, -3 to taken slugs
}

function agarthan_firearm_roots() {
    return apply_filters('agarthan_firearm_roots', array(
        'firearms', 'firearm', 'guns', 'handguns', 'handgun', 'pistols', 'revolvers', 'rifles', 'rifle',
        'shotguns', 'shotgun', 'long-guns', 'longarms', 'sidearms', 'ar-pistols', 'ar-and-rifle-caliber-pistols',
        'nfa', 'nfa-items', 'nfa-and-suppressors', 'suppressors', 'silencers', 'sbr', 'sbrs', 'sbs', 'short-barreled-rifles',
        'receivers', 'lower-receivers', 'lowers', 'stripped-lowers', 'complete-lowers', 'frames',
    ));
}

function agarthan_never_firearm() {
    return apply_filters('agarthan_never_firearm', array(
        'ammunition', 'ammo', 'accessories', 'parts', 'firearm-parts', 'gun-parts', 'rifle-parts', 'pistol-parts',
        'lower-parts', 'lower-parts-kits', 'upper-receivers', 'uppers', 'barrels', 'apparel', 'merch', 'merchandise',
        'optics', 'magazines', 'holsters', 'gear', 'cleaning', 'gift-cards', 'knives', 'airguns', 'air-guns',
        'air-rifles', 'air-pistols', 'bb-guns', 'pellet-guns', 'muzzleloaders', 'black-powder', 'blackpowder',
    ));
}

/* pure: $chains is one array per category, each a list of names/slugs from the
   product's own category up to its department. Returns array(bool, reason). */
function agarthan_chains_need_ffl($chains, $roots = null, $never = null) {
    $roots = $roots === null ? agarthan_firearm_roots() : $roots;
    $never = $never === null ? agarthan_never_firearm() : $never;
    $seen = array();
    foreach ($chains as $chain) {
        $hit = false; $blocked = false;
        foreach ($chain as $label) {
            $slug = agarthan_slug($label);
            if (in_array($slug, $roots, true)) {
                $hit = true;
            }
            if (in_array($slug, $never, true)) {
                $blocked = true;
            }
        }
        $path = implode(' > ', array_reverse($chain));
        if ($hit && !$blocked) {
            return array(true, 'category: ' . $path);
        }
        $seen[] = $path . ($hit && $blocked ? ' (firearm department, excluded)' : '');
    }
    return array(false, $seen ? 'category: ' . implode(' | ', $seen) : 'no category');
}

function agarthan_category_chains($product_id) {
    $terms = get_the_terms($product_id, 'product_cat');
    if (!$terms || is_wp_error($terms)) {
        return array();
    }
    $chains = array();
    foreach ($terms as $term) {
        $chain = array();
        for ($hops = 0; $term && !is_wp_error($term) && $hops < 10; $hops++) {
            $chain[] = $term->slug;
            $chain[] = $term->name;
            $term = $term->parent ? get_term($term->parent, 'product_cat') : null;
        }
        $chains[] = $chain;
    }
    return $chains;
}

function agarthan_product_needs_ffl($product_id) {
    $manual = get_post_meta($product_id, '_agarthan_ffl', true);
    if ($manual === 'yes') {
        return array(true, 'product setting: always a firearm');
    }
    if ($manual === 'no') {
        return array(false, 'product setting: never a firearm');
    }
    return agarthan_chains_need_ffl(agarthan_category_chains($product_id));
}

function agarthan_product_is_nfa($product_id) {
    foreach (agarthan_category_chains($product_id) as $chain) {
        foreach ($chain as $label) {
            if (in_array(agarthan_slug($label), array('nfa', 'nfa-items', 'nfa-and-suppressors', 'suppressors', 'silencers', 'sbr', 'sbrs', 'sbs', 'short-barreled-rifles'), true)) {
                return true;
            }
        }
    }
    return false;
}

function agarthan_cart_has_firearm() {
    if (!function_exists('WC') || !WC()->cart) {
        return false;
    }
    foreach (WC()->cart->get_cart() as $item) {
        $check = agarthan_product_needs_ffl($item['product_id']);   // product_id is the parent of a variation
        if ($check[0]) {
            return true;
        }
    }
    return false;
}

/* Product → Advanced: per-product override */
add_action('woocommerce_product_options_advanced', function () {
    echo '<div class="options_group">';
    woocommerce_wp_select(array(
        'id'          => '_agarthan_ffl',
        'label'       => __('Firearm (FFL)', 'agarthan'),
        'options'     => array(
            ''    => __('Automatic — by category', 'agarthan'),
            'yes' => __('Always a firearm (pickup / FFL at checkout)', 'agarthan'),
            'no'  => __('Never a firearm', 'agarthan'),
        ),
        'description' => __('Overrides the category rule for this product only.', 'agarthan'),
        'desc_tip'    => true,
    ));
    echo '</div>';
});
add_action('woocommerce_admin_process_product_object', function ($product) {
    $v = isset($_POST['_agarthan_ffl']) ? sanitize_key(wp_unslash($_POST['_agarthan_ffl'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- Woo checks the product nonce
    if ($v === 'yes' || $v === 'no') {
        $product->update_meta_data('_agarthan_ffl', $v);
    } else {
        $product->delete_meta_data('_agarthan_ffl');
    }
});

/* ?aa-ffl-debug=1 on cart/checkout: which line counts as a firearm, and why */
$agarthan_ffl_debug = function () {
    if (!isset($_GET['aa-ffl-debug']) || !current_user_can('manage_woocommerce') || !function_exists('WC') || !WC()->cart) { // phpcs:ignore WordPress.Security.NonceVerification
        return;
    }
    $lines = array();
    foreach (WC()->cart->get_cart() as $item) {
        $check = agarthan_product_needs_ffl($item['product_id']);
        $lines[] = esc_html($item['data']->get_name()) . ' — ' . ($check[0] ? '<strong>firearm</strong>' : 'not a firearm') . ' <small>(' . esc_html($check[1]) . ')</small>';
    }
    wc_print_notice('<strong>Firearm check</strong> (store managers only)<br>' . implode('<br>', $lines), 'notice');
};
add_action('woocommerce_before_cart', $agarthan_ffl_debug);
add_action('woocommerce_before_checkout_form', $agarthan_ffl_debug);

/* product page: how a firearm is released */
add_action('woocommerce_single_product_summary', function () {
    global $product;
    if (!$product) {
        return;
    }
    $check = agarthan_product_needs_ffl($product->get_id());
    if (!$check[0]) {
        return;
    }
    $f = agarthan_facts();
    echo '<div class="aa-release-note"><span class="aa-eyebrow">Firearm · release protocol</span><p>';
    echo 'Released at our ' . esc_html($f['city']) . ' counter after ATF Form 4473 and a background check — bring a valid government photo ID.';
    if (!empty($f['ship_to_ffl'])) {
        echo ' Or have it shipped to your local FFL dealer.';
    }
    echo ' Handguns 21+, long guns 18+.</p></div>';
}, 35);

/* checkout: the firearm panel */
add_action('woocommerce_after_checkout_billing_form', function ($checkout) {
    if (!agarthan_cart_has_firearm()) {
        return;
    }
    $f = agarthan_facts();
    echo '<div class="aa-firearm-fields" id="aa-firearm-fields"><h3>' . esc_html__('Firearm release', 'agarthan') . '</h3>';
    echo '<p class="aa-firearm-note">' . esc_html__('Your order includes a firearm. Federal law requires ATF Form 4473 and a background check before it changes hands — choose how you will receive it.', 'agarthan') . '</p>';

    $options = array('pickup' => sprintf(__('Pick up at the outpost — %s', 'agarthan'), agarthan_address_line()));
    if (!empty($f['ship_to_ffl'])) {
        $options['ffl'] = __('Ship to my local FFL dealer (they run the transfer)', 'agarthan');
    }
    $chosen = $checkout->get_value('aa_release');
    woocommerce_form_field('aa_release', array(
        'type'     => 'radio',
        'label'    => __('Release method', 'agarthan'),
        'required' => true,
        'options'  => $options,
        'default'  => 'pickup',
        'class'    => array('form-row-wide', 'aa-release'),
    ), $chosen ? $chosen : 'pickup');

    if (!empty($f['ship_to_ffl'])) {
        echo '<div class="aa-ffl-dealer"' . ($chosen === 'ffl' ? '' : ' hidden') . '>';
        woocommerce_form_field('aa_ffl_name', array('type' => 'text', 'label' => __('FFL dealer name', 'agarthan'), 'required' => true, 'class' => array('form-row-first')), $checkout->get_value('aa_ffl_name'));
        woocommerce_form_field('aa_ffl_phone', array('type' => 'tel', 'label' => __('FFL dealer phone', 'agarthan'), 'required' => true, 'class' => array('form-row-last')), $checkout->get_value('aa_ffl_phone'));
        woocommerce_form_field('aa_ffl_license', array('type' => 'text', 'label' => __('FFL number (optional)', 'agarthan'), 'required' => false, 'class' => array('form-row-first')), $checkout->get_value('aa_ffl_license'));
        woocommerce_form_field('aa_ffl_email', array('type' => 'email', 'label' => __('FFL dealer email (optional)', 'agarthan'), 'required' => false, 'class' => array('form-row-last')), $checkout->get_value('aa_ffl_email'));
        echo '<p class="aa-firearm-note">' . esc_html__('Firearms never ship to a home address. Confirm your dealer accepts transfers and their fee before ordering.', 'agarthan') . '</p>';
        echo '</div>';
    }

    woocommerce_form_field('aa_attest', array(
        'type'     => 'checkbox',
        'label'    => __('I am at least 21 (handguns) or 18 (long guns), I am not prohibited from owning firearms, and I understand the firearm is released only after ATF Form 4473 and an approved background check.', 'agarthan'),
        'required' => true,
        'class'    => array('form-row-wide', 'aa-attest'),
    ), $checkout->get_value('aa_attest'));
    echo '</div>';
});

add_action('woocommerce_checkout_process', function () {
    if (!agarthan_cart_has_firearm()) {
        return;
    }
    $f = agarthan_facts();
    // phpcs:disable WordPress.Security.NonceVerification -- WooCommerce verifies the checkout nonce before this hook
    $release = isset($_POST['aa_release']) ? sanitize_key(wp_unslash($_POST['aa_release'])) : '';
    if ($release !== 'pickup' && !($release === 'ffl' && !empty($f['ship_to_ffl']))) {
        wc_add_notice(__('Your order includes a firearm — choose how you will receive it.', 'agarthan'), 'error');
    }
    if ($release === 'ffl' && (empty($_POST['aa_ffl_name']) || empty($_POST['aa_ffl_phone']))) {
        wc_add_notice(__('Please give your receiving FFL dealer’s name and phone.', 'agarthan'), 'error');
    }
    if (empty($_POST['aa_attest'])) {
        wc_add_notice(__('Please confirm the firearm eligibility statement.', 'agarthan'), 'error');
    }
    // phpcs:enable
});

add_action('woocommerce_checkout_create_order', function ($order) {
    if (!agarthan_cart_has_firearm()) {
        return;
    }
    // phpcs:disable WordPress.Security.NonceVerification
    $release = isset($_POST['aa_release']) && sanitize_key(wp_unslash($_POST['aa_release'])) === 'ffl' ? 'ffl' : 'pickup';
    $order->update_meta_data('_aa_release', $release);
    $order->update_meta_data('_aa_attest', 'yes');
    if ($release === 'ffl') {
        foreach (array('aa_ffl_name', 'aa_ffl_phone', 'aa_ffl_license', 'aa_ffl_email') as $key) {
            if (!empty($_POST[$key])) {
                $value = $key === 'aa_ffl_email' ? sanitize_email(wp_unslash($_POST[$key])) : sanitize_text_field(wp_unslash($_POST[$key]));
                $order->update_meta_data('_' . $key, $value);
            }
        }
    }
    // phpcs:enable
});

/* the release, wherever the order is shown: admin, thank-you / view order, emails */
function agarthan_order_release_lines($order) {
    $release = $order->get_meta('_aa_release');
    if (!$release) {
        return array();
    }
    if ($release === 'pickup') {
        return array(__('Release method', 'agarthan') => sprintf(__('Pick up at the outpost — %s. Bring a valid government photo ID; ATF Form 4473 and a background check at the counter.', 'agarthan'), agarthan_address_line()));
    }
    $dealer = array_filter(array($order->get_meta('_aa_ffl_name'), $order->get_meta('_aa_ffl_phone'), $order->get_meta('_aa_ffl_license') ? 'FFL ' . $order->get_meta('_aa_ffl_license') : '', $order->get_meta('_aa_ffl_email')));
    return array(__('Release method', 'agarthan') => __('Ship to the buyer’s FFL dealer', 'agarthan'), __('Receiving FFL', 'agarthan') => implode(' · ', $dealer));
}

add_action('woocommerce_admin_order_data_after_shipping_address', function ($order) {
    foreach (agarthan_order_release_lines($order) as $k => $v) {
        echo '<p><strong>' . esc_html($k) . ':</strong> ' . esc_html($v) . '</p>';
    }
});

/* the release on the order's REST answer, so the site's Ops Console (read-only key) can show it */
add_filter('woocommerce_rest_prepare_shop_order_object', function ($response, $order) {
    $lines = agarthan_order_release_lines($order);
    if ($lines && is_object($response) && method_exists($response, 'get_data')) {
        $data = $response->get_data();
        $data['agarthan_release'] = $lines;
        $response->set_data($data);
    }
    return $response;
}, 10, 2);

add_action('woocommerce_order_details_after_order_table', function ($order) {
    $lines = agarthan_order_release_lines($order);
    if (!$lines) {
        return;
    }
    echo '<section class="aa-release-panel"><h2>' . esc_html__('Firearm release', 'agarthan') . '</h2><dl>';
    foreach ($lines as $k => $v) {
        echo '<dt>' . esc_html($k) . '</dt><dd>' . esc_html($v) . '</dd>';
    }
    echo '</dl></section>';
});

add_action('woocommerce_email_after_order_table', function ($order, $sent_to_admin, $plain_text) {
    $lines = agarthan_order_release_lines($order);
    if (!$lines) {
        return;
    }
    if ($plain_text) {
        foreach ($lines as $k => $v) {
            echo esc_html($k) . ': ' . esc_html($v) . "\n";
        }
        echo "\n";
        return;
    }
    echo '<h2>' . esc_html__('Firearm release', 'agarthan') . '</h2><p>';
    foreach ($lines as $k => $v) {
        echo '<strong>' . esc_html($k) . ':</strong> ' . esc_html($v) . '<br>';
    }
    echo '</p>';
}, 10, 3);

/* checkout: eyebrow over the form, reassurance under the button */
add_action('woocommerce_review_order_after_submit', function () {
    $f = agarthan_facts();
    echo '<div class="aa-secure-line">Encrypted checkout · firearms released after 4473 + background check' . ($f['ffl_number'] ? ' · FFL ' . esc_html($f['ffl_number']) : '') . '</div>';
});

/* =============================================================================
   ORDER EMAILS — the store's colours instead of WooCommerce purple
   ============================================================================= */
add_action('init', function () {
    $colors = array(
        'woocommerce_email_base_color'            => '#0b1b30',
        'woocommerce_email_background_color'      => '#e6eef4',
        'woocommerce_email_body_background_color' => '#ffffff',
        'woocommerce_email_text_color'            => '#1d2b38',
        'woocommerce_email_footer_text_color'     => '#5f788c',
    );
    foreach ($colors as $option => $color) {
        add_filter('pre_option_' . $option, function () use ($color) {
            return $color;
        });
    }
});

/* =============================================================================
   AGE GATE — the site's perimeter checkpoint, on every store page until passed
   ============================================================================= */
add_action('wp_footer', function () {
    $f = agarthan_facts();
    if (empty($f['age_gate']) || is_admin() || (function_exists('is_checkout') && is_order_received_page())) {
        return;
    }
    $age = (int) $f['age_min'];
    ?>
<div class="aa-gate" id="aa-gate" role="dialog" aria-modal="true" aria-labelledby="aa-gate-title">
  <div class="aa-gate-card">
    <span class="aa-seal aa-gate-seal" aria-hidden="true"><img src="<?php echo esc_url(agarthan_asset('img/seal-160.png')); ?>" alt="" width="72" height="72"></span>
    <span class="aa-eyebrow">Perimeter checkpoint</span>
    <h2 id="aa-gate-title">Credentials required beyond the wall</h2>
    <p>This outpost deals in firearms and ammunition. You must be <b><?php echo esc_html($age); ?> or older</b> to pass.</p>
    <div class="aa-gate-actions">
      <button class="button alt" type="button" data-aa-gate="yes">I’m <?php echo esc_html($age); ?> or older · open the gate</button>
      <button class="button" type="button" data-aa-gate="no">Turn back</button>
    </div>
    <p class="aa-gate-fine">By entering you confirm you are of legal age where you live. Every firearm sale complies with federal, state and local law.</p>
  </div>
</div>
    <?php
}, 5);
