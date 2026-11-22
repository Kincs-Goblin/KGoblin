<?php
/**
 * Megváltozott termék-slugok feloldása (`_wp_old_slug` post_meta alapján) a headless storefront 301-es átirányításához.
 *
 * Végpont: `GET /wp-json/kg/v1/redirects?type=product&slug=<regi-slug>`
 *
 * @package KG_Headless
 */

declare(strict_types=1);

namespace KG_Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Slug_Redirects {

	public static function init(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			'kg/v1',
			'/redirects',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'handle_lookup' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'type' => array(
						'required'          => true,
						'type'              => 'string',
						'enum'              => array( 'product' ),
						'sanitize_callback' => 'sanitize_key',
					),
					'slug' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_title',
						'validate_callback' => static function ( mixed $value ): bool {
							return is_string( $value ) && '' !== trim( $value ) && strlen( $value ) <= 200;
						},
					),
				),
			)
		);
	}

	public static function handle_lookup( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;

		$type = (string) $request->get_param( 'type' );
		$slug = sanitize_title( (string) $request->get_param( 'slug' ) );

		if ( 'product' !== $type || '' === $slug ) {
			return new \WP_REST_Response(
				array(
					'found'  => false,
					'type'   => 'product',
					'from'   => $slug,
					'to'     => null,
					'status' => null,
				),
				200
			);
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$target_slug = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT p.post_name
				 FROM {$wpdb->posts} p
				 INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
				 WHERE pm.meta_key = '_wp_old_slug'
				   AND pm.meta_value = %s
				   AND p.post_type = 'product'
				   AND p.post_status = 'publish'
				 ORDER BY p.post_modified_gmt DESC
				 LIMIT 1",
				$slug
			)
		);

		if ( is_string( $target_slug ) && '' !== $target_slug && $target_slug !== $slug ) {
			return new \WP_REST_Response(
				array(
					'found'  => true,
					'type'   => 'product',
					'from'   => $slug,
					'to'     => $target_slug,
					'status' => 301,
				),
				200
			);
		}

		return new \WP_REST_Response(
			array(
				'found'  => false,
				'type'   => 'product',
				'from'   => $slug,
				'to'     => null,
				'status' => null,
			),
			200
		);
	}
}
