<?php
/**
 * Idempotens, brandenként paraméterezhető WP-CLI tesztadat-generáló szkript.
 *
 * Futtatás:
 *   KG_BRAND=gamer wp eval-file /var/www/seed/seed-brand.php
 *
 * Beállítja:
 * - Magyar pénznem (HUF, 0 tizedesjegy), ország (HU)
 * - HPOS (High-Performance Order Storage)
 * - Ingyenes házhozszállítás + BACS és COD fizetési módok (Store API checkout kompatibilisen)
 * - Kötelező jogi és alapoldalak (ÁSZF, Adatkezelési tájékoztató, Kapcsolat, Bolt, Kosár, Pénztár)
 * - Globális termékattribútumok (kapcsoló, szín, platform), címkék (kiemelt, ritkaság) és helyi termékképek
 * - Gamer tematikájú kategóriák és 12 db termék (köztük akciós, változatos/variable, előrendelhető, kevés készletű és kifogyott)
 * - WooCommerce webhookok (product.* és kategória action.*_product_cat) a Next.js revalidáláshoz
 *
 * @package KG_Headless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';

$brand        = strtolower( trim( (string) ( getenv( 'KG_BRAND' ) ?: 'gamer' ) ) );
$frontend_url = untrailingslashit( trim( (string) ( getenv( 'KG_FRONTEND_URL' ) ?: "http://{$brand}.localhost:3000" ) ) );

/**
 * Lokális frontend-host: loopback vagy `<brand>.localhost` aldomain (ADR-0014: a demo nem ilyen).
 */
function kg_seed_is_local_host( string $host ): bool {
	$host = strtolower( $host );
	return in_array( $host, array( 'localhost', '127.0.0.1' ), true ) || str_ends_with( $host, '.localhost' );
}

$fe_host_check = (string) ( wp_parse_url( $frontend_url, PHP_URL_HOST ) ?? '' );

// A seed felülírja a bolt beállításait és a jogi oldalakat: éles példányon soha nem fut.
if ( 'production' === wp_get_environment_type() ) {
	fwrite( STDERR, "[KGoblin Seed] HIBA: production környezetben (WP_ENVIRONMENT_TYPE) a seed nem futtatható.\n" );
	exit( 1 );
}

// A `kg_local_` titok nyilvános: csak teljesen lokális környezetben (lokális frontend és
// `WP_ENVIRONMENT_TYPE=local`) fogadható el, máshol (pl. demo) saját titok kötelező (ADR-0014). A setup-
// szkriptek mindig átadják az alapértelmezést, ezért az előtagot is vizsgáljuk, nem csak az üres értéket.
$seed_secret = trim( (string) getenv( 'KG_WEBHOOK_SECRET' ) );
$fully_local = kg_seed_is_local_host( $fe_host_check ) && 'local' === wp_get_environment_type();
if ( ! $fully_local && ( '' === $seed_secret || str_starts_with( $seed_secret, 'kg_local_' ) ) ) {
	fwrite( STDERR, "[KGoblin Seed] HIBA: nem lokális környezetben saját KG_WEBHOOK_SECRET kötelező (a kg_local_ alapérték nyilvános).\n" );
	exit( 1 );
}
$brand_upper  = strtoupper( preg_replace( '/[^a-z0-9]/i', '', $brand ) );
$sku_prefix   = 'gamer' === $brand ? 'KG-GMR' : 'KG-' . substr( $brand_upper, 0, 4 );
$shop_label   = 'gamer' === $brand ? 'KincsGoblin Gamer Webáruház' : 'KincsGoblin (' . ucfirst( $brand ) . ') Webáruház';

echo "=== [KGoblin Seed] Brand: {$brand} ({$shop_label}) | SKU prefix: {$sku_prefix} | Frontend: {$frontend_url} ===\n";

// 1. Alap WooCommerce és magyar pénznem beállítások
update_option( 'kg_headless_brand', $brand );
update_option( 'kg_headless_frontend_url', $frontend_url );
update_option( 'kg_headless_default_delivery_time', '1–3 munkanap' );
update_option( 'woocommerce_currency', 'HUF' );
update_option( 'woocommerce_currency_pos', 'right_space' );
update_option( 'woocommerce_price_thousand_sep', ' ' );
update_option( 'woocommerce_price_decimal_sep', ',' );
update_option( 'woocommerce_price_num_decimals', 0 );
update_option( 'woocommerce_default_country', 'HU' );
update_option( 'woocommerce_store_country', 'HU' );
update_option( 'woocommerce_store_address', 'Kossuth Lajos utca 12.' );
update_option( 'woocommerce_store_city', 'Budapest' );
update_option( 'woocommerce_store_postcode', '1053' );
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_store_pages_only', 'no' );
update_option( 'woocommerce_enable_guest_checkout', 'yes' );
update_option( 'woocommerce_notify_low_stock_amount', 2 );

