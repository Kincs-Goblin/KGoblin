<?php
/**
 * Főoldal sablon (front-page.php)
 *
 * @package Custom_Shop
 */

get_header();

$shop_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/bolt/' );
?>

<!-- Hero Szekció -->
<section class="relative overflow-hidden bg-slate-900 text-white">
	<div class="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 opacity-95"></div>
	<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
		<div class="max-w-3xl space-y-6">
			<span class="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-4 py-1.5 text-xs sm:text-sm font-semibold text-indigo-300">
				✨ Új kollekció és szezonális kedvezmények
			</span>
			<h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
				Minőségi termékek a mindennapokra, <span class="text-indigo-400">villámgyors</span> szállítással.
			</h1>
			<p class="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl">
				Fedezd fel gondosan válogatott kínálatunkat! 25 000 Ft felett díjmentesen házhoz visszük csomagodat Magyarország egész területén.
			</p>
			<div class="pt-2 flex flex-wrap items-center gap-4">
				<a
					href="<?php echo esc_url( $shop_url ); ?>"
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
				>
					<span>Vásárlás megkezdése</span>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
				</a>
				<a
					href="#kiemelt-termekek"
					class="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 px-6 py-4 text-base font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
				>
					Kiemelt ajánlatok
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Előnyök sáv -->
<section class="border-b border-slate-200 bg-white">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			<div class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">🚚</div>
				<div>
					<h2 class="text-base font-bold text-slate-900">1-2 napos szállítás</h2>
					<p class="text-sm text-slate-600 mt-0.5">Saját hazai raktárról, azonnal indítjuk a rendelésed.</p>
				</div>
			</div>
			<div class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">🛡️</div>
				<div>
					<h2 class="text-base font-bold text-slate-900">100% Magyar Garancia</h2>
					<p class="text-sm text-slate-600 mt-0.5">Hivatalos számla, 14 napos indoklás nélküli elállás.</p>
				</div>
			</div>
			<div class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50">
				<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">💳</div>
				<div>
					<h2 class="text-base font-bold text-slate-900">Rugalmas fizetés</h2>
					<p class="text-sm text-slate-600 mt-0.5">Bankkártya, előre utalás vagy utánvétes fizetés a futárnál.</p>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Termékkategóriák -->
<?php
if ( function_exists( 'wc_get_products' ) ) :
	$categories = get_terms(
		array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
			'exclude'    => array( (int) get_option( 'default_product_cat' ) ),
		)
	);
	if ( ! is_wp_error( $categories ) && ! empty( $categories ) ) :
		?>
		<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
			<div class="flex items-end justify-between mb-8">
				<div>
					<h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Népszerű kategóriák</h2>
					<p class="text-sm sm:text-base text-slate-600 mt-1">Válogass termékkategóriáink szerint</p>
				</div>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
				<?php foreach ( $categories as $cat ) : ?>
					<a
						href="<?php echo esc_url( get_term_link( $cat ) ); ?>"
						class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-600 hover:shadow-md transition flex items-center justify-between"
					>
						<div>
							<h3 class="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
								<?php echo esc_html( $cat->name ); ?>
							</h3>
							<p class="text-sm text-slate-500 mt-1">
								<?php echo esc_html( (string) $cat->count ); ?> termék
							</p>
						</div>
						<span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition">
							&rarr;
						</span>
					</a>
				<?php endforeach; ?>
			</div>
		</section>
		<?php
	endif;
endif;
?>

<!-- Kiemelt / Legújabb Termékek -->
<section id="kiemelt-termekek" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
	<div class="flex flex-wrap items-end justify-between gap-4 mb-8">
		<div>
			<h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900">Kiemelt termékeink</h2>
			<p class="text-sm sm:text-base text-slate-600 mt-1">Legnépszerűbb és akciós ajánlataink raktárról</p>
		</div>
		<a href="<?php echo esc_url( $shop_url ); ?>" class="text-sm font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
			<span>Összes termék megtekintése</span>
			<span>&rarr;</span>
		</a>
	</div>

	<?php
	if ( function_exists( 'wc_get_products' ) ) :
		$products = wc_get_products(
			array(
				'status'  => 'publish',
				'limit'   => 8,
				'orderby' => 'date',
				'order'   => 'DESC',
			)
		);

		if ( ! empty( $products ) ) :
			?>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
				<?php
				foreach ( $products as $product ) :
					$post_object = get_post( $product->get_id() );
					setup_postdata( $GLOBALS['post'] =& $post_object );
					?>
					<article class="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-500 hover:shadow-lg transition">
						<div>
							<div class="relative mb-4 overflow-hidden rounded-xl bg-slate-100 aspect-square flex items-center justify-center">
								<?php if ( $product->is_on_sale() ) : ?>
									<span class="absolute top-3 left-3 z-10 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-xs">
										Akció
									</span>
								<?php endif; ?>
								<a href="<?php echo esc_url( $product->get_permalink() ); ?>" class="block w-full h-full">
									<?php echo $product->get_image( 'woocommerce_thumbnail', array( 'class' => 'w-full h-full object-cover group-hover:scale-105 transition duration-300' ) ); ?>
								</a>
							</div>

							<div class="space-y-1.5">
								<h3 class="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2">
									<a href="<?php echo esc_url( $product->get_permalink() ); ?>">
										<?php echo esc_html( $product->get_name() ); ?>
									</a>
								</h3>
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
				endforeach;
				wp_reset_postdata();
				?>
			</div>
		<?php else : ?>
			<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
				Még nincsenek feltöltött termékek.
			</div>
		<?php endif; ?>
	<?php endif; ?>
</section>

<?php
get_footer();
