<?php
/**
 * Just enough of WordPress + WooCommerce to load the theme's functions.php in
 * plain PHP: hooks are recorded (not run), template helpers echo the same
 * markup WordPress/WooCommerce would, and the store data is a small fixture.
 * Used by test-theme.php (unit checks) and render-parts.php (harness markup).
 */

define('ABSPATH', __DIR__ . '/');

$GLOBALS['aa_hooks'] = array();
$GLOBALS['aa_filters'] = array();
$GLOBALS['aa_options'] = array();
$GLOBALS['aa_post_meta'] = array();
$GLOBALS['aa_terms'] = array();          // term_id => object(term_id, slug, name, parent)
$GLOBALS['aa_product_terms'] = array();  // product_id => [term_id, ...]
$GLOBALS['aa_pages'] = array();          // slug => url

function add_action($hook, $cb, $prio = 10, $args = 1) { $GLOBALS['aa_hooks'][$hook][$prio][] = $cb; return true; }
function remove_action($hook, $cb, $prio = 10) { return true; }
function add_filter($hook, $cb, $prio = 10, $args = 1) { $GLOBALS['aa_filters'][$hook][$prio][] = array($cb, $args); return true; }
function apply_filters($hook, $value) {
    $args = func_get_args();
    array_shift($args);
    if (!empty($GLOBALS['aa_filters'][$hook])) {
        ksort($GLOBALS['aa_filters'][$hook]);
        foreach ($GLOBALS['aa_filters'][$hook] as $cbs) {
            foreach ($cbs as $f) {
                $args[0] = call_user_func_array($f[0], array_slice($args, 0, max(1, $f[1])));
            }
        }
    }
    return $args[0];
}
function do_action($hook) {
    $args = func_get_args();
    array_shift($args);
    if (!empty($GLOBALS['aa_hooks'][$hook])) {
        ksort($GLOBALS['aa_hooks'][$hook]);
        foreach ($GLOBALS['aa_hooks'][$hook] as $cbs) {
            foreach ($cbs as $cb) {
                call_user_func_array($cb, $args);
            }
        }
    }
}

function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8', false); }
function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8', false); }
function esc_url($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8', false); }
function esc_html__($s, $d = '') { return esc_html($s); }
function esc_attr__($s, $d = '') { return esc_attr($s); }
function __($s, $d = '') { return $s; }
function sanitize_key($s) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $s)); }
function sanitize_text_field($s) { return trim(strip_tags((string) $s)); }
function sanitize_email($s) { return filter_var((string) $s, FILTER_SANITIZE_EMAIL); }
function wp_unslash($s) { return is_string($s) ? stripslashes($s) : $s; }
function remove_accents($s) { return (string) $s; }
function is_wp_error($x) { return $x instanceof WP_Error; }
class WP_Error {}

function home_url($p = '') { return 'http://store.test' . $p; }
function get_stylesheet_directory_uri() { return defined('AA_THEME_URI') ? AA_THEME_URI : 'http://store.test/wp-content/themes/agarthan-armory'; }
function get_stylesheet_uri() { return get_stylesheet_directory_uri() . '/style.css'; }
function get_option($k, $d = false) { return isset($GLOBALS['aa_options'][$k]) ? $GLOBALS['aa_options'][$k] : $d; }
function update_option($k, $v) { $GLOBALS['aa_options'][$k] = $v; return true; }
function delete_option($k) { unset($GLOBALS['aa_options'][$k]); return true; }
function get_post_meta($id, $k, $single = false) { return isset($GLOBALS['aa_post_meta'][$id][$k]) ? $GLOBALS['aa_post_meta'][$id][$k] : ''; }
function get_page_by_path($slug) { return isset($GLOBALS['aa_pages'][$slug]) ? (object) array('post_status' => 'publish', 'slug' => $slug) : null; }
function get_permalink($p) { return is_object($p) ? $GLOBALS['aa_pages'][$p->slug] : home_url('/?p=' . $p); }
function get_privacy_policy_url() { return home_url('/privacy-policy/'); }
function wc_terms_and_conditions_page_id() { return 0; }
function wc_get_page_permalink($p) { return home_url('/' . ($p === 'myaccount' ? 'my-account' : $p) . '/'); }
function wc_get_cart_url() { return home_url('/cart/'); }
function taxonomy_exists($t) { return false; }
function current_user_can($c) { return false; }
function is_admin() { return false; }
function is_order_received_page() { return false; }

