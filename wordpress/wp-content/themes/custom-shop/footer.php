</main>

<!-- Letisztult lábléc jogi linkekkel -->
<footer class="bg-slate-900 text-slate-300 mt-20 border-t border-slate-800">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-10">
			<!-- Márka leírás -->
			<div class="md:col-span-2 space-y-4">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="inline-flex items-center gap-2.5 text-xl font-extrabold text-white">
					<span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black">SW</span>
					<span><?php bloginfo( 'name' ); ?></span>
				</a>
				<p class="text-sm text-slate-400 max-w-md leading-relaxed">
					Prémium minőségű hazai termékek, gyors házhozszállítással és 100% elégedettségi garanciával. Minden rendelést magyarországi raktárról, 1-2 munkanapon belül teljesítünk.
				</p>
				<div class="flex items-center gap-3 text-xs text-slate-400 pt-1">
					<span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-200">🔒 SSL Biztonságos fizetés</span>
					<span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-200">📦 Foxpost / Házhozszállítás</span>
				</div>
			</div>

			<!-- Vásárlás linkek -->
			<div>
				<h3 class="text-sm font-bold uppercase tracking-wider text-white mb-4">Vásárlás</h3>
				<ul class="space-y-2.5 text-sm">
					<?php
					$shop_url     = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/bolt/' );
					$cart_url     = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/kosar/' );
					$checkout_url = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/penztar/' );
					$account_url  = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/fiokom/' );
					?>
					<li><a href="<?php echo esc_url( $shop_url ); ?>" class="hover:text-white transition">Összes termék</a></li>
					<li><a href="<?php echo esc_url( $cart_url ); ?>" class="hover:text-white transition">Kosár</a></li>
					<li><a href="<?php echo esc_url( $checkout_url ); ?>" class="hover:text-white transition">Pénztár</a></li>
					<li><a href="<?php echo esc_url( $account_url ); ?>" class="hover:text-white transition">Saját fiók</a></li>
				</ul>
			</div>

			<!-- Kötelező jogi linkek -->
			<div>
				<h3 class="text-sm font-bold uppercase tracking-wider text-white mb-4">Jogi információk</h3>
				<?php
				if ( has_nav_menu( 'footer-legal' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'footer-legal',
							'container'      => false,
							'menu_class'     => 'space-y-2.5 text-sm [&_a:hover]:text-white [&_a]:transition',
							'fallback_cb'    => false,
						)
					);
				} else {
					?>
					<ul class="space-y-2.5 text-sm">
						<li><a href="<?php echo esc_url( home_url( '/aszf/' ) ); ?>" class="hover:text-white transition">Általános Szerződési Feltételek (ÁSZF)</a></li>
						<li><a href="<?php echo esc_url( home_url( '/adatkezelesi-tajekoztato/' ) ); ?>" class="hover:text-white transition">Adatkezelési tájékoztató</a></li>
						<li><a href="<?php echo esc_url( home_url( '/kapcsolat/' ) ); ?>" class="hover:text-white transition">Kapcsolat & Impresszum</a></li>
					</ul>
					<?php
				}
				?>
			</div>
		</div>

		<div class="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
			<p>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. Minden jog fenntartva.</p>
			<p>Magyar e-kereskedelmi és Omnibus irányelvnek megfelelő webáruház.</p>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
