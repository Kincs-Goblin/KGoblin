<?php
/**
 * Plugin Name: HU Webshop Core – Magyar Jogszabályi és Pénztár Modul
 * Plugin URI: http://localhost:8080
 * Description: Magyar e-kereskedelmi és jogszabályi megfelelés WooCommerce-hez (HPOS kompatibilis): magyar pénztár mező sorrend, céges számla és adószám validáció, kötelező ÁSZF / fizetési kötelezettség jelölőnégyzetek, "Megrendelés és fizetés" gomb, valamint EU Omnibus irányelv szerinti 30 napos legalacsonyabb ár kijelzés.
 * Version: 1.0.0
 * Author: Saját Webshop Fejlesztő
 * Requires at least: 6.4
 * Requires PHP: 8.3
 * WC requires at least: 8.0
 * WC tested up to: 9.5
 * Text Domain: hu-webshop-core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 0. WooCommerce HPOS (High-Performance Order Storage) kompatibilitás deklarálása
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
		}
	}
);

/**
 * 1. Pénztár mezők optimalizálása magyar viszonylatra (woocommerce_checkout_fields)
 *    - Vezetéknév, Keresztnév sorrend
 *    - Felesleges mezők eltávolítása (cím 2. sora, megye/állam, alapértelmezett cégnév)
 *    - Opcionális "Céges számlát kérek" jelölőnégyzet + Cégnév és Magyar Adószám mező
 */
add_filter(
	'woocommerce_default_address_fields',
	function ( array $fields ): array {
		if ( isset( $fields['last_name'] ) ) {
			$fields['last_name']['label']    = __( 'Vezetéknév', 'hu-webshop-core' );
			$fields['last_name']['priority'] = 10;
			$fields['last_name']['class']    = array( 'form-row-first' );
		}

		if ( isset( $fields['first_name'] ) ) {
			$fields['first_name']['label']    = __( 'Keresztnév', 'hu-webshop-core' );
			$fields['first_name']['priority'] = 20;
			$fields['first_name']['class']    = array( 'form-row-last' );
		}

		if ( isset( $fields['postcode'] ) ) {
			$fields['postcode']['label']    = __( 'Irányítószám', 'hu-webshop-core' );
			$fields['postcode']['priority'] = 40;
			$fields['postcode']['class']    = array( 'form-row-first' );
		}

		if ( isset( $fields['city'] ) ) {
			$fields['city']['label']    = __( 'Település', 'hu-webshop-core' );
			$fields['city']['priority'] = 50;
			$fields['city']['class']    = array( 'form-row-last' );
		}

		if ( isset( $fields['address_1'] ) ) {
			$fields['address_1']['label']       = __( 'Utca, házszám, emelet/ajtó', 'hu-webshop-core' );
			$fields['address_1']['placeholder'] = __( 'Pl. Kossuth Lajos utca 12. 2/4.', 'hu-webshop-core' );
			$fields['address_1']['priority']    = 60;
			$fields['address_1']['class']       = array( 'form-row-wide' );
		}

		// Felesleges címmezők eltávolítása
		unset( $fields['address_2'], $fields['state'], $fields['company'] );

		return $fields;
	},
	20
);

