<?php
/**
 * Termékoldali Store API kiterjesztések (`extensions.kg_headless`):
 * - EU Omnibus 30 napos legalacsonyabb ár
 * - Várható szállítási idő (`_kg_delivery_time`, beszállítói/alapértelmezett fallback)
 * - Változatos termékek variációinak ára, készlete, képe és szállítási ideje
 *
 * @package KG_Headless
 */

declare(strict_types=1);

namespace KG_Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Product_Extensions {

	public const META_DELIVERY_TIME          = '_kg_delivery_time';
	public const META_SUPPLIER_DELIVERY_TIME = '_kg_supplier_delivery_time';
	public const OPTION_DEFAULT_DELIVERY     = 'kg_headless_default_delivery_time';

	public static function init(): void {
		add_action( 'woocommerce_blocks_loaded', array( self::class, 'register_store_api_extension' ) );
	}

	/**
	 * Termék vagy variáció várható szállítási idejének feloldása.
	 */
	public static function resolve_delivery_time( \WC_Product $product, ?\WC_Product $parent = null ): ?string {
		$own = trim( (string) $product->get_meta( self::META_DELIVERY_TIME, true ) );
		if ( '' !== $own ) {
			return $own;
		}

		if ( $parent ) {
			$parent_meta = trim( (string) $parent->get_meta( self::META_DELIVERY_TIME, true ) );
			if ( '' !== $parent_meta ) {
				return $parent_meta;
			}
		}

		$supplier_own = trim( (string) $product->get_meta( self::META_SUPPLIER_DELIVERY_TIME, true ) );
		if ( '' !== $supplier_own ) {
			return $supplier_own;
		}

		if ( $parent ) {
			$supplier_parent = trim( (string) $parent->get_meta( self::META_SUPPLIER_DELIVERY_TIME, true ) );
			if ( '' !== $supplier_parent ) {
				return $supplier_parent;
			}
		}

		if ( $product->is_on_backorder() ) {
			return 'Előrendelhető – várhatóan 5–7 munkanap';
		}

		if ( ! $product->is_in_stock() ) {
			return null;
		}

		$default_val = trim( (string) get_option( self::OPTION_DEFAULT_DELIVERY, '1–3 munkanap' ) );
		return '' !== $default_val ? $default_val : null;
	}

	/**
	 * Kép adatok kinyerése csatolmányból (Store API image séma kompatibilisen).
	 *
	 * @return array{id: int, src: string, thumbnail: string, alt: string, name: string}|null
	 */
	private static function format_image( int $image_id, string $fallback_name ): ?array {
		if ( $image_id <= 0 ) {
			return null;
		}

		$src = wp_get_attachment_image_url( $image_id, 'woocommerce_single' );
		if ( ! is_string( $src ) || '' === $src ) {
			$src = wp_get_attachment_url( $image_id );
		}
		if ( ! is_string( $src ) || '' === $src ) {
			return null;
		}

		$thumb = wp_get_attachment_image_url( $image_id, 'woocommerce_thumbnail' );
		$alt   = trim( (string) get_post_meta( $image_id, '_wp_attachment_image_alt', true ) );
		$title = get_the_title( $image_id );

		return array(
			'id'        => $image_id,
			'src'       => $src,
			'thumbnail' => is_string( $thumb ) && '' !== $thumb ? $thumb : $src,
			'alt'       => '' !== $alt ? $alt : $fallback_name,
			'name'      => is_string( $title ) && '' !== $title ? $title : $fallback_name,
		);
	}

	/**
	 * Variáció készlet küszöbellenőrzése (Store API low_stock_remaining logika).
	 */
	private static function get_low_stock_remaining( \WC_Product $product ): ?int {
		if ( ! $product->managing_stock() || ! $product->is_in_stock() ) {
			return null;
		}
		$qty = $product->get_stock_quantity();
		if ( null === $qty || $qty <= 0 ) {
			return null;
		}
		$threshold = function_exists( 'wc_get_low_stock_amount' )
			? (int) wc_get_low_stock_amount( $product )
			: (int) get_option( 'woocommerce_notify_low_stock_amount', 2 );

		return $qty <= $threshold ? (int) $qty : null;
	}

