<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans' ); ?>>
<?php wp_body_open(); ?>

<!-- Felső információs sáv -->
<div class="bg-slate-900 text-slate-200 text-xs py-2 px-4">
	<div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
		<p class="font-medium flex items-center gap-1.5">
			<span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
			Ingyenes kiszállítás 25 000 Ft feletti rendelés esetén!
		</p>
		<div class="hidden sm:flex items-center gap-4 text-slate-300">
			<span>🇭🇺 100% Magyar Webáruház</span>
			<span>•</span>
			<span>14 napos visszaküldési garancia</span>
		</div>
	</div>
</div>

<!-- Reszponzív Fejléc -->
<header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-20 gap-4">

			<!-- Logó / Oldal neve -->
			<div class="flex items-center shrink-0">
				<?php if ( has_custom_logo() ) : ?>
					<div class="max-h-12"><?php the_custom_logo(); ?></div>
				<?php else : ?>
					<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="flex items-center gap-2.5 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 hover:text-indigo-600 transition">
						<span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-black shadow-sm">
							SW
						</span>
						<span><?php bloginfo( 'name' ); ?></span>
					</a>
				<?php endif; ?>
			</div>

			<!-- Főmenü (Desktop) -->
			<nav class="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Főmenü">
				<?php
				if ( has_nav_menu( 'primary' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'primary',
							'container'      => false,
							'menu_class'     => 'flex items-center space-x-1 lg:space-x-2 text-sm font-semibold text-slate-700 [&_a]:px-3 [&_a]:py-2 [&_a]:rounded-lg [&_a:hover]:bg-slate-100 [&_a:hover]:text-indigo-600 [&_a]:transition',
							'fallback_cb'    => false,
						)
					);
				} else {
					$shop_url    = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/bolt/' );
					$account_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/fiokom/' );
					?>
					<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Főoldal</a>
					<a href="<?php echo esc_url( $shop_url ); ?>" class="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Bolt</a>
					<a href="<?php echo esc_url( $account_url ); ?>" class="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Fiókom</a>
					<a href="<?php echo esc_url( home_url( '/kapcsolat/' ) ); ?>" class="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition">Kapcsolat</a>
					<?php
				}
				?>
			</nav>

			<!-- Keresőmező + Élő Kosár Számláló -->
			<div class="flex items-center gap-3 flex-1 md:flex-initial justify-end">
				<!-- Termékkereső (Desktop) -->
				<form role="search" method="get" class="hidden lg:flex items-center relative w-64 xl:w-72" action="<?php echo esc_url( home_url( '/' ) ); ?>">
					<input type="hidden" name="post_type" value="product" />
					<input
						type="search"
						name="s"
						value="<?php echo esc_attr( get_search_query() ); ?>"
						placeholder="Keresés a termékek között..."
						class="w-full rounded-xl border border-slate-300 bg-slate-100/80 pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-500 transition focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
					/>
					<svg class="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
					</svg>
				</form>

				<!-- Élő AJAX Kosár Gomb -->
				<?php
				$cart_url   = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/kosar/' );
				$cart_count = ( function_exists( 'WC' ) && WC()->cart ) ? WC()->cart->get_cart_contents_count() : 0;
				$cart_total = ( function_exists( 'WC' ) && WC()->cart ) ? WC()->cart->get_cart_subtotal() : '0 Ft';
				?>
				<a
					href="<?php echo esc_url( $cart_url ); ?>"
					class="group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-xs hover:border-indigo-600 hover:bg-indigo-50/40 transition"
					title="Kosár megtekintése"
				>
					<div class="relative flex items-center">
						<svg class="h-5 w-5 text-slate-700 group-hover:text-indigo-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
						</svg>
					</div>
					<span id="header-cart-total" class="custom-cart-total hidden text-sm font-semibold text-slate-700 sm:inline">
						<?php echo wp_kses_post( $cart_total ); ?>
					</span>
					<span id="header-cart-count" class="custom-cart-count inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
						<?php echo esc_html( (string) $cart_count ); ?>
					</span>
				</a>

				<!-- Mobil menü kapcsoló -->
				<button
					type="button"
					onclick="document.getElementById('mobile-menu-drawer').classList.toggle('hidden')"
					class="md:hidden inline-flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-100 focus:outline-none"
					aria-label="Menü megnyitása"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Mobil menü és kereső -->
		<div id="mobile-menu-drawer" class="hidden md:hidden border-t border-slate-200 py-4 space-y-4">
			<form role="search" method="get" class="flex items-center relative" action="<?php echo esc_url( home_url( '/' ) ); ?>">
				<input type="hidden" name="post_type" value="product" />
				<input
					type="search"
					name="s"
					value="<?php echo esc_attr( get_search_query() ); ?>"
					placeholder="Keresés a termékek között..."
					class="w-full rounded-xl border border-slate-300 bg-slate-100 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:border-indigo-600 focus:bg-white focus:outline-none"
				/>
				<svg class="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
				</svg>
			</form>
			<div class="flex flex-col space-y-1">
				<?php
				$shop_url    = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/bolt/' );
				$cart_url    = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/kosar/' );
				$account_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/fiokom/' );
				?>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-100">Főoldal</a>
				<a href="<?php echo esc_url( $shop_url ); ?>" class="px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-100">Bolt</a>
				<a href="<?php echo esc_url( $cart_url ); ?>" class="px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-100">Kosár</a>
				<a href="<?php echo esc_url( $account_url ); ?>" class="px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-100">Fiókom</a>
				<a href="<?php echo esc_url( home_url( '/kapcsolat/' ) ); ?>" class="px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-100">Kapcsolat</a>
			</div>
		</div>
	</div>
</header>

<main class="flex-grow">