// 2. HPOS (High-Performance Order Storage) biztonságos engedélyezése
update_option( 'woocommerce_feature_custom_orders_table_enabled', 'yes' );
if ( 'yes' !== get_option( 'woocommerce_custom_orders_table_enabled' ) ) {
	$legacy_orders = get_posts(
		array(
			'post_type'      => 'shop_order',
			'post_status'    => 'any',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);
	if ( ! empty( $legacy_orders ) ) {
		update_option( 'woocommerce_custom_orders_table_data_sync_enabled', 'yes' );
	}
	update_option( 'woocommerce_custom_orders_table_enabled', 'yes' );
}

// 3. Teszt fizetési módok (BACS és COD) aktiválása
$bacs_settings                 = get_option( 'woocommerce_bacs_settings', array() );
$bacs_settings['enabled']      = 'yes';
$bacs_settings['title']        = 'Előre utalás (Banki átutalás)';
$bacs_settings['description']  = 'A megrendelés végösszegét bankszámlánkra történő átutalással egyenlítheted ki.';
$bacs_settings['instructions'] = 'Kérjük, a közlemény rovatban tüntesd fel a rendelési számodat!';
update_option( 'woocommerce_bacs_settings', $bacs_settings );

$cod_settings                       = get_option( 'woocommerce_cod_settings', array() );
$cod_settings['enabled']            = 'yes';
$cod_settings['title']              = 'Utánvétes fizetés a futárnál';
$cod_settings['description']        = 'Fizetés készpénzzel vagy bankkártyával közvetlenül a futárnak az átvételkor.';
$cod_settings['instructions']       = 'Készpénzzel és bankkártyával is fizethetsz a futárnál.';
$cod_settings['enable_for_virtual'] = 'yes';
update_option( 'woocommerce_cod_settings', $cod_settings );

// 4. Szállítási zóna és módok biztosítása (Magyarország: házhozszállítás, csomagautomata, ingyenes szállítás 25 000 Ft felett)
if ( class_exists( 'WC_Shipping_Zones' ) ) {
	$hu_zone_name = 'Magyarország';
	$hu_zone      = null;
	foreach ( \WC_Shipping_Zones::get_zones() as $zone_data ) {
		if ( isset( $zone_data['zone_name'] ) && $hu_zone_name === $zone_data['zone_name'] ) {
			$hu_zone = new \WC_Shipping_Zone( (int) $zone_data['id'] );
			break;
		}
	}

	if ( ! $hu_zone ) {
		$hu_zone = new \WC_Shipping_Zone();
		$hu_zone->set_zone_name( $hu_zone_name );
		$hu_zone->set_zone_order( 0 );
		$hu_zone->add_location( 'HU', 'country' );
		$hu_zone->save();
		echo "Magyarország szállítási zóna létrehozva (#{$hu_zone->get_id()}).\n";
	}

	$existing_hu_methods = array();
	foreach ( $hu_zone->get_shipping_methods( false ) as $method ) {
		$existing_hu_methods[ $method->id ] = $method;
	}

	$flat_instance_id = isset( $existing_hu_methods['flat_rate'] )
		? (int) $existing_hu_methods['flat_rate']->instance_id
		: (int) $hu_zone->add_shipping_method( 'flat_rate' );
	update_option(
		"woocommerce_flat_rate_{$flat_instance_id}_settings",
		array(
			'title'      => 'Házhozszállítás (GLS)',
			'tax_status' => 'none',
			'cost'       => '1490',
		)
	);
	echo "Szállítási mód szinkronizálva: Házhozszállítás (GLS) 1 490 Ft (#{$flat_instance_id}).\n";

	$pickup_instance_id = isset( $existing_hu_methods['local_pickup'] )
		? (int) $existing_hu_methods['local_pickup']->instance_id
		: (int) $hu_zone->add_shipping_method( 'local_pickup' );
	update_option(
		"woocommerce_local_pickup_{$pickup_instance_id}_settings",
		array(
			'title'      => 'Csomagautomata',
			'tax_status' => 'none',
			'cost'       => '990',
		)
	);
	echo "Szállítási mód szinkronizálva: Csomagautomata 990 Ft (#{$pickup_instance_id}).\n";

	$free_instance_id = isset( $existing_hu_methods['free_shipping'] )
		? (int) $existing_hu_methods['free_shipping']->instance_id
		: (int) $hu_zone->add_shipping_method( 'free_shipping' );
	update_option(
		"woocommerce_free_shipping_{$free_instance_id}_settings",
		array(
			'title'            => 'Ingyenes szállítás',
			'requires'         => 'min_amount',
			'min_amount'       => '25000',
			'ignore_discounts' => 'no',
		)
	);
	echo "Szállítási mód szinkronizálva: Ingyenes szállítás 25 000 Ft felett (#{$free_instance_id}).\n";

	// Fallback zóna (0): külföldi (EU) kosarakhoz egységes futárdíj, egyezve a fixture-rel.
	$default_zone         = new \WC_Shipping_Zone( 0 );
	$existing_def_methods = array();
	foreach ( $default_zone->get_shipping_methods( false ) as $method ) {
		$existing_def_methods[ $method->id ] = $method;
	}
	$eu_flat_instance_id = isset( $existing_def_methods['flat_rate'] )
		? (int) $existing_def_methods['flat_rate']->instance_id
		: (int) $default_zone->add_shipping_method( 'flat_rate' );
	update_option(
		"woocommerce_flat_rate_{$eu_flat_instance_id}_settings",
		array(
			'title'      => 'Nemzetközi futárszolgálat (EU)',
			'tax_status' => 'none',
			'cost'       => '3990',
		)
	);
	echo "Fallback szállítási mód szinkronizálva: Nemzetközi futárszolgálat (EU) 3 990 Ft (#{$eu_flat_instance_id}).\n";
}

// 4b. Kuponok engedélyezése és teszt kupon (GOBLIN10, 10% kedvezmény) idempotens létrehozása (KG-12)
update_option( 'woocommerce_enable_coupons', 'yes' );
if ( class_exists( 'WC_Coupon' ) && function_exists( 'wc_get_coupon_id_by_code' ) ) {
	$coupon_code = 'GOBLIN10';
	$coupon_id   = wc_get_coupon_id_by_code( $coupon_code );
	$coupon      = $coupon_id ? new \WC_Coupon( $coupon_id ) : new \WC_Coupon();
	$coupon->set_code( $coupon_code );
	$coupon->set_discount_type( 'percent' );
	$coupon->set_amount( 10 );
	$coupon->set_description( 'KGoblin teszt kupon: 10% kedvezmény a kosárra.' );
	$coupon->set_individual_use( false );
	$coupon->set_free_shipping( false );
	$saved_coupon_id = $coupon->save();
	echo "Teszt kupon kész: {$coupon_code} (10%, #{$saved_coupon_id}).\n";
}

// 5. Jogi és WooCommerce alapoldalak létrehozása (idempotensen)
$pages_config = array(
	'bolt'                     => array(
		'title'   => 'Bolt',
		'content' => '',
		'option'  => 'woocommerce_shop_page_id',
	),
	'kosar'                    => array(
		'title'   => 'Kosár',
		'content' => '<!-- wp:woocommerce/cart /-->',
		'option'  => 'woocommerce_cart_page_id',
	),
	'penztar'                  => array(
		'title'   => 'Pénztár',
		'content' => '<!-- wp:woocommerce/checkout /-->',
		'option'  => 'woocommerce_checkout_page_id',
	),
	'fiokom'                   => array(
		'title'   => 'Fiókom',
		'content' => '[woocommerce_my_account]',
		'option'  => 'woocommerce_myaccount_page_id',
	),
	'aszf'                     => array(
		'title'   => 'Általános Szerződési Feltételek (ÁSZF)',
		'content' => "<h2>Általános Szerződési Feltételek</h2><p>Jelen ÁSZF a {$shop_label} (Üzemeltető: KincsGoblin Kft., 1053 Budapest, Kossuth Lajos utca 12., Adószám: 12345678-2-42) által nyújtott elektronikus kereskedelmi szolgáltatásokat igénybe vevő Vásárló jogait és kötelezettségeit szabályozza.</p><h3>1. Elállási jog</h3><p>A fogyasztót a 45/2014. (II. 26.) Korm. rendelet alapján 14 napos indokolás nélküli elállási jog illeti meg.</p><h3>2. Jótállás és kellékszavatosság</h3><p>Minden tartós fogyasztási cikkre (perifériák, hardverek) a hatályos magyar jogszályok szerinti kötelező jótállást biztosítunk.</p>",
		'option'  => 'woocommerce_terms_page_id',
	),
	'adatkezelesi-tajekoztato' => array(
		'title'   => 'Adatkezelési tájékoztató',
		'content' => '<h2>Adatkezelési tájékoztató (GDPR)</h2><p>A KincsGoblin Kft. a megrendelések teljesítése, számlázás és kiszállítás céljából kezeli a Vásárlók személyes adatait az EU 2016/679 rendelete (GDPR) és az Infotv. előírásainak megfelelően.</p>',
		'option'  => 'wp_page_for_privacy_policy',
	),
	'elallasi-tajekoztato'     => array(
		'title'   => 'Elállási tájékoztató',
		'content' => '<h2>Elállási jog gyakorlásának menete</h2><p>A fogyasztó a termék kézhezvételétől számított 14 napon belül jogosult indokolás nélkül elállni a szerződéstől.</p>',
		'option'  => '',
	),
);

foreach ( $pages_config as $slug => $page_data ) {
	$existing = get_page_by_path( $slug, OBJECT, 'page' );
	if ( $existing ) {
		wp_update_post(
			array(
				'ID'           => $existing->ID,
				'post_title'   => $page_data['title'],
				'post_content' => $page_data['content'],
				'post_status'  => 'publish',
			)
		);
		$page_id = (int) $existing->ID;
	} else {
		$page_id = (int) wp_insert_post(
			array(
				'post_title'   => $page_data['title'],
				'post_name'    => $slug,
				'post_content' => $page_data['content'],
				'post_status'  => 'publish',
				'post_type'    => 'page',
			)
		);
	}

	if ( '' !== $page_data['option'] && $page_id > 0 ) {
		update_option( $page_data['option'], $page_id );
	}
	echo "Oldal szinkronizálva: {$page_data['title']} (#{$page_id})\n";
}

// 6. Helyi PNG termékképek generálása és csatolása a WordPress médiatárba (idempotensen)
function kg_seed_ensure_image( string $asset_key, string $title, string $alt, array $bg_rgb, array $accent_rgb, string $shape = 'diamond' ): int {
	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_kg_seed_asset',
			'meta_value'     => $asset_key,
		)
	);
	if ( ! empty( $existing ) ) {
		$att_id = (int) $existing[0];
		update_post_meta( $att_id, '_wp_attachment_image_alt', $alt );
		return $att_id;
	}

	if ( ! function_exists( 'imagecreatetruecolor' ) ) {
		return 0;
	}

	$upload_dir = wp_upload_dir();
	$seed_dir   = trailingslashit( $upload_dir['basedir'] ) . 'kg-seed';
	if ( ! file_exists( $seed_dir ) ) {
		wp_mkdir_p( $seed_dir );
	}

	$filename = sanitize_file_name( $asset_key ) . '.png';
	$filepath = trailingslashit( $seed_dir ) . $filename;

	$size = 800;
	$im   = imagecreatetruecolor( $size, $size );
	imagesavealpha( $im, true );

	// Sötét háttérátmenet
	for ( $y = 0; $y < $size; $y++ ) {
		$ratio = $y / $size;
		$r     = (int) max( 0, min( 255, $bg_rgb[0] * ( 1 - $ratio * 0.35 ) ) );
		$g     = (int) max( 0, min( 255, $bg_rgb[1] * ( 1 - $ratio * 0.35 ) ) );
		$b     = (int) max( 0, min( 255, $bg_rgb[2] * ( 1 - $ratio * 0.35 ) ) );
		$col   = imagecolorallocate( $im, $r, $g, $b );
		imageline( $im, 0, $y, $size, $y, $col );
	}

	// Finom keret és belső ragyogás
	$gold_border = imagecolorallocatealpha( $im, $accent_rgb[0], $accent_rgb[1], $accent_rgb[2], 30 );
	$glow_soft   = imagecolorallocatealpha( $im, $accent_rgb[0], $accent_rgb[1], $accent_rgb[2], 102 );
	$accent_fill = imagecolorallocatealpha( $im, $accent_rgb[0], $accent_rgb[1], $accent_rgb[2], 18 );
	$dark_core   = imagecolorallocatealpha( $im, 20, 16, 14, 24 );

	imagerectangle( $im, 28, 28, $size - 29, $size - 29, $gold_border );
	imagerectangle( $im, 36, 36, $size - 37, $size - 37, $glow_soft );

	// Központi fénykör
	for ( $radius = 300; $radius >= 120; $radius -= 28 ) {
		imagefilledellipse( $im, 400, 400, $radius * 2, $radius * 2, $glow_soft );
	}

	// Geometrikus alakzat a terméktípus szerint
	if ( 'hex' === $shape ) {
		$pts = array();
		for ( $i = 0; $i < 6; $i++ ) {
			$angle = deg2rad( 60 * $i - 30 );
			$pts[] = (int) ( 400 + cos( $angle ) * 195 );
			$pts[] = (int) ( 400 + sin( $angle ) * 195 );
		}
		imagefilledpolygon( $im, $pts, $accent_fill );
		$inner = array();
		for ( $i = 0; $i < 6; $i++ ) {
			$angle   = deg2rad( 60 * $i - 30 );
			$inner[] = (int) ( 400 + cos( $angle ) * 145 );
			$inner[] = (int) ( 400 + sin( $angle ) * 145 );
		}
		imagefilledpolygon( $im, $inner, $dark_core );
	} elseif ( 'ring' === $shape ) {
		imagefilledellipse( $im, 400, 400, 390, 390, $accent_fill );
		imagefilledellipse( $im, 400, 400, 270, 270, $dark_core );
		imagefilledellipse( $im, 400, 400, 120, 120, $accent_fill );
	} else {
		$pts = array( 400, 180, 610, 400, 400, 620, 190, 400 );
		imagefilledpolygon( $im, $pts, $accent_fill );
		$inner = array( 400, 255, 535, 400, 400, 545, 265, 400 );
		imagefilledpolygon( $im, $inner, $dark_core );
	}

	imagepng( $im, $filepath );
	imagedestroy( $im );

	$attachment_id = wp_insert_attachment(
		array(
			'guid'           => trailingslashit( $upload_dir['baseurl'] ) . 'kg-seed/' . $filename,
			'post_mime_type' => 'image/png',
			'post_title'     => $title,
			'post_content'   => '',
			'post_status'    => 'inherit',
		),
		$filepath
	);

	if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
		return 0;
	}

	$attach_data = wp_generate_attachment_metadata( $attachment_id, $filepath );
	wp_update_attachment_metadata( $attachment_id, $attach_data );
	update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt );
	update_post_meta( $attachment_id, '_kg_seed_asset', $asset_key );

	return (int) $attachment_id;
}

