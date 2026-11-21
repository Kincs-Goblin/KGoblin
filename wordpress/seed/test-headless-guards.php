<?php
/**
 * WordPress nélküli unit-tesztek a kg-headless plugin fail-closed őreihez:
 * frontend URL feloldása (nincs csendes `localhost` fallback) és a lokális webhook-lazítás
 * környezeti kapuja (SSRF-védelem csak `local` WP-környezetben lazul).
 *
 * Futtatás (ugyanaz, mint a CI `PHP (kg-headless)` jobja):
 *   docker run --rm -v "$PWD:/repo" -w /repo php:8.2-cli php wordpress/seed/test-headless-guards.php
 *
 * @package KG_Headless
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

// Minimális WP-stubok: a plugin betöltéskor csak hookokat regisztrál.
$kg_test_options  = array();
$kg_test_env_type = 'production';

function plugin_dir_path( string $file ): string {
	return dirname( $file ) . '/';
}
$kg_test_hooks = array();
function add_action( string $hook, callable $callback, mixed ...$rest ): void {
	$GLOBALS['kg_test_hooks'][ $hook ][] = $callback;
}
function add_filter( string $hook, callable $callback, mixed ...$rest ): void {
	$GLOBALS['kg_test_hooks'][ $hook ][] = $callback;
}
function is_admin(): bool {
	return false;
}
/** Az első regisztrált callback egy hookra (a plugin mindegyikre egyet regisztrál). */
function kg_test_hook( string $hook ): callable {
	return $GLOBALS['kg_test_hooks'][ $hook ][0];
}
function get_option( string $name, mixed $default = false ): mixed {
	global $kg_test_options;
	return $kg_test_options[ $name ] ?? $default;
}
function untrailingslashit( string $value ): string {
	return rtrim( $value, '/\\' );
}
function wp_get_environment_type(): string {
	global $kg_test_env_type;
	return $kg_test_env_type;
}

// A `woocommerce_get_checkout_order_received_url` filter típusa miatt kell egy minimális rendelés-stub.
class WC_Order {
	public function get_id(): int {
		return 42;
	}
	public function get_order_key(): string {
		return 'wc_order_abc';
	}
}

// A „nincs beállítva” log ne szemetelje a kimenetet.
ini_set( 'error_log', sys_get_temp_dir() . '/kg-headless-guards-test.log' );

// Repóból (CI, `docker run php:8.2-cli`) a `wordpress/plugins`, a wpcli-konténerben a wp-content alatti példány.
$plugin_file = file_exists( __DIR__ . '/../plugins/kg-headless/kg-headless.php' )
	? __DIR__ . '/../plugins/kg-headless/kg-headless.php'
	: '/var/www/html/wp-content/plugins/kg-headless/kg-headless.php';
require_once $plugin_file;

$failures = 0;

function assert_same( mixed $expected, mixed $actual, string $label ): void {
	global $failures;
	if ( $expected !== $actual ) {
		echo "[FAIL] {$label} -> Várt: " . var_export( $expected, true ) . ', Kapott: ' . var_export( $actual, true ) . "\n";
		$failures++;
	} else {
		echo "[PASS] {$label}\n";
	}
}

function reset_state(): void {
	global $kg_test_options, $kg_test_env_type;
	$kg_test_options  = array();
	$kg_test_env_type = 'production';
	putenv( 'KG_FRONTEND_URL' );
	putenv( 'KG_ALLOW_LOCAL_WEBHOOKS' );
}

echo "=== 1. Frontend URL feloldása ===\n";
reset_state();
putenv( 'KG_FRONTEND_URL= https://shop.example.com/ ' );
assert_same( 'https://shop.example.com', kg_headless_get_frontend_url(), 'Env-érték, trimelve, perjel nélkül' );

reset_state();
$kg_test_options['kg_headless_frontend_url'] = 'https://opt.example.com/';
assert_same( 'https://opt.example.com', kg_headless_get_frontend_url(), 'Opció, ha nincs env' );

reset_state();
assert_same( '', kg_headless_get_frontend_url(), 'Konfiguráció nélkül üres, nincs localhost fallback' );

echo "\n=== 2. Woo-linkek: frontend URL nélkül a WordPress saját URL-je marad ===\n";
$order_url = kg_test_hook( 'woocommerce_get_checkout_order_received_url' );
$lost_url  = kg_test_hook( 'lostpassword_url' );

reset_state();
assert_same( 'https://wp.example/rendeles', $order_url( 'https://wp.example/rendeles', new WC_Order() ), 'Rendelés-visszaigazolás: nincs localhost' );
assert_same( 'https://wp.example/lost', $lost_url( 'https://wp.example/lost' ), 'Jelszó-visszaállítás: nincs localhost' );

reset_state();
putenv( 'KG_FRONTEND_URL=https://shop.example.com' );
assert_same( 'https://shop.example.com/rendeles-visszaigazolas/42?key=wc_order_abc', $order_url( 'x', new WC_Order() ), 'Rendelés-visszaigazolás a storefrontra' );
assert_same( 'https://shop.example.com/elfelejtett-jelszo', $lost_url( 'x' ), 'Jelszó-visszaállítás a storefrontra' );

echo "\n=== 3. Lokális webhook-lazítás környezeti kapuja ===\n";
reset_state();
$kg_test_options['kg_headless_allow_local_webhooks'] = 'yes';
assert_same( false, kg_headless_allows_local_webhooks(), 'production + ottmaradt opció: nincs lazítás' );

reset_state();
$kg_test_env_type = 'staging';
putenv( 'KG_ALLOW_LOCAL_WEBHOOKS=1' );
assert_same( false, kg_headless_allows_local_webhooks(), 'staging + env: nincs lazítás' );

reset_state();
$kg_test_env_type                                    = 'local';
$kg_test_options['kg_headless_allow_local_webhooks'] = 'yes';
assert_same( true, kg_headless_allows_local_webhooks(), 'local + opció: lazítás' );

reset_state();
$kg_test_env_type = 'local';
assert_same( false, kg_headless_allows_local_webhooks(), 'local, opt-in nélkül: nincs lazítás' );

reset_state();
assert_same( true, kg_headless_is_local_webhook_host( ' Host.Docker.Internal ' ), 'host.docker.internal lokális host' );
assert_same( false, kg_headless_is_local_webhook_host( 'example.com' ), 'Külső host nem lokális' );

if ( $failures > 0 ) {
	echo "\nÖSSZESÍTÉS: {$failures} teszt ELBUKOTT!\n";
	exit( 1 );
}

echo "\nÖSSZESÍTÉS: Minden kg-headless őr-teszt SIKERES (0 hiba)!\n";
