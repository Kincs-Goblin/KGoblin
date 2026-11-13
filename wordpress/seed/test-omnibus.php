<?php
/**
 * Unit és integrációs tesztszkript a kg-headless plugin Omnibus ártörténet-számításához
 * és a magyar adószám-validációhoz.
 *
 * Futtatható önállóan PHP CLI-vel vagy WP-CLI-n keresztül:
 *   docker compose exec -T wpcli-gamer php /var/www/seed/test-omnibus.php
 *
 * @package KG_Headless
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
if ( ! defined( 'DAY_IN_SECONDS' ) ) {
	define( 'DAY_IN_SECONDS', 86400 );
}

$plugin_dir = file_exists( __DIR__ . '/../plugins/kg-headless/includes/class-kg-omnibus.php' )
	? __DIR__ . '/../plugins/kg-headless'
	: '/var/www/html/wp-content/plugins/kg-headless';

require_once $plugin_dir . '/includes/class-kg-omnibus.php';
require_once $plugin_dir . '/includes/class-kg-checkout-fields.php';

use KG_Headless\Omnibus;
use KG_Headless\Checkout_Fields;

$failures = 0;

function assert_same( mixed $expected, mixed $actual, string $label ): void {
	global $failures;
	if ( $expected !== $actual ) {
		echo "[FAIL] {$label} -> Várt: " . var_export( $expected, true ) . ', Kapott: ' . var_export( $actual, true ) . "\n";
		$failures++;
	} else {
		echo "[PASS] {$label}\n";
	}
}

echo "=== 1. Float-mentes ár-konverzió tesztek ===\n";
assert_same( 44990, Omnibus::parse_price_to_int( '44990', 0 ), 'Egész HUF sztring' );
assert_same( 44990, Omnibus::parse_price_to_int( '44990.00', 0 ), 'Tizedes HUF sztring 0 decimállal' );
assert_same( 1999, Omnibus::parse_price_to_int( '19.99', 2 ), 'EUR 2 tizedesjeggyel -> 1999 minor unit' );
assert_same( null, Omnibus::parse_price_to_int( '', 0 ), 'Üres sztring -> null' );
assert_same( null, Omnibus::parse_price_to_int( '0', 0 ), 'Nulla ár -> null' );

echo "\n=== 2. EU Omnibus 30 napos legalacsonyabb ár invariánsok ===\n";
$now = 1_700_000_000;

// Eset A: Új termék 44 990 Ft normál áron indul, majd leárazzák 36 990 Ft-ra.
// Az akció kezdete előtti 30 nap legalacsonyabb ára 44 990 Ft kell legyen, NEM az akciós 36 990 Ft!
$state1 = Omnibus::calculate_omnibus_state( array(), 44990, null, 0, $now - ( 15 * DAY_IN_SECONDS ) );
assert_same( 44990, $state1['lowest_30_days'], 'Normál áras termék indulása (44 990 Ft)' );

$state2 = Omnibus::calculate_omnibus_state(
	$state1['history'],
	44990,
	36990,
	$state1['sale_started_at'],
	$now
);
assert_same(
	44990,
	$state2['lowest_30_days'],
	'Akció indulásakor (36 990 Ft) a referenciaár a megelőző 30 nap minimuma (44 990 Ft), az akciós ár NEM számít bele'
);
assert_same( $now, $state2['sale_started_at'], 'Akció kezdetének időbélyege rögzítve' );

// Eset B: Ugyanazon akció közben tovább csökkentik az árat 32 990 Ft-ra (2 nappal később).
// A referenciaár továbbra is az akció kezdete (sale_started_at) előtti 30 nap minimuma (44 990 Ft) marad!
$state3 = Omnibus::calculate_omnibus_state(
	$state2['history'],
	44990,
	32990,
	$state2['sale_started_at'],
	$now + ( 2 * DAY_IN_SECONDS )
);
assert_same(
	44990,
	$state3['lowest_30_days'],
	'Folyamatban lévő akció további leárazásakor (32 990 Ft) a referenciaár nem csökken le a korábbi akciós árra'
);

// Eset C: Korábbi akció véget ért 10 napja (34 990 Ft volt), visszaállt 44 990 Ft-ra, majd ma új akció indul (36 990 Ft).
// Az új akció kezdete előtti 30 napban szerepel a 34 990 Ft, tehát most 34 990 Ft a referenciaár!
$history_with_past_sale = array(
	array(
		'timestamp' => $now - ( 25 * DAY_IN_SECONDS ),
		'price'     => 44990,
		'is_sale'   => false,
	),
	array(
		'timestamp' => $now - ( 12 * DAY_IN_SECONDS ),
		'price'     => 34990,
		'is_sale'   => true,
	),
	array(
		'timestamp' => $now - ( 5 * DAY_IN_SECONDS ),
		'price'     => 44990,
		'is_sale'   => false,
	),
);
$state4 = Omnibus::calculate_omnibus_state(
	$history_with_past_sale,
	44990,
	36990,
	0,
	$now
);
assert_same(
	34990,
	$state4['lowest_30_days'],
	'Ha az akció előtti 30 napban volt alacsonyabb ár (34 990 Ft), az lesz a referenciaár az új akciónál'
);

// Eset D (Window-start carryover): -40 napja 30 000 Ft, -20 napja felemelték 50 000 Ft-ra, ma indul az akció (40 000 Ft).
// A [-30 nap, -20 nap) időszakban még a -40 napja beállított 30 000 Ft volt érvényben, így a referenciaár 30 000 Ft!
$history_carryover = array(
	array(
		'timestamp' => $now - ( 40 * DAY_IN_SECONDS ),
		'price'     => 30000,
		'is_sale'   => false,
	),
	array(
		'timestamp' => $now - ( 20 * DAY_IN_SECONDS ),
		'price'     => 50000,
		'is_sale'   => false,
	),
);
$state5 = Omnibus::calculate_omnibus_state(
	$history_carryover,
	50000,
	40000,
	0,
	$now
);
assert_same(
	30000,
	$state5['lowest_30_days'],
	'Ablak kezdetén (-30 nap) érvényben lévő régebbi ár (-40 nap: 30 000 Ft) beleszámít a 30 napos minimumba'
);

// Eset E (60 napnál régebbi ár megtartása a cutoff előtt): -75 napja 25 000 Ft, -10 napja 40 000 Ft, ma akció (35 000 Ft).
$history_old_carryover = array(
	array(
		'timestamp' => $now - ( 75 * DAY_IN_SECONDS ),
		'price'     => 25000,
		'is_sale'   => false,
	),
	array(
		'timestamp' => $now - ( 10 * DAY_IN_SECONDS ),
		'price'     => 40000,
		'is_sale'   => false,
	),
);
$state6 = Omnibus::calculate_omnibus_state(
	$history_old_carryover,
	40000,
	35000,
	0,
	$now
);
assert_same(
	25000,
	$state6['lowest_30_days'],
	'60 napnál régebben (-75 nap) beállított, de az ablak elején még érvényes ár (25 000 Ft) is megmarad és beleszámít'
);

// Eset F (Jövőbeli ütemezett akció): sale_price be van állítva, de is_on_sale_override = false -> nem indíthat akciót!
$state7 = Omnibus::calculate_omnibus_state(
	array(),
	44990,
	36990,
	0,
	$now,
	false
);
assert_same( 0, $state7['sale_started_at'], 'Jövőbeli ütemezett akciónál (is_on_sale = false) a sale_started_at 0 marad' );
assert_same( 44990, $state7['lowest_30_days'], 'Jövőbeli ütemezett akciónál a normál ár (44 990 Ft) kerül rögzítésre' );

echo "\n=== 3. Magyar adószám validáció tesztek ===\n";
assert_same( true, Checkout_Fields::is_valid_hungarian_tax_number( '12345678-2-42' ), 'Helyes kötőjeles adószám (12345678-2-42)' );
assert_same( true, Checkout_Fields::is_valid_hungarian_tax_number( '12345678242' ), 'Helyes 11 jegyű adószám (12345678242)' );
assert_same( false, Checkout_Fields::is_valid_hungarian_tax_number( '12345' ), 'Túl rövid adószám elutasítása' );
assert_same( false, Checkout_Fields::is_valid_hungarian_tax_number( '12345678-9-42' ), 'Érvénytelen ÁFA-kód (9) elutasítása' );
assert_same( false, Checkout_Fields::is_valid_hungarian_tax_number( '' ), 'Üres adószám elutasítása' );

if ( $failures > 0 ) {
	echo "\nÖSSZESÍTÉS: {$failures} teszt ELBUKOTT!\n";
	exit( 1 );
}

echo "\nÖSSZESÍTÉS: Minden Omnibus és adószám unit-teszt SIKERES (0 hiba)!\n";
