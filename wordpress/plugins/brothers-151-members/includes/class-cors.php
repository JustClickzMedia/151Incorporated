<?php
namespace B151\Members;

/**
 * Credentialed CORS for the Angular front end: only exact, configured origins may send cookies and read
 * responses. Everything else gets no credentials header (and b151 routes refuse foreign origins outright).
 */
final class Cors {

	public const ALLOW_HEADERS = 'Authorization, Content-Type, X-WP-Nonce, X-B151-Activity';

	public static function register(): void {
		add_filter( 'rest_pre_serve_request', array( self::class, 'rest_headers' ), 20, 4 );
		add_filter( 'graphql_response_headers_to_send', array( self::class, 'graphql_headers' ), 100 );
	}

	public static function origin_allowed( ?string $origin ): bool {
		return null !== $origin && '' !== $origin && in_array( $origin, Settings::credential_origins(), true );
	}

	public static function request_origin(): ?string {
		$o = get_http_origin();
		return $o ? (string) $o : null;
	}

	/** Headers to send for a given request origin. Null values mean "remove this header". */
	public static function headers_for_origin( ?string $origin ): array {
		if ( self::origin_allowed( $origin ) ) {
			return array(
				'Access-Control-Allow-Origin'      => $origin,
				'Access-Control-Allow-Credentials' => 'true',
				'Access-Control-Allow-Headers'     => self::ALLOW_HEADERS,
				'Access-Control-Allow-Methods'     => 'GET, POST, DELETE, OPTIONS',
				'Vary'                             => 'Origin, Cookie',
			);
		}
		return array(
			'Access-Control-Allow-Credentials' => null,
			'Vary'                             => 'Origin, Cookie',
		);
	}

	/** REST: core echoes any Origin with credentials; narrow that to our origins. */
	public static function rest_headers( $served, $result = null, $request = null, $server = null ) {
		if ( headers_sent() ) {
			return $served;
		}
		$origin = self::request_origin();
		if ( null === $origin ) {
			return $served;
		}
		foreach ( self::headers_for_origin( $origin ) as $name => $value ) {
			if ( null === $value ) {
				header_remove( $name );
			} else {
				header( $name . ': ' . $value );
			}
		}
		if ( ! self::origin_allowed( $origin ) ) {
			header_remove( 'Access-Control-Allow-Origin' );
		}
		return $served;
	}

	public static function graphql_headers( array $headers ): array {
		$origin = self::request_origin();
		if ( null === $origin ) {
			return $headers;
		}
		foreach ( self::headers_for_origin( $origin ) as $name => $value ) {
			if ( null === $value ) {
				unset( $headers[ $name ] );
			} else {
				$headers[ $name ] = $value;
			}
		}
		return $headers;
	}
}
