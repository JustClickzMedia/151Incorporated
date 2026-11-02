<?php
namespace B151\Members;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * "Sign in with Google / Microsoft" (ARCHITECTURE.md §4.4).
 *
 * Standard OpenID Connect Authorization Code flow with PKCE (S256), state and nonce, run entirely on the server:
 * the browser never sees the provider's tokens. The ID token is verified (signature against the provider's
 * published keys, issuer, audience, expiry, nonce) and the member is then signed in with the normal WordPress
 * cookie session. Accounts are never created here — only existing, eligible members can sign in.
 *
 * Client IDs and secrets come from wp-config.php constants, never from the database, the repository or Angular.
 */
final class Oauth {

	public const MS_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';
	public const BIND_COOKIE        = 'b151_oauth_bind';
	public const TTL                = 600;

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'routes' ) );
	}

	/** @return array<string,array<string,mixed>> */
	public static function providers(): array {
		return array(
			'google'    => array(
				'label'       => 'Google',
				'authorize'   => 'https://accounts.google.com/o/oauth2/v2/auth',
				'token'       => 'https://oauth2.googleapis.com/token',
				'jwks'        => 'https://www.googleapis.com/oauth2/v3/certs',
				'scope'       => 'openid email profile',
				'id_const'    => 'B151_GOOGLE_CLIENT_ID',
				'secret_const' => 'B151_GOOGLE_CLIENT_SECRET',
				'meta'        => 'b151_oauth_google_sub',
			),
			'microsoft' => array(
				'label'       => 'Microsoft',
				'authorize'   => 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
				'token'       => 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
				'jwks'        => 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
				'scope'       => 'openid email profile',
				'id_const'    => 'B151_MICROSOFT_CLIENT_ID',
				'secret_const' => 'B151_MICROSOFT_CLIENT_SECRET',
				'meta'        => 'b151_oauth_microsoft_oid',
			),
		);
	}

	public static function client_id( string $provider ): string {
		$c = self::providers()[ $provider ]['id_const'] ?? '';
		return ( $c && defined( $c ) ) ? (string) constant( $c ) : '';
	}

	private static function client_secret( string $provider ): string {
		$c = self::providers()[ $provider ]['secret_const'] ?? '';
		return ( $c && defined( $c ) ) ? (string) constant( $c ) : '';
	}

	public static function is_configured( string $provider ): bool {
		return isset( self::providers()[ $provider ] ) && '' !== self::client_id( $provider ) && '' !== self::client_secret( $provider );
	}

	public static function redirect_uri( string $provider ): string {
		return rest_url( Session_Api::NS . '/oauth/' . $provider . '/callback' );
	}

	public static function routes(): void {
		register_rest_route(
			Session_Api::NS,
			'/oauth/(?P<provider>google|microsoft)/start',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'start' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			Session_Api::NS,
			'/oauth/(?P<provider>google|microsoft)/callback',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'callback' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			Session_Api::NS,
			'/oauth/providers',
			array(
				'methods'             => 'GET',
				'callback'            => static function () {
					$out = array();
					foreach ( array_keys( self::providers() ) as $p ) {
						if ( self::is_configured( $p ) ) {
							$out[] = array( 'id' => $p, 'label' => self::providers()[ $p ]['label'] );
						}
					}
					return new WP_REST_Response( array( 'providers' => $out ), 200 );
				},
				'permission_callback' => '__return_true',
			)
		);
	}

	/** Only same-site paths under the front end are allowed as return targets. */
	public static function safe_return_path( $path ): string {
		$path = is_string( $path ) ? $path : '';
		if ( '' === $path || ! preg_match( '#^/[A-Za-z0-9/_\-]*$#', $path ) || 0 === strpos( $path, '//' ) ) {
			return '/members';
		}
		return $path;
	}

	private static function b64url( string $bin ): string {
		return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
	}

	private static function redirect( string $url ): WP_REST_Response {
		$r = new WP_REST_Response( null, 302 );
		$r->header( 'Location', $url );
		$r->header( 'Cache-Control', Cache_Headers::NO_STORE );
		return $r;
	}

	private static function fail( string $code, string $return = '/members' ): WP_REST_Response {
		return self::redirect( Settings::frontend_url( '/members/sign-in' ) . '?' . http_build_query( array( 'error' => $code ) ) );
	}

	private static function state_key( string $state ): string {
		return 'b151_oauth_' . substr( hash( 'sha256', $state ), 0, 40 );
	}

	/** GET /oauth/{provider}/start?return=/members[&mode=link] */
	public static function start( WP_REST_Request $request ) {
		$provider = (string) $request['provider'];
		if ( ! self::is_configured( $provider ) ) {
			return self::fail( 'provider_unavailable' );
		}
		$ip = Rate_Limiter::client_ip();
		if ( Rate_Limiter::exceeded( 'oauth_start_ip', $ip, 30 ) ) {
			return self::fail( 'too_many_attempts' );
		}
		Rate_Limiter::hit( 'oauth_start_ip', $ip, 15 * MINUTE_IN_SECONDS );

		$mode     = 'link' === $request->get_param( 'mode' ) ? 'link' : 'login';
		$link_uid = 0;
		if ( 'link' === $mode ) {
			$link_uid = self::cookie_user_id();
			if ( ! $link_uid ) {
				return self::fail( 'sign_in_first' );
			}
		}

		$state    = self::b64url( random_bytes( 32 ) );
		$nonce    = self::b64url( random_bytes( 32 ) );
		$verifier = self::b64url( random_bytes( 48 ) );
		$bind     = self::b64url( random_bytes( 32 ) );

		set_transient(
			self::state_key( $state ),
			array(
				'provider'  => $provider,
				'nonce'     => $nonce,
				'verifier'  => $verifier,
				'return'    => self::safe_return_path( $request->get_param( 'return' ) ),
				'mode'      => $mode,
				'link_uid'  => $link_uid,
				'bind_hash' => hash( 'sha256', $bind ),
			),
			self::TTL
		);
		self::set_bind_cookie( $bind );

		$p   = self::providers()[ $provider ];
		$url = add_query_arg(
			rawurlencode_deep(
				array(
					'client_id'             => self::client_id( $provider ),
					'response_type'         => 'code',
					'redirect_uri'          => self::redirect_uri( $provider ),
					'scope'                 => $p['scope'],
					'state'                 => $state,
					'nonce'                 => $nonce,
					'code_challenge'        => self::b64url( hash( 'sha256', $verifier, true ) ),
					'code_challenge_method' => 'S256',
					'prompt'                => 'select_account',
				)
			),
			$p['authorize']
		);
		return self::redirect( $url );
	}

	private static function set_bind_cookie( string $value ): void {
		$_COOKIE[ self::BIND_COOKIE ] = $value; // visible to the same request (tests)
		if ( headers_sent() ) {
			return;
		}
		setcookie(
			self::BIND_COOKIE,
			$value,
			array(
				'expires'  => time() + self::TTL,
				'path'     => '/',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
	}

	private static function clear_bind_cookie(): void {
		unset( $_COOKIE[ self::BIND_COOKIE ] );
		if ( ! headers_sent() ) {
			setcookie( self::BIND_COOKIE, '', array( 'expires' => time() - 3600, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax' ) );
		}
	}

	private static function cookie_user_id(): int {
		$cookie = isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) ? (string) $_COOKIE[ LOGGED_IN_COOKIE ] : ''; // phpcs:ignore
		if ( ! $cookie ) {
			return 0;
		}
		$uid   = (int) wp_validate_auth_cookie( $cookie, 'logged_in' );
		$parts = wp_parse_auth_cookie( $cookie, 'logged_in' );
		if ( ! $uid || ! is_array( $parts ) || ! Sessions::validate( $uid, (string) $parts['token'], true ) ) {
			return 0;
		}
		return $uid;
	}

	/** GET /oauth/{provider}/callback?code=…&state=… */
	public static function callback( WP_REST_Request $request ) {
		$provider = (string) $request['provider'];
		$state    = (string) $request->get_param( 'state' );
		if ( '' === $state ) {
			return self::fail( 'invalid_request' );
		}
		$key  = self::state_key( $state );
		$data = get_transient( $key );
		delete_transient( $key ); // single use
		$bind = isset( $_COOKIE[ self::BIND_COOKIE ] ) ? (string) $_COOKIE[ self::BIND_COOKIE ] : ''; // phpcs:ignore
		self::clear_bind_cookie();

		if ( ! is_array( $data ) || $data['provider'] !== $provider || '' === $bind || ! hash_equals( $data['bind_hash'], hash( 'sha256', $bind ) ) ) {
			Audit_Log::record( 'oauth_state_invalid', 'oauth', 0, array( 'provider' => $provider ), 0 );
			return self::fail( 'invalid_request' );
		}
		if ( $request->get_param( 'error' ) ) {
			return self::fail( 'cancelled' );
		}
		$code = (string) $request->get_param( 'code' );
		if ( '' === $code ) {
			return self::fail( 'invalid_request' );
		}

		$id_token = self::exchange_code( $provider, $code, $data['verifier'] );
		if ( is_wp_error( $id_token ) ) {
			Audit_Log::record( 'oauth_exchange_failed', 'oauth', 0, array( 'provider' => $provider, 'error' => $id_token->get_error_code() ), 0 );
			return self::fail( 'provider_error' );
		}
		$claims = self::verify_id_token( $provider, $id_token, $data['nonce'] );
		if ( is_wp_error( $claims ) ) {
			Audit_Log::record( 'oauth_token_rejected', 'oauth', 0, array( 'provider' => $provider, 'error' => $claims->get_error_code() ), 0 );
			return self::fail( 'provider_error' );
		}

		$subject = self::subject( $provider, $claims );
		$uid     = self::find_user_by_subject( $provider, $subject );

		if ( 'link' === $data['mode'] ) {
			$current = self::cookie_user_id();
			if ( ! $current || $current !== (int) $data['link_uid'] ) {
				return self::fail( 'sign_in_first' );
			}
			if ( $uid && $uid !== $current ) {
				return self::fail( 'already_linked' );
			}
			update_user_meta( $current, self::providers()[ $provider ]['meta'], $subject );
			Audit_Log::record( 'oauth_linked', 'user', $current, array( 'provider' => $provider ), $current );
			return self::redirect( Settings::frontend_url( $data['return'] ) );
		}

		if ( ! $uid ) {
			$uid = self::match_by_verified_email( $provider, $claims );
			// Never re-point an account that is already linked to a different provider identity.
			if ( $uid && '' !== (string) get_user_meta( $uid, self::providers()[ $provider ]['meta'], true ) ) {
				Audit_Log::record( 'oauth_link_conflict', 'user', $uid, array( 'provider' => $provider ), 0 );
				return self::fail( 'already_linked' );
			}
			if ( $uid ) {
				update_user_meta( $uid, self::providers()[ $provider ]['meta'], $subject );
				Audit_Log::record( 'oauth_linked', 'user', $uid, array( 'provider' => $provider, 'by' => 'verified_email' ), $uid );
			}
		}
		if ( ! $uid ) {
			Audit_Log::record( 'login_failed', 'user', 0, array( 'method' => $provider, 'reason' => 'no_account' ), 0 );
			return self::fail( 'no_account' );
		}
		if ( ! Access::can_sign_in( $uid ) ) {
			Audit_Log::record( 'login_denied', 'user', $uid, array( 'method' => $provider ), 0 );
			return self::fail( 'not_active' );
		}

		$user = get_userdata( $uid );
		Session_Api::start_portal_session( $user, $provider );
		return self::redirect( Settings::frontend_url( $data['return'] ) );
	}

	/** Server-side code exchange. Returns the ID token or an error. Tokens are never logged or stored. */
	public static function exchange_code( string $provider, string $code, string $verifier ) {
		$resp = wp_remote_post(
			self::providers()[ $provider ]['token'],
			array(
				'timeout' => 10,
				'body'    => array(
					'grant_type'    => 'authorization_code',
					'code'          => $code,
					'redirect_uri'  => self::redirect_uri( $provider ),
					'client_id'     => self::client_id( $provider ),
					'client_secret' => self::client_secret( $provider ),
					'code_verifier' => $verifier,
				),
			)
		);
		if ( is_wp_error( $resp ) ) {
			return new WP_Error( 'b151_oauth_http', 'Token request failed.' );
		}
		$body = json_decode( (string) wp_remote_retrieve_body( $resp ), true );
		if ( 200 !== (int) wp_remote_retrieve_response_code( $resp ) || empty( $body['id_token'] ) ) {
			return new WP_Error( 'b151_oauth_token', 'Token response rejected.' );
		}
		return (string) $body['id_token'];
	}

	/** Fetch (and cache) the provider's signing keys. */
	public static function jwks( string $provider, bool $refresh = false ): ?array {
		$key = 'b151_jwks_' . $provider;
		if ( ! $refresh ) {
			$cached = get_transient( $key );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}
		$resp = wp_remote_get( self::providers()[ $provider ]['jwks'], array( 'timeout' => 10 ) );
		if ( is_wp_error( $resp ) || 200 !== (int) wp_remote_retrieve_response_code( $resp ) ) {
			return null;
		}
		$jwks = json_decode( (string) wp_remote_retrieve_body( $resp ), true );
		if ( ! is_array( $jwks ) || empty( $jwks['keys'] ) ) {
			return null;
		}
		set_transient( $key, $jwks, 6 * HOUR_IN_SECONDS );
		return $jwks;
	}

	/**
	 * Verify an ID token: RS256 signature with the provider's keys, issuer, audience, expiry (php-jwt), nonce,
	 * and for Google a verified e-mail.
	 *
	 * @return object|WP_Error claims
	 */
	public static function verify_id_token( string $provider, string $jwt, string $expected_nonce ) {
		if ( ! class_exists( JWT::class ) ) {
			return new WP_Error( 'b151_jwt_missing', 'JWT library missing.' );
		}
		JWT::$leeway = 60;
		$claims      = null;
		foreach ( array( false, true ) as $refresh ) {
			$jwks = self::jwks( $provider, $refresh );
			if ( ! $jwks ) {
				return new WP_Error( 'b151_jwks_unavailable', 'Signing keys unavailable.' );
			}
			try {
				$keys   = JWK::parseKeySet( $jwks, 'RS256' );
				$claims = JWT::decode( $jwt, $keys );
				break;
			} catch ( \UnexpectedValueException $e ) {
				// Unknown key id: keys may have rotated — refresh once.
				if ( $refresh || false === stripos( $e->getMessage(), 'kid' ) ) {
					return new WP_Error( 'b151_jwt_invalid', 'Invalid ID token.' );
				}
			} catch ( \Throwable $e ) {
				return new WP_Error( 'b151_jwt_invalid', 'Invalid ID token.' );
			}
		}
		if ( ! is_object( $claims ) ) {
			return new WP_Error( 'b151_jwt_invalid', 'Invalid ID token.' );
		}

		$aud = is_array( $claims->aud ?? null ) ? $claims->aud : array( $claims->aud ?? '' );
		if ( ! in_array( self::client_id( $provider ), $aud, true ) ) {
			return new WP_Error( 'b151_jwt_audience', 'Wrong audience.' );
		}
		if ( ! isset( $claims->exp ) ) {
			return new WP_Error( 'b151_jwt_expiry', 'Missing expiry.' );
		}
		if ( ! isset( $claims->nonce ) || ! hash_equals( $expected_nonce, (string) $claims->nonce ) ) {
			return new WP_Error( 'b151_jwt_nonce', 'Nonce mismatch.' );
		}
		$iss = (string) ( $claims->iss ?? '' );
		if ( 'google' === $provider ) {
			if ( ! in_array( $iss, array( 'https://accounts.google.com', 'accounts.google.com' ), true ) ) {
				return new WP_Error( 'b151_jwt_issuer', 'Wrong issuer.' );
			}
			if ( empty( $claims->sub ) ) {
				return new WP_Error( 'b151_jwt_subject', 'Missing subject.' );
			}
		} else {
			$tid = (string) ( $claims->tid ?? '' );
			if ( ! preg_match( '/^[0-9a-f-]{36}$/', $tid ) || 'https://login.microsoftonline.com/' . $tid . '/v2.0' !== $iss ) {
				return new WP_Error( 'b151_jwt_issuer', 'Wrong issuer.' );
			}
			if ( empty( $claims->oid ) ) {
				return new WP_Error( 'b151_jwt_subject', 'Missing subject.' );
			}
		}
		return $claims;
	}

	public static function subject( string $provider, object $claims ): string {
		return 'google' === $provider ? (string) $claims->sub : ( (string) $claims->tid . ':' . (string) $claims->oid );
	}

	public static function find_user_by_subject( string $provider, string $subject ): int {
		$users = get_users(
			array(
				'meta_key'   => self::providers()[ $provider ]['meta'], // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => $subject, // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 2,
				'fields'     => 'ID',
			)
		);
		return 1 === count( $users ) ? (int) $users[0] : 0;
	}

	/**
	 * First sign-in with a provider: link to the member whose account e-mail matches a provider-verified address.
	 * Google: `email_verified` must be true. Microsoft: only personal (consumer) accounts, whose e-mail Microsoft
	 * owns; work/school accounts must be linked from the member's profile while signed in (mode=link).
	 */
	public static function match_by_verified_email( string $provider, object $claims ): int {
		$email = '';
		if ( 'google' === $provider ) {
			if ( true !== ( $claims->email_verified ?? false ) && 'true' !== ( $claims->email_verified ?? '' ) ) {
				return 0;
			}
			$email = (string) ( $claims->email ?? '' );
		} elseif ( self::MS_CONSUMER_TENANT === ( $claims->tid ?? '' ) ) {
			$email = (string) ( $claims->email ?? '' );
		}
		$email = sanitize_email( $email );
		if ( '' === $email ) {
			return 0;
		}
		$user = get_user_by( 'email', $email );
		return $user ? (int) $user->ID : 0;
	}
}