$seed_images = array(
	'kb-main'      => kg_seed_ensure_image( 'kb-main', 'ApexStrike Pro 75% Billentyűzet', 'ApexStrike Pro 75% mechanikus gamer billentyűzet', array( 42, 33, 28 ), array( 224, 174, 72 ), 'hex' ),
	'kb-alt'       => kg_seed_ensure_image( 'kb-alt', 'ApexStrike Pro 75% Részlet', 'ApexStrike Pro PBT kupakok és háttérvilágítás', array( 34, 40, 52 ), array( 116, 178, 245 ), 'diamond' ),
	'mouse-main'   => kg_seed_ensure_image( 'mouse-main', 'PhantomGlide Esport Egér', 'PhantomGlide Ultralight 54g vezeték nélküli gamer egér', array( 30, 38, 48 ), array( 96, 182, 240 ), 'diamond' ),
	'mouse-alt'    => kg_seed_ensure_image( 'mouse-alt', 'PhantomGlide Talpak', 'PhantomGlide PTFE talpak és PAW3395 szenzor', array( 44, 34, 30 ), array( 232, 180, 82 ), 'ring' ),
	'headset-main' => kg_seed_ensure_image( 'headset-main', 'NovaPulse Headset', 'NovaPulse 7.1 vezeték nélküli gamer headset', array( 42, 28, 48 ), array( 192, 114, 242 ), 'ring' ),
	'headset-alt'  => kg_seed_ensure_image( 'headset-alt', 'NovaPulse Mikrofon', 'NovaPulse levehető zajszűrős mikrofon', array( 34, 32, 42 ), array( 224, 174, 72 ), 'hex' ),
	'mic-main'     => kg_seed_ensure_image( 'mic-main', 'VoxCaster Mikrofon', 'VoxCaster Studio USB/XLR podcast mikrofon', array( 48, 30, 28 ), array( 235, 118, 92 ), 'ring' ),
	'cam-main'     => kg_seed_ensure_image( 'cam-main', 'ClearStream Webkamera', 'ClearStream 4K60 HDR webkamera Sony STARVIS szenzorral', array( 28, 42, 46 ), array( 94, 204, 184 ), 'hex' ),
	'pad-main'     => kg_seed_ensure_image( 'pad-main', 'TitanWeave Egérpad', 'TitanWeave XXL Control gamer egérpad', array( 40, 36, 30 ), array( 214, 166, 76 ), 'diamond' ),
	'arm-main'     => kg_seed_ensure_image( 'arm-main', 'AeroLift Monitorkar', 'AeroLift gázrugós alumínium monitortartó kar', array( 36, 40, 44 ), array( 168, 188, 206 ), 'hex' ),
	'lamp-main'    => kg_seed_ensure_image( 'lamp-main', 'LumiBar Monitor Lámpa', 'LumiBar Pro aszimmetrikus monitor lámpa koronggal', array( 46, 38, 26 ), array( 245, 198, 92 ), 'ring' ),
	'var-black'    => kg_seed_ensure_image( 'var-black', 'RunaKard Obszidián', 'RunaKard TKL Pro Obszidián Fekete változat', array( 26, 26, 30 ), array( 218, 86, 86 ), 'hex' ),
	'var-gold'     => kg_seed_ensure_image( 'var-gold', 'RunaKard Goblin Arany', 'RunaKard TKL Pro Goblin Arany változat', array( 54, 40, 22 ), array( 244, 194, 74 ), 'hex' ),
	'var-white'    => kg_seed_ensure_image( 'var-white', 'RunaKard Holdfény Fehér', 'RunaKard TKL Pro Holdfény Fehér változat', array( 56, 62, 74 ), array( 152, 212, 250 ), 'hex' ),
	'ctrl-pre'     => kg_seed_ensure_image( 'ctrl-pre', 'Sárkánypikkely Kontroller', 'Sárkánypikkely vezeték nélküli kontroller limitált kiadás', array( 52, 32, 22 ), array( 245, 146, 62 ), 'diamond' ),
	'deck-low'     => kg_seed_ensure_image( 'deck-low', 'Mágus Stream Deck', 'Mágus Stream Deck Mini 6 gombos vezérlő', array( 38, 28, 52 ), array( 176, 118, 245 ), 'hex' ),
);

