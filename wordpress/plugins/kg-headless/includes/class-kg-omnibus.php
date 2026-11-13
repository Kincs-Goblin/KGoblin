<?php
/**
 * EU Omnibus irányelv (30 napos legalacsonyabb ár) követése és Store API kiterjesztése.
 *
 * Szabály:
 * - Az akció kezdete előtti 30 nap legalacsonyabb árát kell meghatározni.
 * - Ebbe beleértendő az ablak kezdetén (sale_start - 30 nap) már érvényben lévő ár is,
 *   még ha azt 30 napnál régebben állították is be!
 * - Az aktuális akciós ár (vagy az ugyanazon akció keretében csökkentett ár) NEM számít bele.
 * - Minden számítás egész számmal (minor unit / HUF) történik, float használata nélkül.
 * - Store API-ban a `extensions.kg_headless` alatt érhető el.
 *
 * @package KG_Headless
 */

declare(strict_types=1);

namespace KG_Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Omnibus {

	public const META_HISTORY        = '_hu_price_history';
	public const META_LOWEST_30_DAYS = '_hu_lowest_price_30_days';
	public const META_SALE_START_TS  = '_hu_sale_started_at';

	/**
	 * Hookok regisztrálása.
	 */
	public static function init(): void {
		add_action( 'woocommerce_before_product_object_save', array( self::class, 'on_before_product_save' ), 10, 1 );
		add_action( 'woocommerce_blocks_loaded', array( self::class, 'register_store_api_extension' ) );
	}

	/**
	 * Ár sztring konvertálása egész számra (minor unit / Ft) float használata nélkül.
	 * Pl. "4990" -> 4990, "4990.00" -> 4990 (0 tizedesjegy esetén).
	 * Pl. "19.99" -> 1999 (2 tizedesjegy esetén).
	 *
	 * @param string|int|null $raw_price Nyers ár sztring a WooCommerce-ből.
	 * @param int             $decimals  Pénznem tizedesjegyeinek száma (HUF = 0).
	 * @return int|null Pozitív egész ár minor unitban, vagy null ha üres/érvénytelen.
	 */
	public static function parse_price_to_int( string|int|null $raw_price, int $decimals = 0 ): ?int {
		if ( null === $raw_price ) {
			return null;
		}

		$str = trim( (string) $raw_price );
		if ( '' === $str ) {
			return null;
		}

		$str = str_replace( ',', '.', $str );
		if ( ! preg_match( '/^(\d+)(?:\.(\d+))?$/', $str, $matches ) ) {
			return null;
		}

		$whole = $matches[1];
		$frac  = $matches[2] ?? '';

		if ( $decimals <= 0 ) {
			$val = (int) $whole;
		} else {
			$frac_padded = substr( str_pad( $frac, $decimals, '0', STR_PAD_RIGHT ), 0, $decimals );
			$val         = (int) ( $whole . $frac_padded );
		}

		return $val > 0 ? $val : null;
	}

