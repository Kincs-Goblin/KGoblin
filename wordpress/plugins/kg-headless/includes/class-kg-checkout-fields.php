<?php
/**
 * Store API Checkout mezők, magyar céges számla / adószám validáció és
 * kötelező jogi nyilatkozatok (ÁSZF, fizetési kötelezettség) kezelése.
 *
 * HPOS-kompatibilis mentés a WC_Order objektumon keresztül.
 *
 * @package KG_Headless
 */

declare(strict_types=1);

namespace KG_Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Checkout_Fields {

	/**
	 * Magyar adószám regex: 12345678-1-42 vagy 11 számjegy egyben.
	 */
	public const TAX_NUMBER_PATTERN = '/^(\d{8}-[1-5]-\d{2}|\d{11})$/';

	/**
	 * Hookok regisztrálása.
	 */
	public static function init(): void {
		add_action( 'woocommerce_init', array( self::class, 'register_additional_checkout_fields' ) );
		add_action( 'woocommerce_blocks_loaded', array( self::class, 'register_store_api_checkout_extension' ) );
		add_action(
			'woocommerce_store_api_checkout_update_order_from_request',
			array( self::class, 'validate_and_save_store_api_checkout' ),
			10,
			2
		);
		// Védelem a klasszikus `?wc-ajax=checkout` végpont ellen: a headless backend kizárólag a Store API-n fogad el rendelést
		add_action(
			'woocommerce_checkout_process',
			array( self::class, 'block_classic_checkout_bypass' ),
			1
		);
		add_action(
			'woocommerce_admin_order_data_after_billing_address',
			array( self::class, 'render_admin_order_meta' )
		);
	}