// 7. Globális WooCommerce attribútumok és kifejezések
function kg_seed_ensure_attribute( string $slug, string $label, array $terms ): array {
	$taxonomy = wc_attribute_taxonomy_name( $slug );
	$attr_id  = wc_attribute_taxonomy_id_by_name( $taxonomy );

	if ( ! $attr_id ) {
		$attr_id = wc_create_attribute(
			array(
				'name'         => $label,
				'slug'         => $slug,
				'type'         => 'select',
				'order_by'     => 'menu_order',
				'has_archives' => false,
			)
		);
		if ( is_wp_error( $attr_id ) ) {
			echo 'Attribútum hiba (' . $slug . '): ' . $attr_id->get_error_message() . "\n";
			return array();
		}
		register_taxonomy(
			$taxonomy,
			array( 'product' ),
			array(
				'hierarchical' => false,
				'show_ui'      => true,
				'query_var'    => true,
				'rewrite'      => false,
			)
		);
	}

	if ( ! taxonomy_exists( $taxonomy ) ) {
		register_taxonomy(
			$taxonomy,
			array( 'product' ),
			array(
				'hierarchical' => false,
				'show_ui'      => true,
				'query_var'    => true,
				'rewrite'      => false,
			)
		);
	}

	$term_ids = array();
	foreach ( $terms as $term_slug => $term_name ) {
		$existing = term_exists( $term_slug, $taxonomy );
		if ( ! $existing ) {
			$created = wp_insert_term( $term_name, $taxonomy, array( 'slug' => $term_slug ) );
			if ( ! is_wp_error( $created ) ) {
				$term_ids[ $term_slug ] = (int) $created['term_id'];
			}
		} else {
			$tid = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
			wp_update_term( $tid, $taxonomy, array( 'name' => $term_name ) );
			$term_ids[ $term_slug ] = $tid;
		}
	}

	echo "Attribútum kész: {$taxonomy} (#{$attr_id}) [" . implode( ', ', array_keys( $term_ids ) ) . "]\n";
	return array(
		'id'       => (int) $attr_id,
		'taxonomy' => $taxonomy,
		'terms'    => $term_ids,
	);
}

$attributes_map = array(
	'kapcsolo' => kg_seed_ensure_attribute(
		'kapcsolo',
		'Kapcsoló',
		array(
			'linearis-red'  => 'Lineáris Red',
			'taktilis-brown' => 'Taktilis Brown',
		)
	),
	'szin'     => kg_seed_ensure_attribute(
		'szin',
		'Szín',
		array(
			'obszidian-fekete' => 'Obszidián Fekete',
			'goblin-arany'     => 'Goblin Arany',
			'holdfeny-feher'   => 'Holdfény Fehér',
		)
	),
	'platform' => kg_seed_ensure_attribute(
		'platform',
		'Platform',
		array(
			'pc-mac'      => 'PC / Mac',
			'ps5-konzol'  => 'PS5 / Konzol',
		)
	),
);

delete_transient( 'wc_attribute_taxonomies' );

// 8. Termékcímkék (kiemelt + ritkaság)
$tags_data = array(
	'kiemelt'            => 'Kiemelt',
	'ritkasag-gyakori'   => 'Gyakori',
	'ritkasag-ritka'     => 'Ritka',
	'ritkasag-epikus'    => 'Epikus',
	'ritkasag-legendas'  => 'Legendás',
);
$tag_ids = array();
foreach ( $tags_data as $tag_slug => $tag_name ) {
	$existing = term_exists( $tag_slug, 'product_tag' );
	if ( ! $existing ) {
		$created = wp_insert_term( $tag_name, 'product_tag', array( 'slug' => $tag_slug ) );
		if ( ! is_wp_error( $created ) ) {
			$tag_ids[ $tag_slug ] = (int) $created['term_id'];
		}
	} else {
		$tid = is_array( $existing ) ? (int) $existing['term_id'] : (int) $existing;
		wp_update_term( $tid, 'product_tag', array( 'name' => $tag_name ) );
		$tag_ids[ $tag_slug ] = $tid;
	}
}

// 9. Gamer tematikájú termékkategóriák
$categories_data = array(
	'gamer-periferiak'         => array(
		'name'        => 'Gamer Perifériák',
		'description' => 'Mechanikus billentyűzetek, ultrakönnyű esport egerek és stúdiószintű gamer headsetek.',
	),
	'streaming-es-audio'       => array(
		'name'        => 'Streaming és Audio',
		'description' => 'USB/XLR kondenzátor mikrofonok, stream deck vezérlők és webkamerák tartalomgyártóknak.',
	),
	'ergonomia-es-kiegeszitok' => array(
		'name'        => 'Ergonómia és Asztali Kiegészítők',
		'description' => 'Prémium XXL egérpadok, monitorállványok, csuklótámaszok és RGB háttérvilágítás.',
	),
	'gyujtoi-kiadasok'         => array(
		'name'        => 'Gyűjtői Kiadások',
		'description' => 'Testreszabható kiemelt billentyűzet-változatok és limitált szériás kontrollerek.',
	),
);

$category_ids = array();
foreach ( $categories_data as $slug => $cat_info ) {
	$term = term_exists( $slug, 'product_cat' );
	if ( ! $term ) {
		$term = wp_insert_term(
			$cat_info['name'],
			'product_cat',
			array(
				'slug'        => $slug,
				'description' => $cat_info['description'],
			)
		);
	} else {
		$tid = is_array( $term ) ? (int) $term['term_id'] : (int) $term;
		wp_update_term(
			$tid,
			'product_cat',
			array(
				'name'        => $cat_info['name'],
				'description' => $cat_info['description'],
			)
		);
	}

	if ( ! is_wp_error( $term ) ) {
		$category_ids[ $slug ] = is_array( $term ) ? (int) $term['term_id'] : (int) $term;
		echo "Kategória kész: {$cat_info['name']} (#{$category_ids[$slug]})\n";
	}
}

