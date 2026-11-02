<?php
/**
 * PHPUnit bootstrap. Runs against the WordPress core test suite with WPGraphQL and Two Factor loaded.
 * Paths come from environment variables so the suite runs on any machine:
 *   WP_TESTS_DIR                     wordpress-develop/tests/phpunit
 *   WP_TESTS_CONFIG_FILE_PATH        wp-tests-config.php (test database — never a real site)
 *   WP_TESTS_PHPUNIT_POLYFILLS_PATH  yoast/phpunit-polyfills
 *   B151_WPGRAPHQL_DIR, B151_TWO_FACTOR_DIR
 */
$tests_dir = getenv( 'WP_TESTS_DIR' ) ?: '/home/claude/wpdev/wordpress-develop/tests/phpunit';
if ( ! getenv( 'WP_TESTS_CONFIG_FILE_PATH' ) ) {
	putenv( 'WP_TESTS_CONFIG_FILE_PATH=/home/claude/wpdev/wp-tests-config.php' );
}
if ( ! defined( 'WP_TESTS_CONFIG_FILE_PATH' ) ) {
	define( 'WP_TESTS_CONFIG_FILE_PATH', getenv( 'WP_TESTS_CONFIG_FILE_PATH' ) );
}
if ( ! defined( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', getenv( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ?: '/home/claude/wpdev/deps/phpunit-polyfills' );
}
$graphql_dir    = getenv( 'B151_WPGRAPHQL_DIR' ) ?: '/home/claude/wpdev/wp-graphql';
$two_factor_dir = getenv( 'B151_TWO_FACTOR_DIR' ) ?: '/home/claude/wpdev/two-factor';

// Test-only OAuth client values (never real credentials).
define( 'B151_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com' );
define( 'B151_GOOGLE_CLIENT_SECRET', 'test-secret' );
define( 'WP_ENVIRONMENT_TYPE', 'local' );

require_once $tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () use ( $graphql_dir, $two_factor_dir ) {
		require $graphql_dir . '/wp-graphql.php';
		require $two_factor_dir . '/two-factor.php';
		require dirname( __DIR__ ) . '/brothers-151-members.php';
	}
);
// No real cookies or network in tests.
tests_add_filter( 'send_auth_cookies', '__return_false' );

require $tests_dir . '/includes/bootstrap.php';
require __DIR__ . '/class-b151-testcase.php';