add_filter(
	'woocommerce_checkout_fields',
	function ( array $fields ): array {
		// Vezetéknév -> Keresztnév sorrend biztosítása számlázási és szállítási adatoknál
		foreach ( array( 'billing', 'shipping' ) as $section ) {
			if ( isset( $fields[ $section ][ $section . '_last_name' ] ) ) {
				$fields[ $section ][ $section . '_last_name' ]['label']    = __( 'Vezetéknév', 'hu-webshop-core' );
				$fields[ $section ][ $section . '_last_name' ]['priority'] = 10;
				$fields[ $section ][ $section . '_last_name' ]['class']    = array( 'form-row-first' );
			}
			if ( isset( $fields[ $section ][ $section . '_first_name' ] ) ) {
				$fields[ $section ][ $section . '_first_name' ]['label']    = __( 'Keresztnév', 'hu-webshop-core' );
				$fields[ $section ][ $section . '_first_name' ]['priority'] = 20;
				$fields[ $section ][ $section . '_first_name' ]['class']    = array( 'form-row-last' );
			}

			unset(
				$fields[ $section ][ $section . '_address_2' ],
				$fields[ $section ][ $section . '_state' ],
				$fields[ $section ][ $section . '_company' ]
			);
		}

		if ( isset( $fields['billing']['billing_phone'] ) ) {
			$fields['billing']['billing_phone']['label']       = __( 'Telefonszám (futár értesítéshez)', 'hu-webshop-core' );
			$fields['billing']['billing_phone']['placeholder'] = '+36 30 123 4567';
			$fields['billing']['billing_phone']['priority']    = 90;
		}

		if ( isset( $fields['billing']['billing_email'] ) ) {
			$fields['billing']['billing_email']['label']    = __( 'E-mail cím', 'hu-webshop-core' );
			$fields['billing']['billing_email']['priority'] = 100;
		}

		// Opcionális "Céges számlát kérek" jelölőnégyzet
		$fields['billing']['billing_is_company'] = array(
			'type'     => 'checkbox',
			'label'    => __( 'Céges számlát kérek', 'hu-webshop-core' ),
			'required' => false,
			'class'    => array( 'form-row-wide', 'hu-company-toggle-row' ),
			'priority' => 25,
		);

		// Dinamikusan megjelenő Cégnév mező
		$fields['billing']['billing_company_name'] = array(
			'type'        => 'text',
			'label'       => __( 'Cégnév', 'hu-webshop-core' ) . ' <abbr class="required" title="kötelező">*</abbr>',
			'placeholder' => __( 'Pl. Minta Kereskedelmi Kft.', 'hu-webshop-core' ),
			'required'    => false, // Szerveroldalon validáljuk, ha a billing_is_company be van pipálva
			'class'       => array( 'form-row-first', 'hu-company-field' ),
			'priority'    => 26,
		);

		// Dinamikusan megjelenő Magyar Adószám mező
		$fields['billing']['billing_tax_number'] = array(
			'type'        => 'text',
			'label'       => __( 'Magyar adószám', 'hu-webshop-core' ) . ' <abbr class="required" title="kötelező">*</abbr>',
			'placeholder' => __( '12345678-2-42', 'hu-webshop-core' ),
			'required'    => false, // Szerveroldalon validáljuk formátum-ellenőrzéssel
			'class'       => array( 'form-row-last', 'hu-company-field' ),
			'priority'    => 27,
		);

		return $fields;
	},
	25
);

/**
 * Céges számla mezők élő megjelenítése/elrejtése a pénztár oldalon
 */
add_action(
	'wp_footer',
	function (): void {
		if ( ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
			return;
		}
		?>
		<script>
		document.addEventListener('DOMContentLoaded', function () {
			var checkbox = document.getElementById('billing_is_company');
			var companyFields = document.querySelectorAll('.hu-company-field');

			function toggleCompanyFields() {
				if (!checkbox) return;
				var show = checkbox.checked;
				companyFields.forEach(function (field) {
					field.style.display = show ? '' : 'none';
				});
			}

			if (checkbox) {
				toggleCompanyFields();
				checkbox.addEventListener('change', toggleCompanyFields);
			}
		});
		</script>
		<?php
	}
);

/**
 * 2. Kötelező jogi jelölőnégyzetek a rendelés leadása elé (nem előre bepipált!)
 *    - ÁSZF és Adatkezelési tájékoztató elfogadása
 *    - Fizetési kötelezettség tudomásulvétele
 */
add_action(
	'woocommerce_review_order_before_submit',
	function (): void {
		$aszf_url    = home_url( '/aszf/' );
		$privacy_url = home_url( '/adatkezelesi-tajekoztato/' );
		?>
		<div class="hu-legal-checkboxes my-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
			<p class="form-row validate-required" id="hu_accept_terms_privacy_field">
				<label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox flex items-start gap-2.5 cursor-pointer">
					<input
						type="checkbox"
						class="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
						name="hu_accept_terms_privacy"
						id="hu_accept_terms_privacy"
						value="1"
					/>
					<span class="woocommerce-terms-and-conditions-checkbox-text">
						Elolvastam és elfogadom az <a href="<?php echo esc_url( $aszf_url ); ?>" target="_blank" class="font-semibold text-indigo-600 underline">Általános Szerződési Feltételeket (ÁSZF)</a> és az <a href="<?php echo esc_url( $privacy_url ); ?>" target="_blank" class="font-semibold text-indigo-600 underline">Adatkezelési tájékoztatót</a>. <abbr class="required text-rose-600 font-bold" title="kötelező">*</abbr>
					</span>
				</label>
			</p>

			<p class="form-row validate-required" id="hu_accept_payment_obligation_field">
				<label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox flex items-start gap-2.5 cursor-pointer">
					<input
						type="checkbox"
						class="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
						name="hu_accept_payment_obligation"
						id="hu_accept_payment_obligation"
						value="1"
					/>
					<span>
						Tudomásul veszem, hogy a megrendelés elküldése <strong>fizetési kötelezettséggel jár</strong>. <abbr class="required text-rose-600 font-bold" title="kötelező">*</abbr>
					</span>
				</label>
			</p>
		</div>
		<?php
	}
);

