<?php
/**
 * Egyedi Termékarchívum / Bolt oldal (woocommerce/archive-product.php)
 *
 * @package Custom_Shop
 * @version 8.6.0
 */

defined( 'ABSPATH' ) || exit;

get_header( 'shop' );
?>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
	<!-- Bolt Fejléc -->
	<header class="mb-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
		<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
			<div>
				<?php if ( apply_filters( 'woocommerce_show_page_title', true ) ) : ?>
					<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
						<?php woocommerce_page_title(); ?>
					</h1>
				<?php endif; ?>
				<div class="mt-2 text-sm text-slate-600">
					<?php do_action( 'woocommerce_archive_description' ); ?>
				</div>
			</div>

			<!-- Kategória szűrő gombok -->
			<?php
			$product_categories = get_terms(
				array(
					'taxonomy'   => 'product_cat',
					'hide_empty' => true,
					'exclude'    => array( (int) get_option( 'default_product_cat' ) ),
				)
			);
			if ( ! is_wp_error( $product_categories ) && ! empty( $product_categories ) ) :
				$shop_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/bolt/' );
				?>
				<div class="flex flex-wrap items-center gap-2">
					<a
						href="<?php echo esc_url( $shop_url ); ?>"
						class="rounded-xl px-3.5 py-2 text-xs font-bold transition <?php echo is_shop() && ! is_product_category() ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'; ?>"
					>
						Összes
					</a>
					<?php foreach ( $product_categories as $cat ) : ?>
						<a
							href="<?php echo esc_url( get_term_link( $cat ) ); ?>"
							class="rounded-xl px-3.5 py-2 text-xs font-bold transition <?php echo is_product_category( $cat->slug ) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'; ?>"
						>
							<?php echo esc_html( $cat->name ); ?>
						</a>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>
		</div>
	</header>

	<?php if ( woocommerce_product_loop() ) : ?>
		<!-- Találatok száma és rendezés -->
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
			<?php do_action( 'woocommerce_before_shop_loop' ); ?>
		</div>

		<!-- Termék rács -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<?php
			if ( wc_get_loop_prop( 'total' ) ) {
				while ( have_posts() ) {
					the_post();
					do_action( 'woocommerce_shop_loop' );

					global $product;
					if ( ! $product instanceof WC_Product ) {
						continue;
					}
					?>
					<article <?php wc_product_class( 'group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-500 hover:shadow-lg transition', $product ); ?>>
						<div>
							<div class="relative mb-4 overflow-hidden rounded-xl bg-slate-100 aspect-square flex items-center justify-center">
								<?php if ( $product->is_on_sale() ) : ?>
									<span class="absolute top-3 left-3 z-10 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-xs">
										Akció
									</span>
								<?php endif; ?>
								<a href="<?php the_permalink(); ?>" class="block w-full h-full">
									<?php echo $product->get_image( 'woocommerce_thumbnail', array( 'class' => 'w-full h-full object-cover group-hover:scale-105 transition duration-300' ) ); ?>
								</a>
							</div>

							<div class="space-y-1.5">
								<h2 class="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2">
									<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
								</h2>
								<p class="text-xs text-slate-500 line-clamp-2">
									<?php echo esc_html( wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ) ); ?>
								</p>
							</div>
						</div>

						<div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
							<div class="text-base font-extrabold text-slate-900 [&_del]:text-xs [&_del]:text-slate-400 [&_del]:font-normal [&_ins]:no-underline [&_ins]:text-rose-600">
								<?php echo wp_kses_post( $product->get_price_html() ); ?>
							</div>

							<?php
							echo apply_filters(
								'woocommerce_loop_add_to_cart_link',
								sprintf(
									'<a href="%s" data-quantity="1" class="%s inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition" %s>%s</a>',
									esc_url( $product->add_to_cart_url() ),
									esc_attr( 'button product_type_' . $product->get_type() . ( $product->is_purchasable() && $product->is_in_stock() ? ' add_to_cart_button ajax_add_to_cart' : '' ) ),
									wc_implode_html_attributes(
										array(
											'data-product_id'  => $product->get_id(),
											'data-product_sku' => $product->get_sku(),
											'aria-label'       => $product->add_to_cart_description(),
											'rel'              => 'nofollow',
										)
									),
									esc_html( $product->add_to_cart_text() )
								),
								$product
							);
							?>
						</div>
					</article>
					<?php
				}
			}
			?>
		</div>

		<div class="mt-10">
			<?php do_action( 'woocommerce_after_shop_loop' ); ?>
		</div>
	<?php else : ?>
		<?php do_action( 'woocommerce_no_products_found' ); ?>
	<?php endif; ?>
</div>

<?php
get_footer( 'shop' );