	/**
	 * Tiszta (unit-tesztelhető) Omnibus számítási logika.
	 *
	 * @param array<int, array{timestamp: int, price: int, is_sale?: bool}> $history        Korábbi ártörténet.
	 * @param int|null                                                      $regular_price  Normál ár minor unitban (int).
	 * @param int|null                                                      $sale_price     Akciós ár minor unitban (int, vagy null ha nincs akció).
	 * @param int|null                                                      $sale_start_ts  Aktuális akció kezdetének időbélyege (0/null ha nem volt akcióban).
	 * @param int                                                           $now            Aktuális Unix timestamp.
	 * @param bool|null                                                     $is_on_sale_override Explicit akció-állapot (pl. ütemezett sale dátumok figyelembevételével).
	 * @return array{history: array<int, array{timestamp: int, price: int, is_sale: bool}>, lowest_30_days: int|null, sale_started_at: int}
	 */
	public static function calculate_omnibus_state(
		array $history,
		?int $regular_price,
		?int $sale_price,
		?int $sale_start_ts,
		int $now,
		?bool $is_on_sale_override = null
	): array {
		$day_seconds = defined( 'DAY_IN_SECONDS' ) ? (int) DAY_IN_SECONDS : 86400;
		$has_valid_sale_price = ( null !== $sale_price && null !== $regular_price && $sale_price > 0 && $sale_price < $regular_price );
		$is_on_sale  = null !== $is_on_sale_override ? ( $is_on_sale_override && $has_valid_sale_price ) : $has_valid_sale_price;
		$active_price = $is_on_sale ? $sale_price : $regular_price;

		// 1. Meglévő ártörténet normalizálása (int) és időrendbe rendezése
		$normalized = array();
		foreach ( $history as $entry ) {
			if ( ! is_array( $entry ) || ! isset( $entry['timestamp'], $entry['price'] ) ) {
				continue;
			}
			$ts    = (int) $entry['timestamp'];
			$price = is_int( $entry['price'] ) ? $entry['price'] : self::parse_price_to_int( (string) $entry['price'], 0 );
			if ( null === $price || $price <= 0 ) {
				continue;
			}
			$normalized[] = array(
				'timestamp' => $ts,
				'price'     => $price,
				'is_sale'   => ! empty( $entry['is_sale'] ),
			);
		}

		usort(
			$normalized,
			static fn( array $a, array $b ): int => $a['timestamp'] <=> $b['timestamp']
		);

		$current_sale_start = ( null !== $sale_start_ts && $sale_start_ts > 0 ) ? $sale_start_ts : 0;

		if ( $is_on_sale ) {
			// Ha most indul az akció, rögzítjük az akció kezdetét és biztosítjuk, hogy a megelőző normál ár szerepeljen az előzményben
			if ( 0 === $current_sale_start ) {
				$current_sale_start = $now;

				if ( empty( $normalized ) && null !== $regular_price ) {
					$normalized[] = array(
						'timestamp' => $now - $day_seconds,
						'price'     => $regular_price,
						'is_sale'   => false,
					);
				}
			}

			// Referencia-időszak: az akció kezdete előtti 30 nap [window_start, current_sale_start)
			// Fontos: az ablak kezdetén (timestamp <= window_start) érvényben lévő utolsó ár is érvényes volt az ablak elején!
			$window_start     = $current_sale_start - ( 30 * $day_seconds );
			$candidate_prices = self::collect_window_prices( $normalized, $window_start, $current_sale_start, false );

			$lowest_30 = ! empty( $candidate_prices ) ? min( $candidate_prices ) : $regular_price;
		} else {
			// A termék nincs akcióban: az akció-kezdet nullázódik
			$current_sale_start = 0;
			$window_start       = $now - ( 30 * $day_seconds );
			$candidate_prices   = self::collect_window_prices( $normalized, $window_start, $now, true );

			if ( null !== $regular_price ) {
				$candidate_prices[] = $regular_price;
			}

			$lowest_30 = ! empty( $candidate_prices ) ? min( $candidate_prices ) : $regular_price;
		}

		// 60 napnál régebbi bejegyzések takarítása, DE a cutoff (és az esetleges window_start) előtti utolsó érvényes ár megtartásával!
		$effective_cutoff = $now - ( 60 * $day_seconds );
		if ( $current_sale_start > 0 ) {
			$sale_window_start = $current_sale_start - ( 30 * $day_seconds );
			if ( $sale_window_start < $effective_cutoff ) {
				$effective_cutoff = $sale_window_start;
			}
		}

		$clean_history      = array();
		$last_before_cutoff = null;

		foreach ( $normalized as $entry ) {
			if ( $entry['timestamp'] < $effective_cutoff ) {
				$last_before_cutoff = $entry;
			} else {
				$clean_history[] = $entry;
			}
		}

		if ( null !== $last_before_cutoff ) {
			array_unshift( $clean_history, $last_before_cutoff );
		}

		// Csak akkor fűzünk új bejegyzést a történethez, ha változott az ár vagy az akció-státusz az utolsó bejegyzéshez képest
		if ( null !== $active_price ) {
			$last_entry = ! empty( $clean_history ) ? $clean_history[ count( $clean_history ) - 1 ] : null;
			if ( null === $last_entry || $last_entry['price'] !== $active_price || $last_entry['is_sale'] !== $is_on_sale ) {
				$clean_history[] = array(
					'timestamp' => $now,
					'price'     => $active_price,
					'is_sale'   => $is_on_sale,
				);
			}
		}

		return array(
			'history'         => $clean_history,
			'lowest_30_days'  => $lowest_30,
			'sale_started_at' => $current_sale_start,
		);
	}

	/**
	 * Összegyűjti a vizsgált 30 napos ablakban érvényes árakat, beleértve az ablak kezdetekor
	 * (`timestamp <= $window_start`) érvényben lévő utolsó árat is.
	 *
	 * @param array<int, array{timestamp: int, price: int, is_sale: bool}> $sorted_history Időrendbe rendezett ártörténet.
	 * @param int                                                          $window_start   Ablak kezdete.
	 * @param int                                                          $window_end     Ablak vége.
	 * @param bool                                                         $inclusive_end  A végpont (`<=`) beleszámít-e (akciónál `false`: `< sale_start`).
	 * @return array<int, int> Érvényes árak listája az ablakban.
	 */
	private static function collect_window_prices(
		array $sorted_history,
		int $window_start,
		int $window_end,
		bool $inclusive_end
	): array {
		$prices               = array();
		$active_at_start      = null;
		$first_in_window_ts   = null;

		foreach ( $sorted_history as $entry ) {
			$ts = $entry['timestamp'];
			if ( $ts <= $window_start ) {
				$active_at_start = $entry['price'];
				continue;
			}

			$in_end = $inclusive_end ? ( $ts <= $window_end ) : ( $ts < $window_end );
			if ( $in_end ) {
				if ( null === $first_in_window_ts ) {
					$first_in_window_ts = $ts;
				}
				$prices[] = $entry['price'];
			}
		}

		// Ha volt az ablak kezdetén (vagy előtte) beállított ár, és az ablak nem pont a $window_start pillanatban nyitott új árral,
		// akkor az az ár érvényben volt a [$window_start, $first_in_window_ts) időszakban!
		if ( null !== $active_at_start ) {
			$prices[] = $active_at_start;
		}

		return $prices;
	}