/**
 * Céges adószám és kötelező jogi nyilatkozatok szerveroldali ellenőrzése
 */
add_action(
	'woocommerce_checkout_process',
	function (): void {
		$is_company = ! empty( $_POST['billing_is_company'] );

		if ( $is_company ) {
			$company_name = isset( $_POST['billing_company_name'] ) ? sanitize_text_field( wp_unslash( $_POST['billing_company_name'] ) ) : '';
			$tax_number   = isset( $_POST['billing_tax_number'] ) ? sanitize_text_field( wp_unslash( $_POST['billing_tax_number'] ) ) : '';

			if ( '' === $company_name ) {
				wc_add_notice( __( 'Céges számla igénylése esetén a <strong>Cégnév</strong> megadása kötelező.', 'hu-webshop-core' ), 'error' );
			}

			// Magyar adószám formátum-ellenőrzés: 12345678-1-12 (vagy 11 számjegy kötőjelek nélkül)
			$tax_pattern = '/^(\d{8}-[1-5]-\d{2}|\d{11})$/';
			if ( '' === $tax_number ) {
				wc_add_notice( __( 'Céges számla igénylése esetén a <strong>Magyar adószám</strong> megadása kötelező.', 'hu-webshop-core' ), 'error' );
			} elseif ( ! preg_match( $tax_pattern, $tax_number ) ) {
				wc_add_notice(
					__( 'A megadott <strong>Magyar adószám</strong> formátuma érvénytelen. Helyes formátum: <code>12345678-2-42</code>.', 'hu-webshop-core' ),
					'error'
				);
			}
		}

		if ( empty( $_POST['hu_accept_terms_privacy'] ) ) {
			wc_add_notice(
				__( 'A rendelés leadásához el kell fogadnod az <strong>Általános Szerződési Feltételeket és az Adatkezelési tájékoztatót</strong>.', 'hu-webshop-core' ),
				'error'
			);
		}

		if ( empty( $_POST['hu_accept_payment_obligation'] ) ) {
			wc_add_notice(
				__( 'A rendelés leadásához tudomásul kell venned, hogy a megrendelés <strong>fizetési kötelezettséggel jár</strong>.', 'hu-webshop-core' ),
				'error'
			);
		}
	}
);

/**
 * Rendelési metaadatok mentése szigorúan HPOS-kompatibilis módon ($order objektumon keresztül)
 */
add_action(
	'woocommerce_checkout_create_order',
	function ( \WC_Order $order, array $data ): void {
		$is_company = ! empty( $_POST['billing_is_company'] );

		if ( $is_company ) {
			$company_name = isset( $_POST['billing_company_name'] ) ? sanitize_text_field( wp_unslash( $_POST['billing_company_name'] ) ) : '';
			$tax_number   = isset( $_POST['billing_tax_number'] ) ? sanitize_text_field( wp_unslash( $_POST['billing_tax_number'] ) ) : '';

			$order->set_billing_company( $company_name );
			$order->update_meta_data( '_billing_is_company', 'yes' );
			$order->update_meta_data( '_billing_company_name', $company_name );
			$order->update_meta_data( '_billing_tax_number', $tax_number );
		} else {
			$order->update_meta_data( '_billing_is_company', 'no' );
		}

		$order->update_meta_data( '_hu_accepted_terms_privacy', ! empty( $_POST['hu_accept_terms_privacy'] ) ? 'yes' : 'no' );
		$order->update_meta_data( '_hu_accepted_payment_obligation', ! empty( $_POST['hu_accept_payment_obligation'] ) ? 'yes' : 'no' );
		$order->update_meta_data( '_hu_legal_accepted_at', current_time( 'mysql' ) );
	},
	10,
	2
);

/**
 * Céges adószám megjelenítése az Admin rendelés nézetben (HPOS kompatibilis wc_get_order() használatával)
 */