function kg_seed_assign_simple_attributes( \WC_Product $product, array $attr_specs, array $attributes_map ): void {
	$wc_attrs = array();
	$position = 0;
	foreach ( $attr_specs as $attr_key => $term_slugs ) {
		if ( ! isset( $attributes_map[ $attr_key ] ) ) {
			continue;
		}
		$meta     = $attributes_map[ $attr_key ];
		$taxonomy = $meta['taxonomy'];
		$options  = array();
		foreach ( $term_slugs as $slug ) {
			if ( isset( $meta['terms'][ $slug ] ) ) {
				$options[] = $meta['terms'][ $slug ];
			}
		}
		if ( empty( $options ) ) {
			continue;
		}
		$attr = new \WC_Product_Attribute();
		$attr->set_id( $meta['id'] );
		$attr->set_name( $taxonomy );
		$attr->set_options( $options );
		$attr->set_position( $position++ );
		$attr->set_visible( true );
		$attr->set_variation( false );
		$wc_attrs[] = $attr;
	}
	$product->set_attributes( $wc_attrs );
}

// 10. Egyszerű teszttermékek (a meglévő 8 SKU megtartásával + 3 új készletállapot/szállítási idő teszttermék)
$products_data = array(
	array(
		'sku'               => $sku_prefix . '-KB-001',
		'name'              => 'ApexStrike Pro 75% Hot-Swap Mechanikus Gamer Billentyűzet (Lineáris Red)',
		'regular_price'     => 44990,
		'sale_price'        => 36990,
		'prior_lowest_30'   => 34990,
		'stock'             => 25,
		'stock_status'      => 'instock',
		'cat'               => 'gamer-periferiak',
		'featured'          => true,
		'menu_order'        => 1,
		'tags'              => array( 'kiemelt', 'ritkasag-epikus' ),
		'attrs'             => array( 'kapcsolo' => array( 'linearis-red' ), 'platform' => array( 'pc-mac' ) ),
		'images'            => array( 'kb-main', 'kb-alt' ),
		'delivery_time'     => '1–2 munkanap',
		'short_description' => 'Gasket-mount alumínium házas 75%-os mechanikus billentyűzet előre kent kapcsolókkal és PBT kupakokkal.',
		'description'       => 'Az ApexStrike Pro 75% kifejezetten kompetitív játékosoknak készült: 1000 Hz lekérdezési frekvencia, 5-tűs hot-swap NYÁK, hangelnyelő szilikon rétegek és teljes QMK/VIA programozhatóság.',
	),
	array(
		'sku'               => $sku_prefix . '-MS-002',
		'name'              => 'PhantomGlide Ultralight 54g Vezeték Nélküli Esport Egér (PAW3395)',
		'regular_price'     => 32990,
		'sale_price'        => 27990,
		'prior_lowest_30'   => 32990,
		'stock'             => 40,
		'stock_status'      => 'instock',
		'cat'               => 'gamer-periferiak',
		'featured'          => true,
		'menu_order'        => 2,
		'tags'              => array( 'kiemelt', 'ritkasag-ritka' ),
		'attrs'             => array( 'szin' => array( 'obszidian-fekete' ), 'platform' => array( 'pc-mac' ) ),
		'images'            => array( 'mouse-main', 'mouse-alt' ),
		'delivery_time'     => '1–2 munkanap',
		'short_description' => 'Pehelykönnyű, lyukmentes szimmetrikus esport egér 26 000 DPI-s PixArt PAW3395 szenzorral.',
		'description'       => 'Lag-mentes 2.4 GHz-es vezeték nélküli kapcsolat, akár 80 órás akkumulátor-üzemidő, 100% PTFE talpak és optikai főkapcsolók a dupla kattintás elkerüléséért.',
	),
	array(
		'sku'               => $sku_prefix . '-HS-003',
		'name'              => 'NovaPulse 7.1 Wireless Gamer Headset Levehető Zajszűrős Mikrofonnal',
		'regular_price'     => 38990,
		'sale_price'        => null,
		'prior_lowest_30'   => 38990,
		'stock'             => 18,
		'stock_status'      => 'instock',
		'cat'               => 'gamer-periferiak',
		'featured'          => false,
		'menu_order'        => 3,
		'tags'              => array( 'ritkasag-epikus' ),
		'attrs'             => array( 'platform' => array( 'pc-mac', 'ps5-konzol' ) ),
		'images'            => array( 'headset-main', 'headset-alt' ),
		'delivery_time'     => '1–3 munkanap',
		'short_description' => '50 mm-es neodímium hangszórók, memóriahabos hűsítő fülpárnák és PC/PS5/Switch kompatibilitás.',
		'description'       => 'Kristálytiszta térbeli lépéshangok és kényelmes, egész napos viselet. USB-C dongle alacsony késleltetéssel és Bluetooth 5.3 kettős csatlakozással.',
	),
	array(
		'sku'               => $sku_prefix . '-MC-004',
		'name'              => 'VoxCaster Studio USB/XLR Dinamikus Podcast és Streaming Mikrofon',
		'regular_price'     => 49990,
		'sale_price'        => 39990,
		'prior_lowest_30'   => 37990,
		'stock'             => 12,
		'stock_status'      => 'instock',
		'cat'               => 'streaming-es-audio',
		'featured'          => true,
		'menu_order'        => 4,
		'tags'              => array( 'kiemelt', 'ritkasag-epikus' ),
		'attrs'             => array( 'platform' => array( 'pc-mac' ) ),
		'images'            => array( 'mic-main' ),
		'delivery_time'     => '1–3 munkanap',
		'short_description' => 'Kardioid karakterisztikájú dinamikus mikrofon beépített pop-filterrel és rezgéscsillapító kengyellel.',
		'description'       => 'Kizárja a mechanikus billentyűzet kattogását és a szobai visszhangot. Plug-and-play USB-C mód kezdőknek, és professzionális XLR kimenet audio interfészhez.',
	),
	array(
		'sku'               => $sku_prefix . '-CM-005',
		'name'              => 'ClearStream 4K60 HDR Webkamera Sony STARVIS Szenzorral',
		'regular_price'     => 54990,
		'sale_price'        => null,
		'prior_lowest_30'   => 54990,
		'stock'             => 15,
		'stock_status'      => 'instock',
		'cat'               => 'streaming-es-audio',
		'featured'          => false,
		'menu_order'        => 5,
		'tags'              => array( 'ritkasag-legendas' ),
		'attrs'             => array( 'platform' => array( 'pc-mac' ) ),
		'images'            => array( 'cam-main' ),
		'delivery_time'     => '2–4 munkanap',
		'short_description' => 'Valódi 4K felbontás vagy 1080p 60 FPS gyenge fényviszonyok mellett is, beépített lencsefedéllel.',
		'description'       => 'Villámgyors PDAF autofókusz, f/1.8 rekeszértékű üveglencse a természetes háttérelmosásért, és mágneses adatvédelmi kupak.',
	),
	array(
		'sku'               => $sku_prefix . '-PD-006',
		'name'              => 'TitanWeave XXL Control Gamer Egérpad (900×400×4 mm, Varrt Szélű)',
		'regular_price'     => 11990,
		'sale_price'        => 8990,
		'prior_lowest_30'   => 8990,
		'stock'             => 60,
		'stock_status'      => 'instock',
		'cat'               => 'ergonomia-es-kiegeszitok',
		'featured'          => false,
		'menu_order'        => 6,
		'tags'              => array( 'ritkasag-gyakori' ),
		'attrs'             => array( 'szin' => array( 'obszidian-fekete' ) ),
		'images'            => array( 'pad-main' ),
		'delivery_time'     => '1–2 munkanap',
		'short_description' => 'Vízlepergető mikroszövésű felület precíz célzáshoz és csúszásmentes natúrgumi alap.',
		'description'       => 'Süllyesztett, dörzsölődésmentes szegélyvarrás és 4 mm vastag rezgéscsillapító alap, amely egyszerre ad helyet a billentyűzetnek és a széles egérmozdulatoknak.',
	),
	array(
		'sku'               => $sku_prefix . '-AR-007',
		'name'              => 'AeroLift Gázrugós Alumínium Monitortartó Kar (17"–34" Ultrawide, 12 kg-ig)',
		'regular_price'     => 26990,
		'sale_price'        => null,
		'prior_lowest_30'   => 26990,
		'stock'             => 22,
		'stock_status'      => 'instock',
		'cat'               => 'ergonomia-es-kiegeszitok',
		'featured'          => false,
		'menu_order'        => 7,
		'tags'              => array( 'ritkasag-ritka' ),
		'attrs'             => array( 'szin' => array( 'obszidian-fekete' ) ),
		'images'            => array( 'arm-main' ),
		'delivery_time'     => '1–3 munkanap',
		'short_description' => 'Teljes 360°-os forgathatóság, rejtett kábelvezető csatorna és VESA 75×75 / 100×100 gyorscsatlakozó.',
		'description'       => 'Szabadítsd fel az asztalodat és állítsd szemmagasságba a monitorodat! Bilincses és átmenő furatos rögzítőelemekkel a csomagban.',
	),
	array(
		'sku'               => $sku_prefix . '-LT-008',
		'name'              => 'LumiBar Pro Aszimmetrikus Monitor Lámpa Vezeték Nélküli Vezérlőkoronggal',
		'regular_price'     => 21990,
		'sale_price'        => 16990,
		'prior_lowest_30'   => 15990,
		'stock'             => 30,
		'stock_status'      => 'instock',
		'cat'               => 'ergonomia-es-kiegeszitok',
		'featured'          => false,
		'menu_order'        => 8,
		'tags'              => array( 'ritkasag-ritka' ),
		'attrs'             => array( 'szin' => array( 'goblin-arany' ) ),
		'images'            => array( 'lamp-main' ),
		'delivery_time'     => '1–2 munkanap',
		'short_description' => 'Tükröződésmentes asztali megvilágítás (CRI > 95) állítható színhőmérséklettel (2700K–6500K).',
		'description'       => 'Az aszimmetrikus optikai kialakítás csak az íróasztalt világítja meg, a monitor képernyőjén nem okoz becsillanást. Éjszakai játékhoz és munkához elengedhetetlen.',
	),
	array(
		'sku'               => $sku_prefix . '-PRE-010',
		'name'              => 'Sárkánypikkely Vezeték Nélküli Kontroller – Limitált Széria',
		'regular_price'     => 59990,
		'sale_price'        => null,
		'prior_lowest_30'   => 59990,
		'stock'             => null,
		'stock_status'      => 'onbackorder',
		'manage_stock'      => false,
		'cat'               => 'gyujtoi-kiadasok',
		'featured'          => true,
		'menu_order'        => 10,
		'tags'              => array( 'kiemelt', 'ritkasag-legendas' ),
		'attrs'             => array( 'platform' => array( 'ps5-konzol', 'pc-mac' ), 'szin' => array( 'goblin-arany' ) ),
		'images'            => array( 'ctrl-pre' ),
		'delivery_time'     => 'Előrendelhető – várható érkezés: 5–7 munkanap',
		'short_description' => 'Hall-effektusos analóg karokkal és gravírozott pikkelymintás markolattal szerelt gyűjtői kontroller.',
		'description'       => 'Driftmentes mágneses szenzorok, 4 programozható hátlap-billentyű és aranyozott ravaszstopok. Az első szállítmány előrendeléssel foglalható.',
	),
	array(
		'sku'               => $sku_prefix . '-LOW-012',
		'name'              => 'Mágus Stream Deck Mini 6 Gombos Vezérlőpult',
		'regular_price'     => 28990,
		'sale_price'        => null,
		'prior_lowest_30'   => 28990,
		'stock'             => 2,
		'stock_status'      => 'instock',
		'cat'               => 'streaming-es-audio',
		'featured'          => false,
		'menu_order'        => 11,
		'tags'              => array( 'ritkasag-ritka' ),
		'attrs'             => array( 'platform' => array( 'pc-mac' ) ),
		'images'            => array( 'deck-low' ),
		'supplier_delivery' => 'Beszállítói raktárból: 2–4 munkanap',
		'short_description' => '6 programozható LCD-gomb az OBS jelenetek, hanghatások és makrók azonnali indításához.',
		'description'       => 'Kompakt asztali vezérlő élő közvetítésekhez és produktív munkafolyamatokhoz. Csak néhány darab maradt az aktuális készletből.',
	),
	array(
		'sku'               => $sku_prefix . '-OOS-011',
		'name'              => 'Goblin Árnyék Kékfényszűrő Szemüveg (Kifutott Kiadás)',
		'regular_price'     => 14990,
		'sale_price'        => null,
		'prior_lowest_30'   => 14990,
		'stock'             => 0,
		'stock_status'      => 'outofstock',
		'cat'               => 'ergonomia-es-kiegeszitok',
		'featured'          => false,
		'menu_order'        => 12,
		'tags'              => array( 'ritkasag-gyakori' ),
		'attrs'             => array(),
		'images'            => array(), // Szándékosan kép nélküli: placeholder teszteléséhez (KG-47)
		'delivery_time'     => '',
		'short_description' => 'Pehelykönnyű TR90 keret kékfény-szűrő lencsével éjszakai maratonokhoz.',
		'description'       => 'Kifutott szezonális széria; jelenleg nem rendelhető.',
	),
);