	/**
	 * Ellenőrzi, hogy a mentés alatt álló termék ténylegesen akcióban van-e most
	 * (figyelembe véve az ütemezett `date_on_sale_from` és `date_on_sale_to` dátumokat is).
	 *
	 * @param \WC_Product $product Termék objektum.
	 * @param int|null    $regular Normál ár minor unitban.
	 * @param int|null    $sale    Akciós ár minor unitban.
	 * @param int         $now     Aktuális időbélyeg.
	 * @return bool Igaz, ha a termék jelenleg aktív akcióban van.
	 */
	public static function is_product_currently_on_sale( \WC_Product $product, ?int $regular, ?int $sale, int $now ): bool {
		if ( null === $regular || null === $sale || $sale <= 0 || $sale >= $regular ) {
			return false;
		}

		$from = $product->get_date_on_sale_from( 'edit' );
		if ( $from instanceof \WC_DateTime && $from->getTimestamp() > $now ) {
			return false;
		}

		$to = $product->get_date_on_sale_to( 'edit' );
		if ( $to instanceof \WC_DateTime && $to->getTimestamp() < $now ) {
			return false;
		}

		return true;
	}

	/**
	 * Termék mentésekor (Admin, WP-CLI vagy REST v3 feed-szinkron) frissíti az Omnibus metaadatokat.
	 *
	 * @param \WC_Product $product Mentés alatt álló WooCommerce termék.
	 */
	public static function on_before_product_save( \WC_Product $product ): void {
		$decimals      = function_exists( 'wc_get_price_decimals' ) ? wc_get_price_decimals() : 0;
		$regular_price = self::parse_price_to_int( $product->get_regular_price( 'edit' ), $decimals );
		$sale_price    = self::parse_price_to_int( $product->get_sale_price( 'edit' ), $decimals );

		if ( null === $regular_price && null === $sale_price ) {
			return;
		}

		$raw_history = $product->get_meta( self::META_HISTORY, true );
		$history     = is_array( $raw_history ) ? $raw_history : array();

		$raw_sale_start = $product->get_meta( self::META_SALE_START_TS, true );
		$sale_start_ts  = is_numeric( $raw_sale_start ) ? (int) $raw_sale_start : 0;

		$now        = time();
		$is_on_sale = self::is_product_currently_on_sale( $product, $regular_price, $sale_price, $now );

		$state = self::calculate_omnibus_state(
			$history,
			$regular_price,
			$sale_price,
			$sale_start_ts,
			$now,
			$is_on_sale
		);

		$product->update_meta_data( self::META_HISTORY, $state['history'] );
		$product->update_meta_data( self::META_SALE_START_TS, (string) $state['sale_started_at'] );

		if ( null !== $state['lowest_30_days'] ) {
			$product->update_meta_data( self::META_LOWEST_30_DAYS, (string) $state['lowest_30_days'] );
		}
	}

	/**
	 * Termék 30 napos legalacsonyabb árának lekérése egész számként (minor unit).
	 * A `_hu_lowest_price_30_days` meta már minor unitban (int) van tárolva, ezért
	 * nem skálázzuk újra tizedesjegyekkel!
	 *
	 * @param \WC_Product $product Termék objektum.
	 * @return int|null Legalacsonyabb ár minor unitban, vagy null.
	 */
	public static function get_lowest_price_for_product( \WC_Product $product ): ?int {
		$raw_meta = trim( (string) $product->get_meta( self::META_LOWEST_30_DAYS, true ) );
		if ( '' !== $raw_meta && preg_match( '/^\d+$/', $raw_meta ) ) {
			$val = (int) $raw_meta;
			if ( $val > 0 ) {
				return $val;
			}
		}

		$decimals = function_exists( 'wc_get_price_decimals' ) ? wc_get_price_decimals() : 0;
		return self::parse_price_to_int( $product->get_regular_price(), $decimals );
	}

	/**
	 * Store API `/wp-json/wc/store/v1/products` kiterjesztése az Omnibus mezőkkel (`extensions.kg_headless`).
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
					return array(
						'lowest_price_30_days' => self::get_lowest_price_for_product( $product ),
						'is_on_sale'           => (bool) $product->is_on_sale(),
						'currency_minor_unit'  => $decimals,
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
					);
				},
				'schema_type'     => ARRAY_A,
			)
		);
	}
}
