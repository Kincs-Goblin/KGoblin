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
 * - Gamer tematikájú kategóriák és 8 db termék (köztük akciós termékek valós múltbeli Omnibus ártörténettel)
 *
 * @package KG_Headless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$brand        = strtolower( trim( (string) ( getenv( 'KG_BRAND' ) ?: 'gamer' ) ) );
$frontend_url = getenv( 'KG_FRONTEND_URL' ) ?: 'http://localhost:3000';
$brand_upper  = strtoupper( preg_replace( '/[^a-z0-9]/i', '', $brand ) );
$sku_prefix   = 'gamer' === $brand ? 'KG-GMR' : 'KG-' . substr( $brand_upper, 0, 4 );
$shop_label   = 'gamer' === $brand ? 'KincsGoblin Gamer Webáruház' : 'KincsGoblin (' . ucfirst( $brand ) . ') Webáruház';

echo "=== [KGoblin Seed] Brand: {$brand} ({$shop_label}) | SKU prefix: {$sku_prefix} | Frontend: {$frontend_url} ===\n";

// 1. Alap WooCommerce és magyar pénznem beállítások
update_option( 'kg_headless_brand', $brand );
update_option( 'kg_headless_frontend_url', $frontend_url );
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

// 2. HPOS (High-Performance Order Storage) biztonságos engedélyezése
// Ha már léteznek szinkronizálatlan legacy (wp_posts) rendelések és a HPOS ki volt kapcsolva,
// bekapcsoljuk a data sync-et is, hogy egyetlen rendelés se tűnjön el.
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
$bacs_settings = get_option( 'woocommerce_bacs_settings', array() );
$bacs_settings['enabled']      = 'yes';
$bacs_settings['title']        = 'Előre utalás (Banki átutalás)';
$bacs_settings['description']  = 'A megrendelés végösszegét bankszámlánkra történő átutalással egyenlítheted ki.';
$bacs_settings['instructions'] = 'Kérjük, a közlemény rovatban tüntesd fel a rendelési számodat!';
update_option( 'woocommerce_bacs_settings', $bacs_settings );

$cod_settings = get_option( 'woocommerce_cod_settings', array() );
$cod_settings['enabled']            = 'yes';
$cod_settings['title']              = 'Utánvétes fizetés a futárnál';
$cod_settings['description']        = 'Fizetés készpénzzel vagy bankkártyával közvetlenül a futárnak az átvételkor.';
$cod_settings['instructions']       = 'Készpénzzel és bankkártyával is fizethetsz a futárnál.';
$cod_settings['enable_for_virtual'] = 'yes';
update_option( 'woocommerce_cod_settings', $cod_settings );

// 4. Szállítási zóna biztosítása (hogy a Store API checkout találjon szállítási módot)
if ( class_exists( 'WC_Shipping_Zones' ) ) {
	$zones = \WC_Shipping_Zones::get_zones();
	$default_zone = new \WC_Shipping_Zone( 0 );
	$methods = $default_zone->get_shipping_methods();
	if ( empty( $methods ) ) {
		$default_zone->add_shipping_method( 'free_shipping' );
		echo "Alapértelmezett ingyenes szállítási mód hozzáadva.\n";
	}
}

