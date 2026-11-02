<?php
namespace B151\Members;

/**
 * Member data must never be cached by the browser, a proxy or the host. The host adds
 * `Cache-Control: max-age=86400` to /graphql, so signed-in and b151 responses are marked no-store explicitly.
 */
final class Cache_Headers {

	public const NO_STORE = 'no-store, private, max-age=0';

	public static function register(): void {
		add_filter( 'graphql_response_headers_to_send', array( self::class, 'graphql_headers' ), 110 );
		add_filter( 'rest_post_dispatch', array( self::class, 'rest_headers' ), 10, 3 );
	}

	public static function graphql_headers( array $headers ): array {
		if ( is_user_logged_in() || self::has_auth_cookie() ) {
			$headers['Cache-Control'] = self::NO_STORE;
			$headers['Pragma']        = 'no-cache';
			$headers['Vary']          = 'Origin, Cookie';
		}
		return $headers;
	}

	public static function rest_headers( $response, $server, $request ) {
		if ( $response instanceof \WP_REST_Response && $request instanceof \WP_REST_Request
			&& ( 0 === strpos( $request->get_route(), '/b151/' ) || is_user_logged_in() ) ) {
			$response->header( 'Cache-Control', self::NO_STORE );
			$response->header( 'Pragma', 'no-cache' );
			$response->header( 'Vary', 'Origin, Cookie' );
		}
		return $response;
	}

	private static function has_auth_cookie(): bool {
		return defined( 'LOGGED_IN_COOKIE' ) && ! empty( $_COOKIE[ LOGGED_IN_COOKIE ] );
	}
}
