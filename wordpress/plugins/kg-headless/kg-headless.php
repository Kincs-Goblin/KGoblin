<?php
/**
 * Plugin Name: KGoblin Headless Commerce
 * Plugin URI: https://github.com/Kincs-Goblin/KGoblin
 * Description: Headless WooCommerce backend kiegészítés a KGoblin multi-brand platformhoz: Store API céges számla és adószám validáció, kötelező jogi nyilatkozatok (ÁSZF, fizetési kötelezettség), EU Omnibus 30 napos legalacsonyabb ár követés és Store API kiterjesztés, valamint nem-admin kérések átirányítása a Next.js storefrontra.
 * Version: 0.1.0
 * Author: KGoblin Team
 * Requires at least: 6.4
 * Requires PHP: 8.2
 * WC requires at least: 8.5
 * WC tested up to: 11.3
 * Text Domain: kg-headless
 *
 * @package KG_Headless
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KG_HEADLESS_VERSION', '0.1.0' );
define( 'KG_HEADLESS_PATH', plugin_dir_path( __FILE__ ) );

require_once KG_HEADLESS_PATH . 'includes/class-kg-omnibus.php';
require_once KG_HEADLESS_PATH . 'includes/class-kg-product-extensions.php';
require_once KG_HEADLESS_PATH . 'includes/class-kg-checkout-fields.php';
require_once KG_HEADLESS_PATH . 'includes/class-kg-slug-redirects.php';

/**
 * 1. WooCommerce HPOS (High-Performance Order Storage) kompatibilitás deklarálása.
 */
add_action(
	'before_woocommerce_init',
	function (): void {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
				'custom_order_tables',
				__FILE__,
				true
			);
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
				'cart_checkout_blocks',
				__FILE__,
				true
			);
		}
	}
);

/**
 * 2. Modulok inicializálása.
 */
add_action(
	'plugins_loaded',
	function (): void {
		\KG_Headless\Omnibus::init();
		\KG_Headless\Product_Extensions::init();
		\KG_Headless\Checkout_Fields::init();
		\KG_Headless\Slug_Redirects::init();
	}
);

/**
 * 3. Headless frontend átirányítás:
 *    Minden nem-admin, nem-REST (`wp-json`), nem-login és nem-cron frontend kérést
 *    átirányít a brandhez tartozó Next.js storefront URL-re.
 */
function kg_headless_get_frontend_url(): string {
	$env_url = getenv( 'KG_FRONTEND_URL' );
	if ( is_string( $env_url ) && '' !== trim( $env_url ) ) {
		return untrailingslashit( trim( $env_url ) );
	}

	if ( defined( 'KG_FRONTEND_URL' ) && is_string( KG_FRONTEND_URL ) && '' !== trim( KG_FRONTEND_URL ) ) {
		return untrailingslashit( trim( KG_FRONTEND_URL ) );
	}

	$opt_url = (string) get_option( 'kg_headless_frontend_url', '' );
	if ( '' !== trim( $opt_url ) ) {
		return untrailingslashit( trim( $opt_url ) );
	}

	// Nincs csendes `localhost` fallback: konfiguráció nélkül a vásárló nem kerülhet rossz hostra.
	static $logged = false; // kérésenként egyszer naplóz
	if ( ! $logged ) {
		$logged = true;
		error_log( '[kg-headless] KG_FRONTEND_URL nincs beállítva: a frontend-kérések 503-at kapnak, a Woo-linkek a WordPress saját URL-jei maradnak.' );
	}
	return '';
}

add_action(
	'template_redirect',
	function (): void {
		if (
			is_admin() ||
			wp_doing_ajax() ||
			wp_doing_cron() ||
			( defined( 'REST_REQUEST' ) && REST_REQUEST ) ||
			( defined( 'WP_CLI' ) && WP_CLI ) ||
			is_robots() ||
			is_favicon()
		) {
			return;
		}

		// Százalékkódolt (%xx) karakterek megtartása (sanitize_text_field törölné az ékezetes URL oktetteket)
		$raw_uri     = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
		$request_uri = '/' . ltrim( $raw_uri, '/' );

		// Biztonsági ellenőrzés, ha a rewrite még nem futott le wp-json vagy wp-login esetén
		if (
			str_starts_with( $request_uri, '/wp-json' ) ||
			str_starts_with( $request_uri, '/wp-admin' ) ||
			str_starts_with( $request_uri, '/wp-login.php' ) ||
			str_contains( $request_uri, 'rest_route=' )
		) {
			return;
		}

		$target_base = kg_headless_get_frontend_url();
		if ( '' === $target_base ) {
			wp_die( 'KG_FRONTEND_URL nincs beállítva.', 'Konfigurációs hiba', array( 'response' => 503 ) );
		}
		$target_url = esc_url_raw( $target_base . $request_uri );

		wp_redirect( $target_url, 302, 'KGoblin-Headless' );
		exit;
	},
	1
);

