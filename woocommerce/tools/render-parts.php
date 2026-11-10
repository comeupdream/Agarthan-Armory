<?php
/**
 * Prints the theme's own markup pieces as JSON, for the render harness
 * (skin-audit.mjs) — so the test pages carry exactly what functions.php
 * outputs. Run by the harness: php woocommerce/tools/render-parts.php
 */
define('AA_THEME_URI', '/woocommerce/theme/agarthan-armory');
require __DIR__ . '/wp-stubs.php';
require __DIR__ . '/../theme/agarthan-armory/functions.php';

$cart_items = array();
class AA_Cart { public function get_cart() { return $GLOBALS['cart_items']; } }
class AA_WC { public $cart; public function __construct() { $this->cart = new AA_Cart(); } }
function WC() { static $wc; return $wc ? $wc : ($wc = new AA_WC()); }
class AA_Checkout { public function get_value($k) { return $k === 'aa_release' ? 'ffl' : ''; } }
class AA_Order { public $m; public function __construct($m) { $this->m = $m; } public function get_meta($k) { return isset($this->m[$k]) ? $this->m[$k] : ''; } }

function capture($fn) { ob_start(); $fn(); return ob_get_clean(); }
function card_bits($product) {
    $GLOBALS['product'] = $product;
    return array(
        'top'   => capture(function () { do_action('woocommerce_before_shop_loop_item'); }),
        'tag'   => capture(function () { do_action('woocommerce_before_shop_loop_item_title'); }),
        'brand' => capture(function () { do_action('woocommerce_shop_loop_item_title'); }),
        'img'   => apply_filters('woocommerce_product_get_image', '', $product, 'woocommerce_thumbnail', array(), true),
    );
}

// products for the shop grid: id => [name, categories, options]
$products = array(
    101 => array('Rossi Brawler — 45 Colt, Fixed Sights', array(2), array('image' => 1, 'attrs' => array('brand' => 'Rossi'))),
    102 => array('Heckler & Koch MR762 A4 Pistol — 7.62x51', array(15), array('image' => 1, 'stock' => 'onbackorder', 'attrs' => array('brand' => 'Heckler & Koch'))),
    103 => array('TISHA 30 Cal Titanium Suppressor — FDE', array(10), array('image' => 1, 'manage' => true, 'qty' => 1, 'attrs' => array('brand' => 'Stealth Additive Works'))),
    104 => array('Personal Defense HST .40 S&W 180 gr JHP', array(6), array('image' => 1, 'attrs' => array('brand' => 'Federal'))),
    105 => array('Thermion 2 LRF XP50 Pro Thermal Riflescope', array(8), array('stock' => 'outofstock', 'attrs' => array('brand' => 'Pulsar'))),
    106 => array('Glock 19 Gen5 9mm — 15 Round', array(2), array('attrs' => array('brand' => 'Glock'))),
    107 => array('Agarthan Armory Expedition Tee', array(17), array()),
);
$cards = array();
foreach ($products as $id => $p) {
    $GLOBALS['aa_product_terms'][$id] = $p[1];
    $cards[$id] = card_bits(new WC_Product($id, $p[0], $p[2]));
}

$GLOBALS['product'] = new WC_Product(101, 'Glock 19 Gen5 9mm');
$release_note = capture(function () { do_action('woocommerce_single_product_summary'); });
$GLOBALS['product'] = new WC_Product(104, 'Federal HST 9mm');
$gallery_holo = apply_filters('woocommerce_placeholder_img_src', '');

$cart_items = array(array('product_id' => 101, 'data' => new WC_Product(101, 'Glock 19 Gen5 9mm')));
$firearm_fields = capture(function () { do_action('woocommerce_after_checkout_billing_form', new AA_Checkout()); });
$secure_line = capture(function () { do_action('woocommerce_review_order_after_submit'); });
$release_panel = capture(function () {
    do_action('woocommerce_order_details_after_order_table', new AA_Order(array('_aa_release' => 'pickup')));
});

echo json_encode(array(
    'ticker'        => capture('agarthan_ticker'),
    'branding'      => capture('agarthan_branding'),
    'footer'        => capture('agarthan_footer'),
    'gate'          => capture(function () { do_action('wp_footer'); }),
    'cards'         => $cards,
    'releaseNote'   => $release_note,
    'galleryHolo'   => $gallery_holo,
    'firearmFields' => $firearm_fields,
    'secureLine'    => $secure_line,
    'releasePanel'  => $release_panel,
), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