function get_terms($args) {
    $out = array();
    foreach ($GLOBALS['aa_terms'] as $t) {
        if ((int) $t->parent === (int) $args['parent']) {
            $out[] = $t;
        }
    }
    return $out;
}
function get_term($id, $tax = '') { return isset($GLOBALS['aa_terms'][$id]) ? $GLOBALS['aa_terms'][$id] : null; }
function get_term_link($t) { return home_url('/product-category/' . $t->slug . '/'); }
function get_the_terms($id, $tax) {
    if ($tax !== 'product_cat' || empty($GLOBALS['aa_product_terms'][$id])) {
        return false;
    }
    return array_map(function ($tid) { return $GLOBALS['aa_terms'][$tid]; }, $GLOBALS['aa_product_terms'][$id]);
}
function get_ancestors($id, $tax) {
    $out = array();
    $t = get_term($id);
    while ($t && $t->parent) { $out[] = $t->parent; $t = get_term($t->parent); }
    return $out;
}

/* WooCommerce's form field markup (woocommerce_form_field), for the types the theme uses */
function woocommerce_form_field($key, $args, $value = null) {
    $req = !empty($args['required']) ? '&nbsp;<abbr class="required" title="required">*</abbr>' : '';
    $cls = implode(' ', isset($args['class']) ? $args['class'] : array()) . (!empty($args['required']) ? ' validate-required' : '');
    $label = isset($args['label']) ? $args['label'] : '';
    echo '<p class="form-row ' . esc_attr($cls) . '" id="' . esc_attr($key) . '_field">';
    if ($args['type'] === 'checkbox') {
        echo '<span class="woocommerce-input-wrapper"><label class="checkbox "><input type="checkbox" class="input-checkbox " name="' . esc_attr($key) . '" id="' . esc_attr($key) . '" value="1"' . ($value ? ' checked' : '') . '> ' . $label . $req . '</label></span></p>';
        return;
    }
    if ($args['type'] === 'radio') {
        $first = array_keys($args['options']);
        echo '<label for="' . esc_attr($key . '_' . $first[0]) . '">' . $label . $req . '</label><span class="woocommerce-input-wrapper">';
        foreach ($args['options'] as $k => $v) {
            echo '<input type="radio" class="input-radio " value="' . esc_attr($k) . '" name="' . esc_attr($key) . '" id="' . esc_attr($key . '_' . $k) . '"' . ((string) $value === (string) $k ? " checked='checked'" : '') . '><label for="' . esc_attr($key . '_' . $k) . '" class="radio ">' . esc_html($v) . '</label>';
        }
        echo '</span></p>';
        return;
    }
    echo '<label for="' . esc_attr($key) . '">' . $label . $req . '</label><span class="woocommerce-input-wrapper"><input type="' . esc_attr($args['type']) . '" class="input-text " name="' . esc_attr($key) . '" id="' . esc_attr($key) . '" value="' . esc_attr($value) . '"></span></p>';
}

/* a tiny WC_Product */
class WC_Product {
    public $id; public $name; public $parent = 0; public $image = 0; public $stock = 'instock'; public $manage = false; public $qty = null;
    public function __construct($id, $name, $opts = array()) { $this->id = $id; $this->name = $name; foreach ($opts as $k => $v) { $this->$k = $v; } }
    public function get_id() { return $this->id; }
    public function get_parent_id() { return $this->parent; }
    public function get_name() { return $this->name; }
    public function get_image_id() { return $this->image; }
    public function get_stock_status() { return $this->stock; }
    public function managing_stock() { return $this->manage; }
    public function get_stock_quantity() { return $this->qty; }
    public $attrs = array();
    public function get_attribute($a) { return isset($this->attrs[$a]) ? $this->attrs[$a] : ''; }
}
function wc_get_product($id) { return null; }
function wc_get_low_stock_amount($p) { return 2; }

/* the store's categories, as a real gun store would set them up */
function aa_term($id, $slug, $name, $parent = 0) { $GLOBALS['aa_terms'][$id] = (object) array('term_id' => $id, 'slug' => $slug, 'name' => $name, 'parent' => $parent); }
aa_term(1, 'firearms', 'Firearms');
aa_term(2, 'handguns', 'Handguns', 1);
aa_term(3, 'rifles', 'Rifles', 1);
aa_term(4, 'muzzleloaders', 'Muzzleloaders', 3);
aa_term(5, 'ammunition', 'Ammunition');
aa_term(6, 'handgun-ammo', 'Handgun Ammo', 5);
aa_term(7, 'optics', 'Optics');
aa_term(8, 'night-vision', 'Night Vision', 7);
aa_term(9, 'nfa-and-suppressors', 'NFA & Suppressors');
aa_term(10, 'suppressors', 'Suppressors', 9);
aa_term(11, 'accessories', 'Accessories');
aa_term(12, 'lower-receivers', 'Lower Receivers', 11);   // a lower is a firearm even under Accessories? no: Accessories blocks it
aa_term(13, 'parts', 'Parts');
aa_term(14, 'lower-parts-kits', 'Lower Parts Kits', 13);
aa_term(15, 'ar-and-rifle-caliber-pistols', 'AR & Rifle-Caliber Pistols', 3);
aa_term(16, 'stripped-lowers', 'Stripped Lowers');
aa_term(17, 'apparel', 'Apparel');
aa_term(18, 'shotguns-2', 'Shotguns', 1);
