<?php
/**
 * Oldal sablon (page.php) – Kosár, Pénztár, Fiókom és statikus oldalakhoz
 *
 * @package Custom_Shop
 */

get_header();
?>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article id="post-<?php the_ID(); ?>" <?php post_class( 'space-y-6' ); ?>>
			<header class="border-b border-slate-200 pb-5">
				<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
					<?php the_title(); ?>
				</h1>
			</header>

			<div class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs text-slate-800 leading-relaxed">
				<?php the_content(); ?>
			</div>
		</article>
	<?php endwhile; ?>
</div>

<?php
get_footer();
