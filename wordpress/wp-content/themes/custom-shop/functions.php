<?php
/**
 * Custom Shop Theme Functions
 *
 * @package Custom_Shop
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CUSTOM_SHOP_VERSION', '1.0.0' );
define( 'CUSTOM_SHOP_FREE_SHIPPING_THRESHOLD', 25000 );

/**
 * Téma alapbeállítások és WooCommerce támogatás
 */
function custom_shop_setup(): void {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support(
		'html5',
		array(
			'search-form',
			'comment-form',
			'comment-list',
			'gallery',
			'caption',
			'style',
			'script',
		)
	);
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	// Teljes WooCommerce támogatás + Galéria funkciók
	add_theme_support(
		'woocommerce',
		array(
			'thumbnail_image_width' => 450,
			'single_image_width'    => 700,
			'product_grid'          => array(
				'default_rows'    => 3,
				'min_rows'        => 1,
				'max_rows'        => 8,
				'default_columns' => 4,
				'min_columns'     => 1,
				'max_columns'     => 4,
			),
		)
	);
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );

	register_nav_menus(
		array(
			'primary'      => __( 'Főmenü', 'custom-shop' ),
			'footer-legal' => __( 'Lábléc jogi linkek', 'custom-shop' ),
		)
	);
}
add_action( 'after_setup_theme', 'custom_shop_setup' );

/**
 * Stíluslapok és szkriptek betöltése
 */
function custom_shop_enqueue_assets(): void {
	$output_css_path = get_template_directory() . '/dist/output.css';
	$version         = file_exists( $output_css_path ) ? (string) filemtime( $output_css_path ) : CUSTOM_SHOP_VERSION;

	wp_enqueue_style(
		'custom-shop-tailwind',
		get_template_directory_uri() . '/dist/output.css',
		array(),
		$version
	);

	wp_enqueue_style(
		'custom-shop-style',
		get_stylesheet_uri(),
		array( 'custom-shop-tailwind' ),
		CUSTOM_SHOP_VERSION
	);

	if ( function_exists( 'is_woocommerce' ) ) {
		wp_enqueue_script( 'wc-cart-fragments' );
	}
}
add_action( 'wp_enqueue_scripts', 'custom_shop_enqueue_assets' );

/**
 * Élő AJAX kosár számláló és összeg frissítés (WooCommerce Cart Fragments)
 *
 * @param array $fragments Kosár HTML töredékek.
 * @return array
 */
function custom_shop_cart_fragments( array $fragments ): array {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return $fragments;
	}

	$count = WC()->cart->get_cart_contents_count();
	$total = WC()->cart->get_cart_subtotal();

	ob_start();
	?>
	<span id="header-cart-count" class="custom-cart-count inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
		<?php echo esc_html( (string) $count ); ?>
	</span>
	<?php
	$fragments['#header-cart-count'] = ob_get_clean();

	ob_start();
	?>
	<span id="header-cart-total" class="custom-cart-total hidden text-sm font-semibold text-slate-700 sm:inline">
		<?php echo wp_kses_post( $total ); ?>
	</span>
	<?php
	$fragments['#header-cart-total'] = ob_get_clean();

	return $fragments;
}
add_filter( 'woocommerce_add_to_cart_fragments', 'custom_shop_cart_fragments' );

/**
 * Ingyenes szállítási küszöb sáv generálása a kosár és pénztár oldalakra
 */
function custom_shop_render_free_shipping_bar(): void {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return;
	}

	$threshold = (float) apply_filters( 'custom_shop_free_shipping_threshold', CUSTOM_SHOP_FREE_SHIPPING_THRESHOLD );
	$current   = (float) WC()->cart->get_displayed_subtotal();

	if ( $current <= 0 ) {
		return;
	}

	$remaining  = max( 0.0, $threshold - $current );
	$percentage = min( 100, (int) round( ( $current / $threshold ) * 100 ) );
	$is_free    = $remaining <= 0;
	?>
	<div class="custom-free-shipping-bar mb-8 rounded-2xl border <?php echo $is_free ? 'border-emerald-200 bg-emerald-50/90' : 'border-indigo-100 bg-white'; ?> p-5 shadow-sm transition-all">
		<div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-2.5 text-sm sm:text-base font-semibold <?php echo $is_free ? 'text-emerald-900' : 'text-slate-900'; ?>">
				<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl <?php echo $is_free ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'; ?>">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
					</svg>
				</span>
				<?php if ( $is_free ) : ?>
					<span>Gratulálunk! Jogosult vagy az <strong>ingyenes házhozszállításra</strong>! 🎉</span>
				<?php else : ?>
					<span>
						Még <strong class="text-indigo-600 font-extrabold"><?php echo wp_kses_post( wc_price( $remaining ) ); ?></strong> hiányzik az <strong>ingyenes szállításhoz</strong>!
					</span>
				<?php endif; ?>
			</div>
			<span class="text-xs font-bold uppercase tracking-wider <?php echo $is_free ? 'text-emerald-700' : 'text-indigo-600'; ?>">
				<?php echo esc_html( (string) $percentage ); ?>%
			</span>
		</div>
		<div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
			<div
				class="h-full rounded-full transition-all duration-500 <?php echo $is_free ? 'bg-emerald-600' : 'bg-indigo-600'; ?>"
				style="width: <?php echo esc_attr( (string) $percentage ); ?>%;"
			></div>
		</div>
	</div>
	<?php
}
add_action( 'woocommerce_before_cart', 'custom_shop_render_free_shipping_bar', 5 );
add_action( 'woocommerce_before_checkout_form', 'custom_shop_render_free_shipping_bar', 5 );