// 5. Jogi és WooCommerce alapoldalak létrehozása (idempotensen)
$pages_config = array(
	'bolt' => array(
		'title'   => 'Bolt',
		'content' => '',
		'option'  => 'woocommerce_shop_page_id',
	),
	'kosar' => array(
		'title'   => 'Kosár',
		'content' => '<!-- wp:woocommerce/cart /-->',
		'option'  => 'woocommerce_cart_page_id',
	),
	'penztar' => array(
		'title'   => 'Pénztár',
		'content' => '<!-- wp:woocommerce/checkout /-->',
		'option'  => 'woocommerce_checkout_page_id',
	),
	'fiokom' => array(
		'title'   => 'Fiókom',
		'content' => '[woocommerce_my_account]',
		'option'  => 'woocommerce_myaccount_page_id',
	),
	'aszf' => array(
		'title'   => 'Általános Szerződési Feltételek (ÁSZF)',
		'content' => "<h2>Általános Szerződési Feltételek</h2><p>Jelen ÁSZF a {$shop_label} (Üzemeltető: KincsGoblin Kft., 1053 Budapest, Kossuth Lajos utca 12., Adószám: 12345678-2-42) által nyújtott elektronikus kereskedelmi szolgáltatásokat igénybe vevő Vásárló jogait és kötelezettségeit szabályozza.</p><h3>1. Elállási jog</h3><p>A fogyasztót a 45/2014. (II. 26.) Korm. rendelet alapján 14 napos indokolás nélküli elállási jog illeti meg.</p><h3>2. Jótállás és kellékszavatosság</h3><p>Minden tartós fogyasztási cikkre (perifériák, hardverek) a hatályos magyar jogszabályok szerinti kötelező jótállást biztosítunk.</p>",
		'option'  => 'woocommerce_terms_page_id',
	),
	'adatkezelesi-tajekoztato' => array(
		'title'   => 'Adatkezelési tájékoztató',
		'content' => '<h2>Adatkezelési tájékoztató (GDPR)</h2><p>A KincsGoblin Kft. a megrendelések teljesítése, számlázás és kiszállítás céljából kezeli a Vásárlók személyes adatait az EU 2016/679 rendelete (GDPR) és az Infotv. előírásainak megfelelően.</p>',
		'option'  => 'wp_page_for_privacy_policy',
	),
	'elallasi-tajekoztato' => array(
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

// 6. Gamer tematikájú termékkategóriák
$categories_data = array(
	'gamer-periferiak' => array(
		'name'        => 'Gamer Perifériák',
		'description' => 'Mechanikus billentyűzetek, ultrakönnyű esport egerek és stúdiószintű gamer headsetek.',
	),
	'streaming-es-audio' => array(
		'name'        => 'Streaming és Audio',
		'description' => 'USB/XLR kondenzátor mikrofonok, stream deck vezérlők és webkamerák tartalomgyártóknak.',
	),
	'ergonomia-es-kiegeszitok' => array(
		'name'        => 'Ergonómia és Asztali Kiegészítők',
		'description' => 'Prémium XXL egérpadok, monitorállványok, csuklótámaszok és RGB háttérvilágítás.',
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

// 7. 8 darab teszttermék (akciós termékeknél valós múltbeli Omnibus ártörténettel)
$products_data = array(
	array(
		'sku'               => $sku_prefix . '-KB-001',
		'name'              => 'ApexStrike Pro 75% Hot-Swap Mechanikus Gamer Billentyűzet (Lineáris Red)',
		'regular_price'     => 44990,
		'sale_price'        => 36990,
		'prior_lowest_30'   => 34990, // Az akció előtti 30 napban volt már 34 990 Ft is!
		'stock'             => 25,
		'cat'               => 'gamer-periferiak',
		'short_description' => 'Gasket-mount alumínium házas 75%-os mechanikus billentyűzet előre kent kapcsolókkal és PBT kupakokkal.',
		'description'       => 'Az ApexStrike Pro 75% kifejezetten kompetitív játékosoknak készült: 1000 Hz lekérdezési frekvencia, 5-tűs hot-swap NYÁK, hangelnyelő szilikon rétegek és teljes QMK/VIA programozhatóság.',
	),
	array(
		'sku'               => $sku_prefix . '-MS-002',
		'name'              => 'PhantomGlide Ultralight 54g Vezeték Nélküli Esport Egér (PAW3395)',
		'regular_price'     => 32990,
		'sale_price'        => 27990,
		'prior_lowest_30'   => 32990, // Az akció előtt végig normál 32 990 Ft-os áron futott
		'stock'             => 40,
		'cat'               => 'gamer-periferiak',
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
		'cat'               => 'gamer-periferiak',
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
		'cat'               => 'streaming-es-audio',
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
		'cat'               => 'streaming-es-audio',
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
		'cat'               => 'ergonomia-es-kiegeszitok',
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
		'cat'               => 'ergonomia-es-kiegeszitok',
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
		'cat'               => 'ergonomia-es-kiegeszitok',
		'short_description' => 'Tükröződésmentes asztali megvilágítás (CRI > 95) állítható színhőmérséklettel (2700K–6500K).',
		'description'       => 'Az aszimmetrikus optikai kialakítás csak az íróasztalt világítja meg, a monitor képernyőjén nem okoz becsillanást. Éjszakai játékhoz és munkához elengedhetetlen.',
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

	$product->set_manage_stock( true );
	$product->set_stock_quantity( $item['stock'] );
	$product->set_stock_status( 'instock' );

	if ( isset( $category_ids[ $item['cat'] ] ) ) {
		$product->set_category_ids( array( $category_ids[ $item['cat'] ] ) );
	}

	// Idempotens, valósághű múltbeli ártörténet beállítása az Omnibus számítás számára:
	// - 25 napja: normál ár
	// - 12 napja: a megadott prior_lowest_30 (az akció kezdete előtti 30 nap legalacsonyabb ára)
	// - 2 napja: elindult a jelenlegi akció (sale_started_at = now - 2 nap)
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
	$product->update_meta_data( \KG_Headless\Omnibus::META_LOWEST_30_DAYS, (string) $item['prior_lowest_30'] );

	$saved_id = $product->save();
	$saved_product = wc_get_product( $saved_id );
	$computed_lowest = $saved_product ? $saved_product->get_meta( \KG_Headless\Omnibus::META_LOWEST_30_DAYS, true ) : '';

	echo sprintf(
		"Termék kész: [%s] %s (#%d) | Normál: %d Ft | Akciós: %s | Omnibus 30 napos: %s Ft\n",
		$item['sku'],
		$item['name'],
		$saved_id,
		$item['regular_price'],
		$is_sale ? $item['sale_price'] . ' Ft' : '-',
		$computed_lowest
	);
}

// 8. Permalink struktúra beállítása (Store API és REST v3 végpontokhoz)
update_option( 'permalink_structure', '/%postname%/' );
flush_rewrite_rules();

echo "=== [KGoblin Seed KÉSZ] Brand ({$brand}) minden alapoldala, 3 kategóriája és 8 gamer terméke aktív! ===\n";