$now         = time();
$day_seconds = defined( 'DAY_IN_SECONDS' ) ? (int) DAY_IN_SECONDS : 86400;

foreach ( $products_data as $item ) {
	$existing_id = wc_get_product_id_by_sku( $item['sku'] );
	$product     = $existing_id ? wc_get_product( $existing_id ) : new \WC_Product_Simple();

	$product->set_name( $item['name'] );
	$product->set_sku( $item['sku'] );
	$product->set_status( 'publish' );
	$product->set_catalog_visibility( 'visible' );
	$product->set_featured( ! empty( $item['featured'] ) );
	$product->set_menu_order( (int) ( $item['menu_order'] ?? 0 ) );
	$product->set_description( $item['description'] );
	$product->set_short_description( $item['short_description'] );
	$product->set_regular_price( (string) $item['regular_price'] );

	$is_sale = null !== $item['sale_price'] && $item['sale_price'] < $item['regular_price'];
	if ( $is_sale ) {
		$product->set_sale_price( (string) $item['sale_price'] );
		$product->set_price( (string) $item['sale_price'] );
	} else {
		$product->set_sale_price( '' );
		$product->set_price( (string) $item['regular_price'] );
	}

	$manage_stock = $item['manage_stock'] ?? true;
	$product->set_manage_stock( (bool) $manage_stock );
	$product->set_stock_quantity( $manage_stock ? (int) $item['stock'] : null );
	$product->set_stock_status( $item['stock_status'] );
	$product->set_backorders( 'onbackorder' === $item['stock_status'] ? 'notify' : 'no' );

	if ( isset( $category_ids[ $item['cat'] ] ) ) {
		$product->set_category_ids( array( $category_ids[ $item['cat'] ] ) );
	}

	$assigned_tag_ids = array();
	foreach ( $item['tags'] ?? array() as $tag_slug ) {
		if ( isset( $tag_ids[ $tag_slug ] ) ) {
			$assigned_tag_ids[] = $tag_ids[ $tag_slug ];
		}
	}
	$product->set_tag_ids( $assigned_tag_ids );

	kg_seed_assign_simple_attributes( $product, $item['attrs'] ?? array(), $attributes_map );

	// Képek beállítása
	$img_keys = $item['images'] ?? array();
	$img_ids  = array();
	foreach ( $img_keys as $k ) {
		if ( isset( $seed_images[ $k ] ) && $seed_images[ $k ] > 0 ) {
			$img_ids[] = $seed_images[ $k ];
		}
	}
	if ( ! empty( $img_ids ) ) {
		$product->set_image_id( $img_ids[0] );
		$product->set_gallery_image_ids( array_slice( $img_ids, 1 ) );
	} else {
		$product->set_image_id( 0 );
		$product->set_gallery_image_ids( array() );
	}

	// Szállítási idő metaadatok
	if ( ! empty( $item['delivery_time'] ) ) {
		$product->update_meta_data( \KG_Headless\Product_Extensions::META_DELIVERY_TIME, $item['delivery_time'] );
	} else {
		$product->delete_meta_data( \KG_Headless\Product_Extensions::META_DELIVERY_TIME );
	}
	if ( ! empty( $item['supplier_delivery'] ) ) {
		$product->update_meta_data( \KG_Headless\Product_Extensions::META_SUPPLIER_DELIVERY_TIME, $item['supplier_delivery'] );
	} else {
		$product->delete_meta_data( \KG_Headless\Product_Extensions::META_SUPPLIER_DELIVERY_TIME );
	}

	// Idempotens, valósághű múltbeli ártörténet az Omnibus számításhoz
	$sale_start_ts = $is_sale ? ( $now - ( 2 * $day_seconds ) ) : 0;
	$seed_history  = array(
		array(
			'timestamp' => $now - ( 25 * $day_seconds ),
			'price'     => (int) $item['regular_price'],
			'is_sale'   => false,
		),
		array(
			'timestamp' => $now - ( 12 * $day_seconds ),
			'price'     => (int) $item['prior_lowest_30'],
			'is_sale'   => (int) $item['prior_lowest_30'] < (int) $item['regular_price'],
		),
	);

	$product->update_meta_data( \KG_Headless\Omnibus::META_HISTORY, $seed_history );
	$product->update_meta_data( \KG_Headless\Omnibus::META_SALE_START_TS, (string) $sale_start_ts );
	$product->delete_meta_data( \KG_Headless\Omnibus::META_LOWEST_30_DAYS );

	$saved_id        = $product->save();
	$saved_product   = wc_get_product( $saved_id );
	$computed_lowest = $saved_product ? $saved_product->get_meta( \KG_Headless\Omnibus::META_LOWEST_30_DAYS, true ) : '';

	echo sprintf(
		"Termék kész: [%s] %s (#%d) | Normál: %d Ft | Akciós: %s | Omnibus: %s Ft\n",
		$item['sku'],
		$item['name'],
		$saved_id,
		$item['regular_price'],
		$is_sale ? $item['sale_price'] . ' Ft' : '-',
		$computed_lowest
	);
}

