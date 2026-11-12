<?php
/**
 * WP-CLI telepítő és tesztadat-generáló szkript (4. lépés)
 * Futtatás: wp eval-file wp-content/plugins/hu-webshop-core/includes/seed-demo-data.php
 *
 * @package HU_Webshop_Core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

echo "--- 1. Magyar pénznem és WooCommerce alapbeállítások ---\n";
update_option( 'woocommerce_currency', 'HUF' );
update_option( 'woocommerce_currency_pos', 'right_space' );
update_option( 'woocommerce_price_thousand_sep', ' ' );
update_option( 'woocommerce_price_decimal_sep', ',' );
update_option( 'woocommerce_price_num_decimals', 0 );
update_option( 'woocommerce_default_country', 'HU' );
update_option( 'woocommerce_store_country', 'HU' );
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_store_pages_only', 'no' );

echo "--- 2. HPOS (High-Performance Order Storage) bekapcsolása ---\n";
update_option( 'woocommerce_feature_custom_orders_table_enabled', 'yes' );
update_option( 'woocommerce_custom_orders_table_enabled', 'yes' );

echo "--- 3. Utánvétes (COD) és Banki átutalásos (BACS) fizetési módok aktiválása ---\n";
$bacs_settings = get_option( 'woocommerce_bacs_settings', array() );
$bacs_settings['enabled']     = 'yes';
$bacs_settings['title']       = 'Előre utalás (Banki átutalás)';
$bacs_settings['description'] = 'A megrendelés végösszegét bankszámlánkra történő átutalással egyenlítheted ki. A csomagot az összeg beérkezése után azonnal indítjuk.';
$bacs_settings['instructions'] = 'Kérjük, a közlemény rovatban tüntesd fel a rendelési számodat!';
update_option( 'woocommerce_bacs_settings', $bacs_settings );

$cod_settings = get_option( 'woocommerce_cod_settings', array() );
$cod_settings['enabled']            = 'yes';
$cod_settings['title']              = 'Utánvétes fizetés a futárnál';
$cod_settings['description']        = 'Fizetés készpénzzel vagy bankkártyával közvetlenül a futárnak a csomag átvételekor.';
$cod_settings['instructions']       = 'Készpénzzel és bankkártyával is fizethetsz a futárnál.';
$cod_settings['enable_for_virtual'] = 'yes';
update_option( 'woocommerce_cod_settings', $cod_settings );

echo "--- 4. Alapoldalak létrehozása és összekötése ---\n";
$pages_config = array(
	'fooldal' => array(
		'title'   => 'Főoldal',
		'content' => '<p>Üdvözlünk a Saját Webshopban!</p>',
		'option'  => 'page_on_front',
	),
	'bolt' => array(
		'title'   => 'Bolt',
		'content' => '',
		'option'  => 'woocommerce_shop_page_id',
	),
	'kosar' => array(
		'title'   => 'Kosár',
		'content' => '[woocommerce_cart]',
		'option'  => 'woocommerce_cart_page_id',
	),
	'penztar' => array(
		'title'   => 'Pénztár',
		'content' => '[woocommerce_checkout]',
		'option'  => 'woocommerce_checkout_page_id',
	),
	'fiokom' => array(
		'title'   => 'Fiókom',
		'content' => '[woocommerce_my_account]',
		'option'  => 'woocommerce_myaccount_page_id',
	),
	'aszf' => array(
		'title'   => 'ÁSZF',
		'content' => '<h2>Általános Szerződési Feltételek</h2><p>Jelen Általános Szerződési Feltételek (ÁSZF) tartalmazza a Saját Webshop (üzemeltető: Minta Webáruház Kft., 1051 Budapest, Példa utca 1., Adószám: 12345678-2-42) által nyújtott elektronikus kereskedelmi szolgáltatásokat igénybe vevő Vásárló jogait és kötelezettségeit.</p><h3>1. Elállási jog</h3><p>A fogyasztót a 45/2014. (II. 26.) Korm. rendelet alapján 14 napos indokolás nélküli elállási jog illeti meg.</p><h3>2. Szavatosság és jótállás</h3><p>Termékeinkre a hatályos magyar jogszabályok szerinti kellékszavatosságot és jótállást biztosítunk.</p>',
		'option'  => 'woocommerce_terms_page_id',
	),
	'adatkezelesi-tajekoztato' => array(
		'title'   => 'Adatkezelési tájékoztató',
		'content' => '<h2>Adatkezelési tájékoztató (GDPR)</h2><p>Webáruházunk a megrendelések teljesítése, számlázás és kiszállítás céljából kezeli a Vásárlók személyes adatait az EU 2016/679 rendelete (GDPR) és az Infotv. előírásainak megfelelően.</p>',
		'option'  => 'wp_page_for_privacy_policy',
	),
	'kapcsolat' => array(
		'title'   => 'Kapcsolat',
		'content' => '<h2>Kapcsolat és Ügyfélszolgálat</h2><p>Kérdésed van a rendeléseddel vagy termékeinkkel kapcsolatban? Keress minket bizalommal!</p><ul><li><strong>E-mail:</strong> info@sajatwebshop.hu</li><li><strong>Telefon:</strong> +36 1 234 5678 (H–P: 09:00–17:00)</li><li><strong>Székhely és csomagküldés:</strong> 1051 Budapest, Példa utca 1.</li></ul>',
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
		$page_id = $existing->ID;
	} else {
		$page_id = wp_insert_post(
			array(
				'post_title'   => $page_data['title'],
				'post_name'    => $slug,
				'post_content' => $page_data['content'],
				'post_status'  => 'publish',
				'post_type'    => 'page',
			)
		);
	}

	if ( ! empty( $page_data['option'] ) && $page_id ) {
		update_option( $page_data['option'], $page_id );
	}
	echo "Oldal beállítva: {$page_data['title']} (#{$page_id})\n";
}

update_option( 'show_on_front', 'page' );

echo "--- 5. 3 Termékkategória létrehozása ---\n";
$categories_data = array(
	'kave-es-tea' => array(
		'name'        => 'Kézműves Kávék & Teák',
		'description' => 'Frissen pörkölt szemes kávék és prémium szálas teák hazai pörkölőktől.',
	),
	'konyhai-eszkozok' => array(
		'name'        => 'Prémium Konyhai Eszközök',
		'description' => 'Tartós, rozsdamentes barista és konyhai kiegészítők otthoni használatra.',
	),
	'ajandekcsomagok' => array(
		'name'        => 'Természetes Életmód & Ajándékok',
		'description' => 'Válogatott hazai finomságok és fenntartható ajándékcsomagok.',
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
	}
	if ( ! is_wp_error( $term ) ) {
		$category_ids[ $slug ] = (int) ( is_array( $term ) ? $term['term_id'] : $term );
		echo "Kategória kész: {$cat_info['name']} (#{$category_ids[$slug]})\n";
	}
}

echo "--- 6. 8 darab valósághű magyar teszttermék generálása ---\n";
$products_data = array(
	array(
		'sku'               => 'HU-KAVE-001',
		'name'              => 'Balatoni Reggel – 100% Arabica Szemes Kávé (500g)',
		'regular_price'     => '5990',
		'sale_price'        => '4790',
		'lowest_30'         => '4490',
		'stock'             => 35,
		'cat'               => 'kave-es-tea',
		'short_description' => 'Közepes pörkölésű, csokoládés-mogyorós jegyekkel rendelkező prémium szemes kávé.',
		'description'       => 'A Balatoni Reggel válogatott dél-amerikai 100% Arabica kávébabokból készül kisüzemi magyar pörkölőnkben. Kifejezetten ajánljuk eszpresszóhoz, kotyogós kávéfőzőhöz és tejes kávékülönlegességekhez is.',
	),
	array(
		'sku'               => 'HU-KAVE-002',
		'name'              => ' Etióp Yirgacheffe Specialty Filter Kávé (250g)',
		'regular_price'     => '4490',
		'sale_price'        => '',
		'lowest_30'         => '4490',
		'stock'             => 22,
		'cat'               => 'kave-es-tea',
		'short_description' => 'Világos pörkölésű, virágos és citrusos aromájú dűlőszelektált etióp kávé.',
		'description'       => 'Kézzel szüretelt, mosott feldolgozású etióp specialty kávé. Jázminos illat, bergamott és őszibarack ízjegyek jellemzik. V60, Chemex és AeroPress elkészítéshez tökéletes választás.',
	),
	array(
		'sku'               => 'HU-TEA-003',
		'name'              => 'Mecseki Gyógynövényes Nyugalom Szálas Tea (150g)',
		'regular_price'     => '2890',
		'sale_price'        => '2390',
		'lowest_30'         => '2390',
		'stock'             => 50,
		'cat'               => 'kave-es-tea',
		'short_description' => 'Koffeinmentes hazai gyógynövénykeverék citromfűvel, levendulával és hársfavirággal.',
		'description'       => '100% természetes, adalékanyagmentes szálas gyógynövénytea a Mecsek lankáiról. Esti ellazuláshoz, stresszoldáshoz és nyugodt alváshoz ajánlott.',
	),
	array(
		'sku'               => 'HU-ESZK-004',
		'name'              => 'Kézi Kerámiakéses Kávéőrlő – Rozsdamentes Acél',
		'regular_price'     => '12990',
		'sale_price'        => '9990',
		'lowest_30'         => '9490',
		'stock'             => 14,
		'cat'               => 'konyhai-eszkozok',
		'short_description' => 'Fokozatmentesen állítható szemcseméret eszpresszótól a French Press-ig.',
		'description'       => 'Precíziós kúpos kerámia őrlőfejes kézi kávéőrlő, amely nem melegíti fel a kávészemeket őrlés közben, így megőrzi az összes illóolajat és aromát.',
	),
	array(
		'sku'               => 'HU-ESZK-005',
		'name'              => 'Duplafalú Hőszigetelt Barista Üvegpohár Szett (2 db, 300 ml)',
		'regular_price'     => '6490',
		'sale_price'        => '',
		'lowest_30'         => '6490',
		'stock'             => 28,
		'cat'               => 'konyhai-eszkozok',
		'short_description' => 'Kézzel fújt boroszilikát üvegpohár cappuccino és latte macchiato tálalásához.',
		'description'       => 'A duplafalú kialakításnak köszönhetően az italod sokáig forró marad, miközben a pohár külső fala nem forrósodik át. Mosogatógépben is tisztítható.',
	),
	array(
		'sku'               => 'HU-ESZK-006',
		'name'              => 'Digitális Barista Mérleg Időzítővel (0,1g pontosság)',
		'regular_price'     => '8990',
		'sale_price'        => '7490',
		'lowest_30'         => '7490',
		'stock'             => 19,
		'cat'               => 'konyhai-eszkozok',
		'short_description' => 'Beépített stopperóra, LED kijelző és hőálló szilikon alátét.',
		'description'       => 'A tökéletes kávékészítés alapja a pontos receptúra. 0,1 grammos mérési pontosság 3 kg-os méréshatárig, USB-C töltéssel.',
	),
	array(
		'sku'               => 'HU-AJAN-007',
		'name'              => 'Termelői Magyar Akácméz & Propolisz Válogatás (2×500g)',
		'regular_price'     => '7890',
		'sale_price'        => '',
		'lowest_30'         => '7890',
		'stock'             => 40,
		'cat'               => 'ajandekcsomagok',
		'short_description' => 'Kistermelői Zala megyei tiszta akácméz díszdobozos kiszerelésben.',
		'description'       => 'Vegyszermentes, hidegen pergetett magyar termelői akácméz, amely hosszú ideig folyékony marad. Kiváló tea és kávé természetes édesítésére.',
	),
	array(
		'sku'               => 'HU-AJAN-008',
		'name'              => 'Prémium Otthoni Barista Ajándékcsomag Díszdobozban',
		'regular_price'     => '24990',
		'sale_price'        => '19990',
		'lowest_30'         => '18990',
		'stock'             => 10,
		'cat'               => 'ajandekcsomagok',
		'short_description' => 'Komplett ajándékcsomag: 500g Arabica kávé, kézi kávéőrlő, duplafalú pohárszett és akácméz.',
		'description'       => 'Ideális születésnapi vagy karácsonyi ajándék minden kávérajongónak! A díszdoboz tartalmazza legnépszerűbb szemes kávénkat, egy rozsdamentes kézi őrlőt, 2 db duplafalú poharat és termelői mézet.',
	),
);

foreach ( $products_data as $item ) {
	$existing_id = wc_get_product_id_by_sku( $item['sku'] );
	$product     = $existing_id ? wc_get_product( $existing_id ) : new WC_Product_Simple();

	$product->set_name( $item['name'] );
	$product->set_sku( $item['sku'] );
	$product->set_status( 'publish' );
	$product->set_catalog_visibility( 'visible' );
	$product->set_description( $item['description'] );
	$product->set_short_description( $item['short_description'] );
	$product->set_regular_price( $item['regular_price'] );

	if ( '' !== $item['sale_price'] ) {
		$product->set_sale_price( $item['sale_price'] );
		$product->set_price( $item['sale_price'] );
	} else {
		$product->set_sale_price( '' );
		$product->set_price( $item['regular_price'] );
	}

	$product->set_manage_stock( true );
	$product->set_stock_quantity( $item['stock'] );
	$product->set_stock_status( 'instock' );

	if ( isset( $category_ids[ $item['cat'] ] ) ) {
		$product->set_category_ids( array( $category_ids[ $item['cat'] ] ) );
	}

	// Omnibus 30 napos legalacsonyabb ár és előzmény mentése
	$now = time();
	$history = array(
		array(
			'timestamp' => $now - ( 20 * DAY_IN_SECONDS ),
			'price'     => (float) $item['regular_price'],
		),
		array(
			'timestamp' => $now - ( 10 * DAY_IN_SECONDS ),
			'price'     => (float) $item['lowest_30'],
		),
	);
	$product->update_meta_data( '_hu_price_history', $history );
	$product->update_meta_data( '_hu_lowest_price_30_days', $item['lowest_30'] );

	$saved_id = $product->save();
	// Biztosítjuk, hogy a save hook ne írja felül a teszt 30 napos legalacsonyabb árat
	update_post_meta( $saved_id, '_hu_lowest_price_30_days', $item['lowest_30'] );

	echo "Termék létrehozva/frissítve: {$item['name']} (#{$saved_id})\n";
}

// Permalink struktúra beállítása szép URL-ekre
update_option( 'permalink_structure', '/%postname%/' );
flush_rewrite_rules();

echo "--- KÉSZ! Minden oldal, kategória, 8 teszttermék, HPOS és fizetési mód aktív. ---\n";