	/**
	 * Változatos termék összes publikált variációjának adatai.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_variations_data( \WC_Product $product, int $decimals, string $currency ): array {
		if ( ! $product->is_type( 'variable' ) || ! method_exists( $product, 'get_children' ) ) {
			return array();
		}

		$children = array_map( 'intval', $product->get_children() );
		// N+1 helyett egy lekérdezés: a variációk postjai és metái előre a cache-be kerülnek.
		if ( function_exists( '_prime_post_caches' ) && array() !== $children ) {
			_prime_post_caches( $children, false, true );
		}

		$out = array();
		foreach ( $children as $child_id ) {
			$variation = wc_get_product( (int) $child_id );
			if ( ! ( $variation instanceof \WC_Product_Variation ) ) {
				continue;
			}
			if ( 'publish' !== $variation->get_status() ) {
				continue;
			}

			$raw_active  = $variation->get_price();
			$raw_regular = $variation->get_regular_price();
			$raw_sale    = $variation->get_sale_price();

			if ( function_exists( 'wc_get_price_to_display' ) ) {
				$raw_active  = '' !== (string) $raw_active ? (string) wc_get_price_to_display( $variation, array( 'price' => $raw_active ) ) : $raw_active;
				$raw_regular = '' !== (string) $raw_regular ? (string) wc_get_price_to_display( $variation, array( 'price' => $raw_regular ) ) : $raw_regular;
				$raw_sale    = '' !== (string) $raw_sale ? (string) wc_get_price_to_display( $variation, array( 'price' => $raw_sale ) ) : $raw_sale;
			}

			$active_int  = Omnibus::parse_price_to_int( $raw_active, $decimals ) ?? 0;
			$regular_int = Omnibus::parse_price_to_int( $raw_regular, $decimals ) ?? $active_int;
			$sale_int    = Omnibus::parse_price_to_int( $raw_sale, $decimals );
			$is_on_sale  = (bool) $variation->is_on_sale() && null !== $sale_int && $sale_int > 0 && $sale_int < $regular_int;

			$attrs = array();
			foreach ( $variation->get_variation_attributes( false ) as $attr_key => $term_slug ) {
				$taxonomy  = str_starts_with( (string) $attr_key, 'attribute_' )
					? substr( (string) $attr_key, strlen( 'attribute_' ) )
					: (string) $attr_key;
				$attr_name = function_exists( 'wc_attribute_label' )
					? wc_attribute_label( $taxonomy, $product )
					: $taxonomy;

				$value_label = (string) $term_slug;
				if ( '' !== $term_slug && taxonomy_exists( $taxonomy ) ) {
					$term = get_term_by( 'slug', (string) $term_slug, $taxonomy );
					if ( $term instanceof \WP_Term ) {
						$value_label = $term->name;
					}
				}

				$attrs[] = array(
					'name'     => (string) $attr_name,
					'taxonomy' => (string) $taxonomy,
					'value'    => $value_label,
					'slug'     => (string) $term_slug,
				);
			}

			$image_id = (int) $variation->get_image_id();
			if ( $image_id <= 0 ) {
				$image_id = (int) $product->get_image_id();
			}

			$out[] = array(
				'id'                   => (int) $variation->get_id(),
				'sku'                  => (string) $variation->get_sku(),
				'attributes'           => $attrs,
				'prices'               => array(
					'price'               => (string) $active_int,
					'regular_price'       => (string) $regular_int,
					'sale_price'          => (string) ( $is_on_sale && null !== $sale_int ? $sale_int : $regular_int ),
					'currency_code'       => $currency,
					'currency_minor_unit' => $decimals,
				),
				'on_sale'              => $is_on_sale,
				'lowest_price_30_days' => Omnibus::get_lowest_price_for_product( $variation ),
				'is_in_stock'          => (bool) $variation->is_in_stock(),
				'is_on_backorder'      => (bool) $variation->is_on_backorder(),
				'is_purchasable'       => (bool) $variation->is_purchasable(),
				'low_stock_remaining'  => self::get_low_stock_remaining( $variation ),
				'delivery_time'        => self::resolve_delivery_time( $variation, $product ),
				'image'                => self::format_image( $image_id, $variation->get_name() ),
			);
		}

		return $out;
	}

	/**
	 * Store API `/wp-json/wc/store/v1/products` kiterjesztés regisztrálása (`extensions.kg_headless`).
	 */
	public static function register_store_api_extension(): void {
		if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			return;
		}

		if ( ! class_exists( \Automattic\WooCommerce\StoreApi\Schemas\V1\ProductSchema::class ) ) {
			return;
		}

		woocommerce_store_api_register_endpoint_data(
			array(
				'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\ProductSchema::IDENTIFIER,
				'namespace'       => 'kg_headless',
				'data_callback'   => function ( \WC_Product $product ): array {
					$decimals = function_exists( 'wc_get_price_decimals' ) ? wc_get_price_decimals() : 0;
					$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'HUF';
					return array(
						'lowest_price_30_days' => Omnibus::get_lowest_price_for_product( $product ),
						'is_on_sale'           => (bool) $product->is_on_sale(),
						'currency_minor_unit'  => $decimals,
						'delivery_time'        => self::resolve_delivery_time( $product ),
						'variations'           => self::get_variations_data( $product, $decimals, $currency ),
					);
				},
				'schema_callback' => function (): array {
					return array(
						'lowest_price_30_days' => array(
							'description' => __( 'Az akció kezdete előtti 30 nap legalacsonyabb ára minor unitban (EU Omnibus).', 'kg-headless' ),
							'type'        => array( 'integer', 'null' ),
							'context'     => array( 'view', 'edit' ),
							'readonly'    => true,
						),
						'is_on_sale'           => array(
							'description' => __( 'Jelzi, hogy a termék jelenleg akciós-e.', 'kg-headless' ),
							'type'        => 'boolean',
							'context'     => array( 'view', 'edit' ),
							'readonly'    => true,
						),
						'currency_minor_unit'  => array(
							'description' => __( 'A pénznem minor unit tizedesjegyeinek száma.', 'kg-headless' ),
							'type'        => 'integer',
							'context'     => array( 'view', 'edit' ),
							'readonly'    => true,
						),
						'delivery_time'        => array(
							'description' => __( 'Várható szállítási idő szövege.', 'kg-headless' ),
							'type'        => array( 'string', 'null' ),
							'context'     => array( 'view', 'edit' ),
							'readonly'    => true,
						),
						'variations'           => array(
							'description' => __( 'Változatos termékek variációinak részletes adatai.', 'kg-headless' ),
							'type'        => 'array',
							'context'     => array( 'view', 'edit' ),
							'readonly'    => true,
						),
					);
				},
				'schema_type'     => ARRAY_A,
			)
		);
	}
}