/**
 * 4. Rendelés-visszaigazoló és jelszó-visszaállító URL-ek átírása a Next.js storefront domainjére.
 */
add_filter(
	'woocommerce_get_checkout_order_received_url',
	function ( string $url, \WC_Order $order ): string {
		$frontend = kg_headless_get_frontend_url();
		if ( '' === $frontend ) {
			return $url;
		}
		return sprintf(
			'%s/rendeles-visszaigazolas/%d?key=%s',
			$frontend,
			$order->get_id(),
			rawurlencode( $order->get_order_key() )
		);
	},
	10,
	2
);

add_filter(
	'lostpassword_url',
	function ( string $lostpassword_url ): string {
		$frontend = kg_headless_get_frontend_url();
		if ( is_admin() || '' === $frontend ) {
			return $lostpassword_url;
		}
		return $frontend . '/elfelejtett-jelszo';
	},
	10,
	1
);

/**
 * 5. Lokális Docker fejlesztői környezetben (opt-in) a localhost / host.docker.internal webhook
 *    célcímek és dev portok engedélyezése a `wp_safe_remote_post` hívásokhoz. Élesben soha nincs bekapcsolva.
 */
function kg_headless_allows_local_webhooks(): bool {
	// A WP SSRF-védelmét csak lokális WP-környezetben lazítjuk, egy ottmaradt opció máshol hatástalan.
	if ( 'local' !== wp_get_environment_type() ) {
		return false;
	}
	return '1' === getenv( 'KG_ALLOW_LOCAL_WEBHOOKS' )
		|| 'yes' === get_option( 'kg_headless_allow_local_webhooks' );
}

function kg_headless_is_local_webhook_host( string $host ): bool {
	return in_array(
		strtolower( trim( $host ) ),
		array( 'host.docker.internal', 'localhost', '127.0.0.1' ),
		true
	);
}

add_filter(
	'http_request_host_is_external',
	static function ( mixed $external, mixed $host = '' ): bool {
		if ( ! kg_headless_allows_local_webhooks() || ! is_string( $host ) ) {
			return (bool) $external;
		}
		if ( kg_headless_is_local_webhook_host( $host ) ) {
			return true;
		}
		return (bool) $external;
	},
	10,
	2
);

add_filter(
	'http_allowed_safe_ports',
	static function ( mixed $ports, mixed $host = '' ): mixed {
		if ( ! is_array( $ports ) || ! kg_headless_allows_local_webhooks() ) {
			return $ports;
		}
		if ( ! is_string( $host ) || ! kg_headless_is_local_webhook_host( $host ) ) {
			return $ports;
		}
		$dev_ports = array( 3000, 3001 );
		$fe_port   = wp_parse_url( kg_headless_get_frontend_url(), PHP_URL_PORT );
		if ( is_int( $fe_port ) && $fe_port > 0 ) {
			$dev_ports[] = $fe_port;
		}
		foreach ( $dev_ports as $port ) {
			if ( ! in_array( $port, $ports, true ) ) {
				$ports[] = $port;
			}
		}
		return $ports;
	},
	10,
	2
);

add_filter(
	'woocommerce_webhook_deliver_async',
	static function ( mixed $async, mixed $webhook = null ): bool {
		if ( ! kg_headless_allows_local_webhooks() ) {
			return (bool) $async;
		}
		if ( $webhook instanceof \WC_Webhook ) {
			$host = wp_parse_url( $webhook->get_delivery_url(), PHP_URL_HOST );
			if ( is_string( $host ) && kg_headless_is_local_webhook_host( $host ) ) {
				return false;
			}
		}
		return (bool) $async;
	},
	10,
	2
);

