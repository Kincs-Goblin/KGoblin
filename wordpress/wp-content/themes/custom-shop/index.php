<?php
/**
 * Általános sablon (index.php)
 *
 * @package Custom_Shop
 */

get_header();
?>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
	<?php if ( have_posts() ) : ?>
		<div class="space-y-8">
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article id="post-<?php the_ID(); ?>" <?php post_class( 'rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs' ); ?>>
					<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
						<a href="<?php the_permalink(); ?>" class="hover:text-indigo-600 transition"><?php the_title(); ?></a>
					</h1>
					<div class="prose max-w-none text-slate-700 leading-relaxed">
						<?php the_content(); ?>
					</div>
				</article>
			<?php endwhile; ?>
		</div>
	<?php else : ?>
		<div class="rounded-2xl border border-slate-200 bg-white p-8 text-center">
			<h2 class="text-xl font-bold text-slate-900">Nem található tartalom</h2>
			<p class="text-slate-600 mt-2">A keresett oldal vagy bejegyzés nem található.</p>
		</div>
	<?php endif; ?>
</div>

<?php
get_footer();