// 11. Változatos (Variable) teszttermék variációkkal és hiányzó/kifogyott kombinációval (KG-44)
$var_sku         = $sku_prefix . '-VAR-009';
$var_existing_id = wc_get_product_id_by_sku( $var_sku );
$var_product     = ( $var_existing_id && wc_get_product( $var_existing_id ) instanceof \WC_Product_Variable )
	? wc_get_product( $var_existing_id )
	: new \WC_Product_Variable();

$var_product->set_name( 'RunaKard TKL Pro Vezeték Nélküli Billentyűzet' );
$var_product->set_sku( $var_sku );
$var_product->set_status( 'publish' );
$var_product->set_catalog_visibility( 'visible' );
$var_product->set_featured( true );
$var_product->set_menu_order( 9 );
$var_product->set_short_description( 'Testreszabható prémium TKL billentyűzet cserélhető kapcsolókkal és három választható házzal.' );
$var_product->set_description( 'Válaszd ki a kedvenc kapcsolódat és színváltozatodat! Minden variáció saját raktárkészlettel, egyedi árazással és azonnali kosárba helyezéssel érhető el.' );
$var_product->set_category_ids( array( $category_ids['gyujtoi-kiadasok'] ) );
$var_product->set_tag_ids( array_filter( array( $tag_ids['kiemelt'] ?? 0, $tag_ids['ritkasag-epikus'] ?? 0 ) ) );

if ( ! empty( $seed_images['var-black'] ) ) {
	$var_product->set_image_id( $seed_images['var-black'] );
	$var_product->set_gallery_image_ids( array_values( array_filter( array( $seed_images['var-gold'] ?? 0, $seed_images['var-white'] ?? 0 ) ) ) );
}

$var_attrs    = array();
$kap_meta     = $attributes_map['kapcsolo'];
$szin_meta    = $attributes_map['szin'];
$plat_meta    = $attributes_map['platform'];

$attr_kap = new \WC_Product_Attribute();
$attr_kap->set_id( $kap_meta['id'] );
$attr_kap->set_name( $kap_meta['taxonomy'] );
$attr_kap->set_options( array( $kap_meta['terms']['linearis-red'], $kap_meta['terms']['taktilis-brown'] ) );
$attr_kap->set_position( 0 );
$attr_kap->set_visible( true );
$attr_kap->set_variation( true );
$var_attrs[] = $attr_kap;

$attr_szin = new \WC_Product_Attribute();
$attr_szin->set_id( $szin_meta['id'] );
$attr_szin->set_name( $szin_meta['taxonomy'] );
$attr_szin->set_options( array( $szin_meta['terms']['obszidian-fekete'], $szin_meta['terms']['goblin-arany'], $szin_meta['terms']['holdfeny-feher'] ) );
$attr_szin->set_position( 1 );
$attr_szin->set_visible( true );
$attr_szin->set_variation( true );
$var_attrs[] = $attr_szin;

$attr_plat = new \WC_Product_Attribute();
$attr_plat->set_id( $plat_meta['id'] );
$attr_plat->set_name( $plat_meta['taxonomy'] );
$attr_plat->set_options( array( $plat_meta['terms']['pc-mac'] ) );
$attr_plat->set_position( 2 );
$attr_plat->set_visible( true );
$attr_plat->set_variation( false );
$var_attrs[] = $attr_plat;

$var_product->set_attributes( $var_attrs );
$var_product_id = $var_product->save();

$variations_spec = array(
	array(
		'sku'             => $var_sku . '-RED-BLK',
		'kapcsolo'        => 'linearis-red',
		'szin'            => 'obszidian-fekete',
		'regular_price'   => 42990,
		'sale_price'      => null,
		'prior_lowest_30' => 42990,
		'stock'           => 14,
		'stock_status'    => 'instock',
		'image'           => 'var-black',
		'delivery_time'   => '1–2 munkanap',
	),
	array(
		'sku'             => $var_sku . '-BRN-GLD',
		'kapcsolo'        => 'taktilis-brown',
		'szin'            => 'goblin-arany',
		'regular_price'   => 46990,
		'sale_price'      => 39990,
		'prior_lowest_30' => 41990,
		'stock'           => 2,
		'stock_status'    => 'instock',
		'image'           => 'var-gold',
		'delivery_time'   => '1–3 munkanap',
	),
	array(
		'sku'             => $var_sku . '-RED-WHT',
		'kapcsolo'        => 'linearis-red',
		'szin'            => 'holdfeny-feher',
		'regular_price'   => 44990,
		'sale_price'      => null,
		'prior_lowest_30' => 44990,
		'stock'           => 0,
		'stock_status'    => 'outofstock',
		'image'           => 'var-white',
		'delivery_time'   => '',
	),
);