add_action(
	'woocommerce_admin_order_data_after_billing_address',
	function ( $order_or_id ): void {
		$order = $order_or_id instanceof \WC_Order ? $order_or_id : wc_get_order( $order_or_id );
		if ( ! $order ) {
			return;
		}

		$tax_number = $order->get_meta( '_billing_tax_number' );
		if ( ! empty( $tax_number ) ) {
			echo '<p><strong>' . esc_html__( 'Magyar adószám:', 'hu-webshop-core' ) . '</strong> ' . esc_html( (string) $tax_number ) . '</p>';
		}
	}
);

/**
 * 3. Pénztár gomb feliratának módosítása: "Megrendelés és fizetés"
 */
add_filter(
	'woocommerce_order_button_text',
	function (): string {
		return __( 'Megrendelés és fizetés', 'hu-webshop-core' );
	},
	99
);

/**
 * 4. EU Omnibus irányelv szerinti 30 napos legalacsonyabb ár követése és kijelzése
 *
 * Árváltozáskor eltároljuk a termék ártörténetét (_hu_price_history) és kiszámítjuk
 * az elmúlt 30 nap legalacsonyabb árát (_hu_lowest_price_30_days).
 */
function hu_webshop_record_product_price_history( \WC_Product $product ): void {
	$product_id = $product->get_id();
	if ( ! $product_id ) {
		return;
	}

	$regular_price = (float) $product->get_regular_price();
	$sale_price    = (float) $product->get_sale_price();
	$active_price  = (float) $product->get_price();

	if ( $active_price <= 0 && $regular_price <= 0 ) {
		return;
	}

	$now        = time();
	$thirty_ago = $now - ( 30 * DAY_IN_SECONDS );
	$history    = $product->get_meta( '_hu_price_history', true );

	if ( ! is_array( $history ) ) {
		$history = array();
	}

	// 30 napnál régebbi bejegyzések tisztítása
	$filtered_history = array();
	foreach ( $history as $entry ) {
		if ( isset( $entry['timestamp'], $entry['price'] ) && (int) $entry['timestamp'] >= $thirty_ago && (float) $entry['price'] > 0 ) {
			$filtered_history[] = array(
				'timestamp' => (int) $entry['timestamp'],
				'price'     => (float) $entry['price'],
			);
		}
	}

	// Ha még nincs előzmény és a termék akciós, a normál árat is rögzítjük kiindulási alapnak
	if ( empty( $filtered_history ) && $regular_price > 0 ) {
		$filtered_history[] = array(
			'timestamp' => $now - DAY_IN_SECONDS,
			'price'     => $regular_price,
		);
	}

	// Aktuális ár rögzítése
	$price_to_record = $active_price > 0 ? $active_price : $regular_price;
	$filtered_history[] = array(
		'timestamp' => $now,
		'price'     => $price_to_record,
	);

	// Legalacsonyabb ár meghatározása az elmúlt 30 napból
	$prices = array_column( $filtered_history, 'price' );
	$lowest = ! empty( $prices ) ? min( $prices ) : $price_to_record;

	$product->update_meta_data( '_hu_price_history', $filtered_history );
	$product->update_meta_data( '_hu_lowest_price_30_days', (string) $lowest );
}

add_action( 'woocommerce_before_product_object_save', 'hu_webshop_record_product_price_history', 10, 1 );

/**
 * Omnibus 30 napos legalacsonyabb ár megjelenítése a termékoldalon az akciós ár alatt
 */
add_action(
	'woocommerce_single_product_summary',
	function (): void {
		global $product;

		if ( ! $product instanceof \WC_Product || ! $product->is_on_sale() ) {
			return;
		}

		$lowest_30 = $product->get_meta( '_hu_lowest_price_30_days', true );

		// Ha még nincs egyedi 30 napos metaadat, a legalacsonyabb ismert árat (vagy akciós/normál árat) használjuk
		if ( '' === $lowest_30 || (float) $lowest_30 <= 0 ) {
			$lowest_30 = $product->get_sale_price() ?: $product->get_regular_price();
		}

		?>
		<div class="hu-omnibus-price-notice mt-1 mb-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
			<svg class="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
			</svg>
			<span>
				<?php
				printf(
					/* translators: %s: formatted lowest price in last 30 days */
					esc_html__( 'Az elmúlt 30 nap legalacsonyabb ára: %s', 'hu-webshop-core' ),
					'<strong class="font-bold">' . wp_kses_post( wc_price( (float) $lowest_30 ) ) . '</strong>'
				);
				?>
			</span>
		</div>
		<?php
	},
	11 // Közvetlenül a woocommerce_template_single_price (10-es prioritás) után!
);
