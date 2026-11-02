<?php
/**
 * Bundled dependencies (no Composer on the host). firebase/php-jwt, BSD-3-Clause — see vendor/firebase/php-jwt/LICENSE.
 */
spl_autoload_register(
	static function ( $class ) {
		$prefix = 'Firebase\\JWT\\';
		if ( 0 === strpos( $class, $prefix ) ) {
			$file = __DIR__ . '/firebase/php-jwt/src/' . str_replace( '\\', '/', substr( $class, strlen( $prefix ) ) ) . '.php';
			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	}
);