foreach ( $variations_spec as $vspec ) {
	$vid       = wc_get_product_id_by_sku( $vspec['sku'] );
	$variation = ( $vid && wc_get_product( $vid ) instanceof \WC_Product_Variation )
		? wc_get_product( $vid )
		: new \WC_Product_Variation();

	$variation->set_parent_id( $var_product_id );
	$variation->set_sku( $vspec['sku'] );
	$variation->set_status( 'publish' );
	$variation->set_attributes(
		array(
			$kap_meta['taxonomy']  => $vspec['kapcsolo'],
			$szin_meta['taxonomy'] => $vspec['szin'],
		)
	);
	$variation->set_regular_price( (string) $vspec['regular_price'] );

	$v_is_sale = null !== $vspec['sale_price'] && $vspec['sale_price'] < $vspec['regular_price'];
	if ( $v_is_sale ) {
		$variation->set_sale_price( (string) $vspec['sale_price'] );
		$variation->set_price( (string) $vspec['sale_price'] );
	} else {
		$variation->set_sale_price( '' );
		$variation->set_price( (string) $vspec['regular_price'] );
	}

	$variation->set_manage_stock( true );
	$variation->set_stock_quantity( (int) $vspec['stock'] );
	$variation->set_stock_status( $vspec['stock_status'] );

	if ( ! empty( $seed_images[ $vspec['image'] ] ) ) {
		$variation->set_image_id( $seed_images[ $vspec['image'] ] );
	}
	if ( '' !== $vspec['delivery_time'] ) {
		$variation->update_meta_data( \KG_Headless\Product_Extensions::META_DELIVERY_TIME, $vspec['delivery_time'] );
	} else {
		$variation->delete_meta_data( \KG_Headless\Product_Extensions::META_DELIVERY_TIME );
	}

	$v_sale_start = $v_is_sale ? ( $now - ( 2 * $day_seconds ) ) : 0;
	$v_history    = array(
		array(
			'timestamp' => $now - ( 25 * $day_seconds ),
			'price'     => (int) $vspec['regular_price'],
			'is_sale'   => false,
		),
		array(
			'timestamp' => $now - ( 12 * $day_seconds ),
			'price'     => (int) $vspec['prior_lowest_30'],
			'is_sale'   => (int) $vspec['prior_lowest_30'] < (int) $vspec['regular_price'],
		),
	);
	$variation->update_meta_data( \KG_Headless\Omnibus::META_HISTORY, $v_history );
	$variation->update_meta_data( \KG_Headless\Omnibus::META_SALE_START_TS, (string) $v_sale_start );
	$variation->delete_meta_data( \KG_Headless\Omnibus::META_LOWEST_30_DAYS );

	$saved_vid = $variation->save();
	echo "Variáció kész: [{$vspec['sku']}] (#{$saved_vid})\n";
}

\WC_Product_Variable::sync( $var_product_id );
wc_delete_product_transients( $var_product_id );
echo "Változatos termék szinkronizálva: [{$var_sku}] (#{$var_product_id})\n";

// 12. WooCommerce webhookok automatikus beállítása a Next.js revalidáláshoz (KG-46)
$webhook_secret = trim( (string) ( getenv( 'KG_WEBHOOK_SECRET' ) ?: 'kg_local_' . $brand . '_webhook_secret' ) );
$custom_wh_url  = trim( (string) ( getenv( 'KG_WEBHOOK_DELIVERY_URL' ) ?: '' ) );
if ( '' !== $custom_wh_url ) {
	$delivery_url = $custom_wh_url;
} else {
	$parsed_fe = wp_parse_url( $frontend_url );
	$fe_host   = strtolower( (string) ( $parsed_fe['host'] ?? 'localhost' ) );
	$fe_port   = isset( $parsed_fe['port'] ) ? ':' . $parsed_fe['port'] : '';
	if ( kg_seed_is_local_host( $fe_host ) ) {
		// A konténerből a `*.localhost` a saját loopbackre oldódna fel, ezért a hostgépre küldjük.
		$delivery_url = "http://host.docker.internal{$fe_port}/api/webhooks/woo/{$brand}";
	} else {
		$delivery_url = untrailingslashit( $frontend_url ) . "/api/webhooks/woo/{$brand}";
	}
}

$wh_host = strtolower( (string) ( wp_parse_url( $delivery_url, PHP_URL_HOST ) ?? '' ) );
// A lokális webhook-lazítás opciója csak teljesen lokális környezetben kerül be (máshol a plugin úgyis
// figyelmen kívül hagyja, de ne maradjon félrevezető beállítás).
if ( $fully_local && in_array( $wh_host, array( 'host.docker.internal', 'localhost', '127.0.0.1' ), true ) ) {
	update_option( 'kg_headless_allow_local_webhooks', 'yes' );
} else {
	delete_option( 'kg_headless_allow_local_webhooks' );
}

$admin_users = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
$wh_user_id  = ! empty( $admin_users ) ? (int) $admin_users[0] : 1;

$webhook_topics = array(
	'product.created'            => "KG ({$brand}) Termék létrehozva",
	'product.updated'            => "KG ({$brand}) Termék frissítve",
	'product.deleted'            => "KG ({$brand}) Termék törölve",
	'product.restored'           => "KG ({$brand}) Termék visszaállítva",
	'action.created_product_cat' => "KG ({$brand}) Kategória létrehozva",
	'action.edited_product_cat'  => "KG ({$brand}) Kategória frissítve",
	'action.delete_product_cat'  => "KG ({$brand}) Kategória törölve",
);

$wh_data_store = \WC_Data_Store::load( 'webhook' );
$existing_wh   = $wh_data_store->search_webhooks( array( 'limit' => 100 ) );
$by_topic      = array();
$kg_wh_prefix  = "KG ({$brand}) ";
foreach ( $existing_wh as $wh_id ) {
	$wh = wc_get_webhook( $wh_id );
	if ( $wh && str_starts_with( $wh->get_name(), $kg_wh_prefix ) ) {
		$by_topic[ $wh->get_topic() ] = $wh;
	}
}

foreach ( $webhook_topics as $topic => $label ) {
	$wh = $by_topic[ $topic ] ?? new \WC_Webhook();
	$wh->set_name( $label );
	$wh->set_user_id( $wh_user_id );
	$wh->set_topic( $topic );
	$wh->set_secret( $webhook_secret );
	$wh->set_delivery_url( $delivery_url );
	$wh->set_status( 'active' );
	$wh->set_api_version( 'wp_api_v3' );
	$saved_wh_id = $wh->save();
	echo "Webhook kész: [{$topic}] (#{$saved_wh_id}) -> {$delivery_url}\n";
}

// 13. Permalink struktúra beállítása (Store API és REST v3 végpontokhoz)
update_option( 'permalink_structure', '/%postname%/' );
flush_rewrite_rules();

echo "=== [KGoblin Seed KÉSZ] Brand ({$brand}) 4 kategóriával, 12 termékkel (változatos/akciós/előrendelhető) és aktív webhookokkal kész! ===\n";
