<?php
/**
 * Egyedi Termékoldal sablon (woocommerce/single-product.php)
 *
 * @package Custom_Shop
 * @version 1.6.4
 */

defined( 'ABSPATH' ) || exit;

get_header( 'shop' );
?>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
	<?php
	while ( have_posts() ) :
		the_post();
		global $product;
		?>

		<!-- Morzsamenü (Breadcrumb) -->
		<div class="mb-6 text-sm text-slate-500 [&_a]:text-slate-600 [&_a:hover]:text-indigo-600">
			<?php woocommerce_breadcrumb(); ?>
		</div>

		<div class="mb-6">
			<?php do_action( 'woocommerce_before_single_product' ); ?>
		</div>

		<div id="product-<?php the_ID(); ?>" <?php wc_product_class( 'rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs', $product ); ?>>
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

				<!-- Bal oszlop: Termékgaléria (Zoom, Lightbox, Slider támogatással) -->
				<div class="lg:col-span-6 relative">
					<?php do_action( 'woocommerce_before_single_product_summary' ); ?>
				</div>

				<!-- Jobb oszlop: Termék adatok, Omnibus ár, Kosárba gomb -->
				<div class="lg:col-span-6 space-y-6">
					<div class="flex flex-wrap items-center gap-2">
						<?php if ( $product->is_on_sale() ) : ?>
							<span class="rounded-lg bg-rose-600 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
								Akciós ajánlat
							</span>
						<?php endif; ?>

						<?php if ( $product->is_in_stock() ) : ?>
							<span class="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
								✓ Raktáron (<?php echo esc_html( (string) ( $product->get_stock_quantity() ?: 'Elérhető' ) ); ?> db)
							</span>
						<?php else : ?>
							<span class="rounded-lg bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
								Nincs raktáron
							</span>
						<?php endif; ?>
					</div>

					<div class="summary entry-summary space-y-4 [&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:font-extrabold [&_h1]:text-slate-900 [&_.price]:text-2xl [&_.price]:font-extrabold [&_.price]:text-slate-900 [&_.price_del]:text-base [&_.price_del]:text-slate-400 [&_.price_ins]:no-underline [&_.price_ins]:text-rose-600 [&_form.cart]:flex [&_form.cart]:flex-wrap [&_form.cart]:items-center [&_form.cart]:gap-4 [&_input.qty]:w-20 [&_input.qty]:rounded-xl [&_input.qty]:border [&_input.qty]:border-slate-300 [&_input.qty]:py-3 [&_input.qty]:text-center [&_input.qty]:font-bold">
						<?php
						/**
						 * Hook: woocommerce_single_product_summary.
						 * Itt fut le a cím, ár, az egyedi Omnibus 30 napos legalacsonyabb ár kijelzés,
						 * a rövid leírás, a kosárba rakás gomb és a kategória meta.
						 */
						do_action( 'woocommerce_single_product_summary' );
						?>
					</div>

					<!-- Biztonsági és szállítási infók -->
					<div class="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
						<div class="flex items-center gap-2.5 rounded-xl bg-slate-50 p-3.5">
							<span class="text-base">🚚</span>
							<span><strong>Gyors kiszállítás:</strong> 1-2 munkanapon belül, 25 000 Ft felett ingyen.</span>
						</div>
						<div class="flex items-center gap-2.5 rounded-xl bg-slate-50 p-3.5">
							<span class="text-base">🔄</span>
							<span><strong>14 napos elállás:</strong> Kérdés nélkül visszaküldheted.</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Részletes leírás, fülek és kapcsolódó termékek -->
			<div class="mt-12 pt-10 border-t border-slate-200">
				<?php do_action( 'woocommerce_after_single_product_summary' ); ?>
			</div>
		</div>

		<?php do_action( 'woocommerce_after_single_product' ); ?>

	<?php endwhile; ?>
</div>

<?php
get_footer( 'shop' );
