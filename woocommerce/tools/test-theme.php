<?php
/**
 * Unit checks for the theme's PHP: which products count as firearms, which
 * hologram a product without a photo gets, stock labels, and that the header,
 * footer and age gate render. Run: php woocommerce/tools/test-theme.php
 */
require __DIR__ . '/wp-stubs.php';
require __DIR__ . '/../theme/agarthan-armory/functions.php';

$pass = 0; $fail = 0;
function eq($got, $want, $msg) {
    global $pass, $fail;
    if ($got === $want) { $pass++; return; }
    $fail++;
    echo "✗ $msg\n    got:  " . var_export($got, true) . "\n    want: " . var_export($want, true) . "\n";
}
function ffl($terms) { $GLOBALS['aa_product_terms'][900] = $terms; $r = agarthan_product_needs_ffl(900); return $r[0]; }

/* ---- firearms ---- */
eq(ffl(array(2)), true, 'Firearms > Handguns is a firearm');
eq(ffl(array(15)), true, 'Rifles > AR & Rifle-Caliber Pistols is a firearm');
eq(ffl(array(18)), true, 'a -2 slug (shotguns-2) still counts');
eq(ffl(array(4)), false, 'Rifles > Muzzleloaders is not (black powder)');
eq(ffl(array(6)), false, 'Ammunition > Handgun Ammo is not');
eq(ffl(array(8)), false, 'Optics > Night Vision is not');
eq(ffl(array(10)), true, 'NFA & Suppressors > Suppressors is (Form 4 + FFL)');
eq(ffl(array(12)), false, 'a lower filed under Accessories is not — fix it per product');
eq(ffl(array(16)), true, 'Stripped Lowers is a firearm');
eq(ffl(array(14)), false, 'Parts > Lower Parts Kits is not');
eq(ffl(array(17)), false, 'Apparel is not');
eq(ffl(array(6, 2)), true, 'any one firearm category is enough');
eq(ffl(array()), false, 'no category, not a firearm');
$GLOBALS['aa_product_terms'][901] = array(12);
$GLOBALS['aa_post_meta'][901]['_agarthan_ffl'] = 'yes';
eq(agarthan_product_needs_ffl(901)[0], true, 'per-product override: always');
$GLOBALS['aa_product_terms'][902] = array(2);
$GLOBALS['aa_post_meta'][902]['_agarthan_ffl'] = 'no';
eq(agarthan_product_needs_ffl(902)[0], false, 'per-product override: never');
eq(agarthan_slug('NFA & Suppressors'), 'nfa-and-suppressors', 'names slug the WordPress way');
$GLOBALS['aa_product_terms'][903] = array(10);
eq(agarthan_product_is_nfa(903), true, 'suppressors get the NFA plate');
$GLOBALS['aa_product_terms'][904] = array(2);
eq(agarthan_product_is_nfa(904), false, 'handguns do not');

/* ---- holograms for products without photos ---- */
$h = 'agarthan_holo_type_from_words';
eq($h('glock 19 gen5 handguns firearms'), 'pistol', 'handgun → pistol');
eq($h('smith & wesson model 686 revolver handguns'), 'revolver', 'revolver');
eq($h('aero precision ar-15 rifle firearms'), 'ar', 'AR-15 → ar');
eq($h('ruger american rifles firearms'), 'bolt', 'rifle → bolt');
eq($h('mossberg 500 shotguns firearms'), 'shotgun', 'shotgun');
eq($h('federal hst 9mm handgun ammo ammunition'), 'ammo', 'ammo before handgun');
eq($h('federal 12 gauge buckshot shotshell ammunition'), 'shells', 'shotshells');
eq($h('trijicon rmr red dot optics'), 'reddot', 'red dot');
eq($h('pulsar thermion thermal optics'), 'thermal', 'thermal');
eq($h('vortex razor riflescope optics'), 'scope', 'scope');
eq($h('magpul pmag 30 magazines'), 'mag', 'magazine');
eq($h('surefire x300 weapon light'), 'light', 'light');
eq($h('sig sauer srd556 suppressors nfa'), 'can', 'suppressor → can');
eq($h('liberty safe fatboy'), 'safe', 'safe');
eq($h('otis cleaning kit'), 'kit', 'cleaning kit');
eq($h('agarthan t-shirt apparel'), 'case', 'apparel → case');
eq($h('mystery item'), '', 'nothing fits → empty, so the caller can try the name');
$GLOBALS['aa_product_terms'][905] = array(2);
eq(agarthan_holo_type(new WC_Product(905, 'Glock 19 Gen5 9mm — 15 Round')), 'pistol', 'the Handguns category beats "15 Round" in the name');
$GLOBALS['aa_product_terms'][906] = array();
eq(agarthan_holo_type(new WC_Product(906, 'Hornady Critical Defense 9mm 25 rounds')), 'ammo', 'no category: the name decides');
eq(agarthan_holo_type(new WC_Product(907, 'Mystery box')), 'case', 'nothing at all: case');

/* ---- stock line ---- */
eq(agarthan_stock_state(new WC_Product(1, 'x')), array('in', 'In stock'), 'in stock');
eq(agarthan_stock_state(new WC_Product(1, 'x', array('stock' => 'onbackorder'))), array('order', 'Special order'), 'backorder reads as special order');
eq(agarthan_stock_state(new WC_Product(1, 'x', array('stock' => 'outofstock'))), array('out', 'Out of stock'), 'out of stock');
eq(agarthan_stock_state(new WC_Product(1, 'x', array('manage' => true, 'qty' => 2))), array('low', 'Few left'), 'low stock');

/* ---- markup renders without PHP errors ---- */
ob_start(); agarthan_ticker(); $t = ob_get_clean();
eq(strpos($t, 'data-aa-clock') !== false, true, 'ticker has the clock');
ob_start(); agarthan_branding(); $b = ob_get_clean();
eq(strpos($b, 'Agarthan Armory') !== false && strpos($b, 'seal-160.png') !== false, true, 'branding has the seal and the name');
ob_start(); agarthan_footer(); $f = ob_get_clean();
eq(strpos($f, 'FFL · 1-59-011-07-8A-59532') !== false, true, 'footer shows the FFL plate');
eq(strpos($f, 'product-category/handguns') === false && strpos($f, 'product-category/firearms') !== false, true, 'footer lists top-level categories only');
eq(substr_count($f, '<svg'), 4, 'four card marks by default');
eq(strpos($f, '(561) 830-3366') !== false, true, 'footer shows the phone');

echo ($fail ? '✗' : '✓') . " $pass passed, $fail failed\n";
exit($fail ? 1 : 0);
