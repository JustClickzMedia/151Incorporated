<?php
/**
 * Plugin Name:       Brothers of 1-5-1 Members Portal
 * Description:       Members-only backend for The Brothers of 1-5-1, Incorporated: membership status and numbers, roles, secure sign-in (password, Google, Microsoft) for the member area, approvals and audit log, exposed through WPGraphQL.
 * Version:           0.2.0
 * Requires at least: 6.6
 * Requires PHP:      8.1
 * Author:            The Brothers of 1-5-1, Incorporated
 * Text Domain:       b151
 * License:           GPL-2.0-or-later
 *
 * Design: docs/members-portal/ARCHITECTURE.md. Checkpoint 2 (core backend).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'B151_MEMBERS_VERSION', '0.2.0' );
define( 'B151_MEMBERS_FILE', __FILE__ );
define( 'B151_MEMBERS_DIR', __DIR__ );

// Bundled third-party libraries (firebase/php-jwt for verifying Google/Microsoft ID tokens).
if ( file_exists( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
}

spl_autoload_register(
	static function ( $class ) {
		$prefix = 'B151\\Members\\';
		if ( 0 !== strpos( $class, $prefix ) ) {
			return;
		}
		$name = substr( $class, strlen( $prefix ) );
		$file = __DIR__ . '/includes/class-' . strtolower( str_replace( '_', '-', $name ) ) . '.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
);

register_activation_hook( __FILE__, array( 'B151\\Members\\Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'B151\\Members\\Installer', 'deactivate' ) );

add_action( 'plugins_loaded', array( 'B151\\Members\\Plugin', 'boot' ) );