	/**
	 * Blokkolja a klasszikus `?wc-ajax=checkout` végponton érkező rendelés-leadási kísérleteket,
	 * hogy ne lehessen megkerülni a Store API jogi és adószám-validációját.
	 */
	public static function block_classic_checkout_bypass(): void {
		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice(
				__( 'A klasszikus pénztár le van tiltva ezen a headless végponton. Kérjük, használd a Store API-t (/wp-json/wc/store/v1/checkout).', 'kg-headless' ),
				'error'
			);
		}
	}

	/**
	 * Magyar adószám formátum-ellenőrzése.
	 *
	 * @param string $tax_number Adószám sztring.
	 * @return bool Érvényes-e.
	 */
	public static function is_valid_hungarian_tax_number( string $tax_number ): bool {
		$trimmed = trim( $tax_number );
		if ( '' === $trimmed ) {
			return false;
		}
		return (bool) preg_match( self::TAX_NUMBER_PATTERN, $trimmed );
	}

	/**
	 * WooCommerce Additional Checkout Fields API regisztráció (WC 8.9+).
	 * Ezek a mezők a Store API `/checkout` `additional_fields` objektumában is megjelennek,
	 * de a kötelezőséget és a feltételes logikát a `validate_and_save_store_api_checkout`
	 * kényszeríti ki egységesen, hogy mind az `additional_fields`, mind az `extensions.kg_headless`
	 * formátumot támogassuk.
	 */
	public static function register_additional_checkout_fields(): void {
		if ( ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
			return;
		}

		woocommerce_register_additional_checkout_field(
			array(
				'id'       => 'kg-headless/is_company',
				'label'    => __( 'Céges számlát kérek', 'kg-headless' ),
				'location' => 'address',
				'type'     => 'checkbox',
				'required' => false,
			)
		);

		woocommerce_register_additional_checkout_field(
			array(
				'id'       => 'kg-headless/company_name',
				'label'    => __( 'Cégnév', 'kg-headless' ),
				'location' => 'address',
				'type'     => 'text',
				'required' => false,
			)
		);

		woocommerce_register_additional_checkout_field(
			array(
				'id'       => 'kg-headless/tax_number',
				'label'    => __( 'Magyar adószám (pl. 12345678-2-42)', 'kg-headless' ),
				'location' => 'address',
				'type'     => 'text',
				'required' => false,
			)
		);

		woocommerce_register_additional_checkout_field(
			array(
				'id'       => 'kg-headless/accept_terms',
				'label'    => __( 'Elolvastam és elfogadom az ÁSZF-et és az Adatkezelési tájékoztatót', 'kg-headless' ),
				'location' => 'order',
				'type'     => 'checkbox',
				'required' => false,
			)
		);

		woocommerce_register_additional_checkout_field(
			array(
				'id'       => 'kg-headless/accept_payment_obligation',
				'label'    => __( 'Tudomásul veszem, hogy a megrendelés fizetési kötelezettséggel jár', 'kg-headless' ),
				'location' => 'order',
				'type'     => 'checkbox',
				'required' => false,
			)
		);
	}

	/**
	 * Store API `/checkout` `extensions.kg_headless` séma regisztrációja,
	 * hogy a WooCommerce Store API elfogadja az `extensions.kg_headless` payloadot is.
	 */
	public static function register_store_api_checkout_extension(): void {
		if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			return;
		}

		if ( ! class_exists( \Automattic\WooCommerce\StoreApi\Schemas\V1\CheckoutSchema::class ) ) {
			return;
		}

		woocommerce_store_api_register_endpoint_data(
			array(
				'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\CheckoutSchema::IDENTIFIER,
				'namespace'       => 'kg_headless',
				'data_callback'   => function (): array {
					return array(
						'is_company'                => false,
						'company_name'              => '',
						'tax_number'                => '',
						'accept_terms'              => false,
						'accept_payment_obligation' => false,
					);
				},
				'schema_callback' => function (): array {
					return array(
						'is_company'                => array(
							'description' => __( 'Céges számla igénylése.', 'kg-headless' ),
							'type'        => array( 'boolean', 'null' ),
							'context'     => array( 'view', 'edit' ),
						),
						'company_name'              => array(
							'description' => __( 'Cégnév céges számla esetén.', 'kg-headless' ),
							'type'        => array( 'string', 'null' ),
							'context'     => array( 'view', 'edit' ),
						),
						'tax_number'                => array(
							'description' => __( 'Magyar adószám (12345678-2-42).', 'kg-headless' ),
							'type'        => array( 'string', 'null' ),
							'context'     => array( 'view', 'edit' ),
						),
						'accept_terms'              => array(
							'description' => __( 'ÁSZF és Adatkezelési tájékoztató elfogadása.', 'kg-headless' ),
							'type'        => array( 'boolean', 'null' ),
							'context'     => array( 'view', 'edit' ),
						),
						'accept_payment_obligation' => array(
							'description' => __( 'Fizetési kötelezettség tudomásulvétele.', 'kg-headless' ),
							'type'        => array( 'boolean', 'null' ),
							'context'     => array( 'view', 'edit' ),
						),
					);
				},
				'schema_type'     => ARRAY_A,
			)
		);
	}

	/**
	 * Kinyeri a checkout mezőket a WP_REST_Request-ből (támogatja az `extensions.kg_headless`
	 * és az `additional_fields` vagy `billing_address` alatt érkező kulcsokat is).
	 *
	 * @param \WP_REST_Request $request Store API checkout kérés.
	 * @return array{is_company: bool, company_name: string, tax_number: string, accept_terms: bool, accept_payment_obligation: bool, has_company_payload: bool}
	 */
	public static function extract_checkout_payload( \WP_REST_Request $request ): array {
		$extensions        = $request->get_param( 'extensions' );
		$ext_data          = ( is_array( $extensions ) && isset( $extensions['kg_headless'] ) && is_array( $extensions['kg_headless'] ) )
			? $extensions['kg_headless']
			: array();
		$additional_fields = $request->get_param( 'additional_fields' );
		$add_data          = is_array( $additional_fields ) ? $additional_fields : array();
		$billing_address   = $request->get_param( 'billing_address' );
		$bill_data         = is_array( $billing_address ) ? $billing_address : array();

		$get_field = function ( string $short_key ) use ( $ext_data, $add_data, $bill_data ) {
			if ( array_key_exists( $short_key, $ext_data ) ) {
				return $ext_data[ $short_key ];
			}
			if ( array_key_exists( 'kg-headless/' . $short_key, $add_data ) ) {
				return $add_data[ 'kg-headless/' . $short_key ];
			}
			if ( array_key_exists( 'kg_headless/' . $short_key, $add_data ) ) {
				return $add_data[ 'kg_headless/' . $short_key ];
			}
			if ( array_key_exists( 'kg-headless/' . $short_key, $bill_data ) ) {
				return $bill_data[ 'kg-headless/' . $short_key ];
			}
			return null;
		};

		$to_bool = function ( $val ): bool {
			if ( is_bool( $val ) ) {
				return $val;
			}
			if ( is_numeric( $val ) ) {
				return 1 === (int) $val;
			}
			if ( is_string( $val ) ) {
				return in_array( strtolower( trim( $val ) ), array( 'true', '1', 'yes', 'on' ), true );
			}
			return false;
		};

		$raw_is_company      = $get_field( 'is_company' );
		$company_from_billing = isset( $bill_data['company'] ) ? sanitize_text_field( (string) $bill_data['company'] ) : '';
		$raw_company_name     = $get_field( 'company_name' );
		$company_name         = null !== $raw_company_name
			? sanitize_text_field( (string) $raw_company_name )
			: $company_from_billing;

		$raw_tax    = $get_field( 'tax_number' );
		$tax_number = null !== $raw_tax ? sanitize_text_field( (string) $raw_tax ) : '';

		return array(
			'is_company'                => $to_bool( $raw_is_company ),
			'company_name'              => trim( $company_name ),
			'tax_number'                => trim( $tax_number ),
			'accept_terms'              => $to_bool( $get_field( 'accept_terms' ) ),
			'accept_payment_obligation' => $to_bool( $get_field( 'accept_payment_obligation' ) ),
			'has_company_payload'       => ( null !== $raw_is_company || null !== $raw_company_name || null !== $raw_tax ),
		);
	}

	/**
	 * Store API Checkout validáció és HPOS-kompatibilis rendelés-meta mentés.
	 *
	 * - Részleges draft-frissítésnél (`PUT` / `PATCH`) nem követeli meg a végső jogi nyilatkozatokat,
	 *   csak a végleges rendelés-leadáskor (`POST /wp-json/wc/store/v1/checkout`).
	 * - Hibás adószám vagy hiányzó jogi elfogadás esetén RouteException (HTTP 400) dobódik.
	 *
	 * @param \WC_Order        $order   A létrehozás/frissítés alatt álló rendelés.
	 * @param \WP_REST_Request $request A Store API `/checkout` kérés.
	 * @throws \Automattic\WooCommerce\StoreApi\Exceptions\RouteException HTTP 400 validációs hiba esetén.
	 */
	public static function validate_and_save_store_api_checkout( \WC_Order $order, \WP_REST_Request $request ): void {
		$method  = strtoupper( $request->get_method() );
		$payload = self::extract_checkout_payload( $request );

		// PUT/PATCH részleges draft-frissítés esetén csak akkor mentünk/ellenőrzünk cégadatot, ha küldték,
		// a kötelező jogi elfogadást pedig kizárólag végleges rendelés-leadáskor (POST) kényszerítjük ki.
		if ( 'POST' !== $method ) {
			if ( $payload['has_company_payload'] ) {
				if ( $payload['is_company'] ) {
					$order->set_billing_company( $payload['company_name'] );
					$order->update_meta_data( '_billing_is_company', 'yes' );
					$order->update_meta_data( '_billing_company_name', $payload['company_name'] );
					$order->update_meta_data( '_billing_tax_number', $payload['tax_number'] );
				} else {
					$order->update_meta_data( '_billing_is_company', 'no' );
				}
			}
			return;
		}

		// 1. Kötelező jogi nyilatkozatok ellenőrzése (POST)
		if ( ! $payload['accept_terms'] ) {
			self::throw_checkout_error(
				'kg_terms_not_accepted',
				__( 'A rendelés leadásához el kell fogadnod az Általános Szerződési Feltételeket (ÁSZF) és az Adatkezelési tájékoztatót.', 'kg-headless' )
			);
		}

		if ( ! $payload['accept_payment_obligation'] ) {
			self::throw_checkout_error(
				'kg_payment_obligation_not_accepted',
				__( 'A rendelés leadásához tudomásul kell venned, hogy a megrendelés elküldése fizetési kötelezettséggel jár.', 'kg-headless' )
			);
		}

		// 2. Céges számla és magyar adószám ellenőrzése
		if ( $payload['is_company'] ) {
			if ( '' === $payload['company_name'] ) {
				self::throw_checkout_error(
					'kg_missing_company_name',
					__( 'Céges számla igénylése esetén a cégnév megadása kötelező.', 'kg-headless' )
				);
			}

			if ( '' === $payload['tax_number'] ) {
				self::throw_checkout_error(
					'kg_missing_tax_number',
					__( 'Céges számla igénylése esetén a magyar adószám megadása kötelező.', 'kg-headless' )
				);
			}

			if ( ! self::is_valid_hungarian_tax_number( $payload['tax_number'] ) ) {
				self::throw_checkout_error(
					'kg_invalid_tax_number',
					__( 'A megadott magyar adószám formátuma érvénytelen. Helyes formátum: 12345678-2-42.', 'kg-headless' )
				);
			}

			$order->set_billing_company( $payload['company_name'] );
			$order->update_meta_data( '_billing_is_company', 'yes' );
			$order->update_meta_data( '_billing_company_name', $payload['company_name'] );
			$order->update_meta_data( '_billing_tax_number', $payload['tax_number'] );
		} else {
			$order->update_meta_data( '_billing_is_company', 'no' );
		}

		// 3. Jogi elfogadás és időpont mentése HPOS-kompatibilisen
		$accepted_at = gmdate( 'Y-m-d\TH:i:s\Z' );
		$order->update_meta_data( '_hu_accepted_terms_privacy', 'yes' );
		$order->update_meta_data( '_hu_accepted_payment_obligation', 'yes' );
		$order->update_meta_data( '_hu_legal_accepted_at', $accepted_at );
	}

	/**
	 * Store API RouteException dobása 400-as HTTP státusszal.
	 *
	 * @param string $error_code Hibakód.
	 * @param string $message    Felhasználóbarát magyar hibaüzenet.
	 * @throws \Automattic\WooCommerce\StoreApi\Exceptions\RouteException Mindig.
	 */
	private static function throw_checkout_error( string $error_code, string $message ): void {
		if ( class_exists( \Automattic\WooCommerce\StoreApi\Exceptions\RouteException::class ) ) {
			throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
				$error_code,
				$message,
				400
			);
		}

		wp_send_json(
			array(
				'code'    => $error_code,
				'message' => $message,
				'data'    => array( 'status' => 400 ),
			),
			400
		);
	}

	/**
	 * Admin rendelés nézetben a céges adószám és a jogi elfogadás időpontjának megjelenítése (HPOS-kompatibilisen).
	 *
	 * @param \WC_Order|int $order_or_id Rendelés objektum vagy azonosító.
	 */
	public static function render_admin_order_meta( $order_or_id ): void {
		$order = $order_or_id instanceof \WC_Order ? $order_or_id : wc_get_order( $order_or_id );
		if ( ! $order ) {
			return;
		}

		$tax_number  = (string) $order->get_meta( '_billing_tax_number', true );
		$accepted_at = (string) $order->get_meta( '_hu_legal_accepted_at', true );

		if ( '' !== $tax_number ) {
			echo '<p><strong>' . esc_html__( 'Magyar adószám:', 'kg-headless' ) . '</strong> ' . esc_html( $tax_number ) . '</p>';
		}

		if ( '' !== $accepted_at ) {
			echo '<p><strong>' . esc_html__( 'Jogi nyilatkozatok elfogadva:', 'kg-headless' ) . '</strong> ' . esc_html( $accepted_at ) . '</p>';
		}
	}
}
