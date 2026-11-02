<?php
namespace B151\Members;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_Session_Tokens;
use WP_User;

/**
 * Member-area sign-in over REST (namespace b151/v1). Uses WordPress's own cookie session: the browser receives
 * HttpOnly cookies, JavaScript receives only a short-lived WordPress nonce (X-WP-Nonce) for CSRF protection.
 * Nothing secret is ever stored in localStorage. See ARCHITECTURE.md §4.
 */
final class Session_Api {

	public const NS = 'b151/v1';

	public const GENERIC_LOGIN_ERROR = 'The email or password is not correct, or this account is not active yet.';

	/** Captured value of the logged_in cookie set during this request (so the nonce matches the new session). */
	private static string $new_logged_in_cookie = '';

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'routes' ) );
		add_action( 'set_logged_in_cookie', array( self::class, 'capture_logged_in_cookie' ), 10, 1 );
	}

	public static function capture_logged_in_cookie( $cookie ): void {
		self::$new_logged_in_cookie = (string) $cookie;
		if ( defined( 'LOGGED_IN_COOKIE' ) ) {
			$_COOKIE[ LOGGED_IN_COOKIE ] = (string) $cookie;
		}
	}

	public static function routes(): void {
		$origin_check = array( self::class, 'origin_permission' );

		register_rest_route(
			self::NS,
			'/session',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( self::class, 'get_session' ),
					'permission_callback' => $origin_check,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( self::class, 'create_session' ),
					'permission_callback' => $origin_check,
					'args'                => array(
						'username' => array( 'type' => 'string', 'required' => true ),
						'password' => array( 'type' => 'string', 'required' => true ),
					),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( self::class, 'delete_session' ),
					'permission_callback' => $origin_check,
				),
			)
		);

		register_rest_route(
			self::NS,
			'/session/password-reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'request_password_reset' ),
				'permission_callback' => $origin_check,
				'args'                => array( 'email' => array( 'type' => 'string', 'required' => true ) ),
			)
		);

		register_rest_route(
			self::NS,
			'/session/password-reset/confirm',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'confirm_password_reset' ),
				'permission_callback' => $origin_check,
				'args'                => array(
					'login'    => array( 'type' => 'string', 'required' => true ),
					'key'      => array( 'type' => 'string', 'required' => true ),
					'password' => array( 'type' => 'string', 'required' => true ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/session/password',
			array(
				'methods'             => 'POST',
				'callback'            => array( self::class, 'change_password' ),
				'permission_callback' => static function ( WP_REST_Request $r ) {
					$o = self::origin_permission( $r );
					if ( true !== $o ) {
						return $o;
					}
					return is_user_logged_in() ? true : new WP_Error( 'b151_not_signed_in', 'Please sign in.', array( 'status' => 401 ) );
				},
				'args'                => array(
					'current_password' => array( 'type' => 'string', 'required' => true ),
					'new_password'     => array( 'type' => 'string', 'required' => true ),
				),
			)
		);
	}

	/**
	 * Browsers always send Origin on cross-origin requests. A request from any origin other than ours is refused,
	 * so a foreign site can never read a session nonce or member data with the visitor's cookies.
	 */
	public static function origin_permission( WP_REST_Request $request ) {
		$origin = $request->get_header( 'origin' );
		if ( null === $origin || '' === $origin ) {
			return true;
		}
		if ( Cors::origin_allowed( $origin ) || self::is_same_origin( $origin ) ) {
			return true;
		}
		return new WP_Error( 'b151_origin_forbidden', 'Origin not allowed.', array( 'status' => 403 ) );
	}

	private static function is_same_origin( string $origin ): bool {
		$home = wp_parse_url( home_url() );
		$o    = wp_parse_url( $origin );
		return $home && $o && ( $home['host'] ?? '' ) === ( $o['host'] ?? '' ) && ( $home['scheme'] ?? '' ) === ( $o['scheme'] ?? '' );
	}

	/* ------------------------------------------------------------------ */

	/** POST /session — sign in with email (or username) and password. */
	public static function create_session( WP_REST_Request $request ) {
		$login    = trim( (string) $request->get_param( 'username' ) );
		$password = (string) $request->get_param( 'password' );
		$ip       = Rate_Limiter::client_ip();
		$max      = (int) Settings::get( 'login_max_failures' );
		$window   = (int) Settings::get( 'login_lock_minutes' ) * MINUTE_IN_SECONDS;

		if ( Rate_Limiter::exceeded( 'login_user', $login, $max ) || Rate_Limiter::exceeded( 'login_ip', $ip, $max * 4 ) ) {
			Audit_Log::record( 'login_throttled', 'user', 0, array(), 0 );
			return new WP_Error( 'b151_too_many_attempts', 'Too many sign-in attempts. Please wait a few minutes and try again.', array( 'status' => 429 ) );
		}

		$user = wp_authenticate( $login, $password );

		if ( is_wp_error( $user ) ) {
			// Backend accounts with two-step sign-in are refused by the Two Factor plugin for API sign-in. They sign in
			// through wp-login.php (which checks the second factor); the cookie then works for the member area too.
			if ( 'invalid_application_credentials' === $user->get_error_code() ) {
				return new WP_Error(
					'b151_use_admin_sign_in',
					'This account uses two-step sign-in. Please sign in on the admin sign-in page.',
					array( 'status' => 403, 'sign_in_url' => wp_login_url( Settings::frontend_url( '/members' ) ) )
				);
			}
			Rate_Limiter::hit( 'login_user', $login, $window );
			Rate_Limiter::hit( 'login_ip', $ip, $window );
			Audit_Log::record( 'login_failed', 'user', 0, array( 'method' => 'password' ), 0 );
			return new WP_Error( 'b151_invalid_login', self::GENERIC_LOGIN_ERROR, array( 'status' => 401 ) );
		}

		if ( ! Access::can_sign_in( $user->ID ) ) {
			Rate_Limiter::hit( 'login_user', $login, $window );
			Audit_Log::record( 'login_denied', 'user', $user->ID, array( 'reasons' => Access::standing( $user->ID )['reasons'] ), 0 );
			return new WP_Error( 'b151_invalid_login', self::GENERIC_LOGIN_ERROR, array( 'status' => 401 ) );
		}

		Rate_Limiter::reset( 'login_user', $login );
		self::start_portal_session( $user, 'password' );
		return self::session_response( $user->ID, wp_get_session_token(), true );
	}

	/**
	 * Create a member-area session cookie for a verified user. Deliberately does not fire `wp_login`
	 * (the Two Factor plugin would hijack the request); auditing is done here instead.
	 */
	public static function start_portal_session( WP_User $user, string $method ): void {
		Sessions::mark_next_as_portal();
		wp_set_auth_cookie( $user->ID, false, is_ssl() );
		wp_set_current_user( $user->ID );
		Sessions::reset_cache();
		Audit_Log::record( 'login_succeeded', 'user', $user->ID, array( 'method' => $method ), $user->ID );
	}

	/** GET /session — who is signed in (reads the HttpOnly cookie itself; returns a fresh nonce). */
	public static function get_session( WP_REST_Request $request ) {
		$cookie = isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) ? (string) $_COOKIE[ LOGGED_IN_COOKIE ] : ''; // phpcs:ignore
		$uid    = $cookie ? (int) wp_validate_auth_cookie( $cookie, 'logged_in' ) : 0;
		if ( ! $uid ) {
			return self::anonymous();
		}
		$parts = wp_parse_auth_cookie( $cookie, 'logged_in' );
		$token = is_array( $parts ) ? (string) $parts['token'] : '';
		if ( ! Sessions::validate( $uid, $token, ! Sessions::is_passive_request() ) ) {
			return self::anonymous();
		}
		if ( ! Access::can_sign_in( $uid ) ) {
			WP_Session_Tokens::get_instance( $uid )->destroy( $token );
			return self::anonymous();
		}
		wp_set_current_user( $uid );
		return self::session_response( $uid, $token, false );
	}

	/** DELETE /session — sign out of this browser. */
	public static function delete_session( WP_REST_Request $request ) {
		$cookie = isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) ? (string) $_COOKIE[ LOGGED_IN_COOKIE ] : ''; // phpcs:ignore
		$uid    = $cookie ? (int) wp_validate_auth_cookie( $cookie, 'logged_in' ) : 0;
		$parts  = $cookie ? wp_parse_auth_cookie( $cookie, 'logged_in' ) : false;
		$token  = is_array( $parts ) ? (string) $parts['token'] : '';
		if ( $uid ) {
			Audit_Log::record( 'logout', 'user', $uid, array(), $uid );
		}
		Sessions::end_current( $uid, $token );
		wp_set_current_user( 0 );
		return new WP_REST_Response( array( 'authenticated' => false ), 200 );
	}

	/** POST /session/password-reset — always the same answer, whether or not the address exists. */
	public static function request_password_reset( WP_REST_Request $request ) {
		$email = sanitize_email( (string) $request->get_param( 'email' ) );
		$ip    = Rate_Limiter::client_ip();
		$hour  = HOUR_IN_SECONDS;

		$generic = new WP_REST_Response( array( 'message' => 'If that address belongs to an active member, a reset link is on its way.' ), 202 );

		if ( Rate_Limiter::exceeded( 'reset_ip', $ip, 10 ) || Rate_Limiter::exceeded( 'reset_email', $email, 3 ) ) {
			return $generic;
		}
		Rate_Limiter::hit( 'reset_ip', $ip, $hour );
		Rate_Limiter::hit( 'reset_email', $email, $hour );

		$user = $email ? get_user_by( 'email', $email ) : false;
		if ( $user && Access::can_sign_in( $user->ID ) ) {
			add_filter( 'retrieve_password_message', array( self::class, 'reset_message' ), 20, 4 );
			$sent = retrieve_password( $user->user_login );
			remove_filter( 'retrieve_password_message', array( self::class, 'reset_message' ), 20 );
			Audit_Log::record( 'password_reset_requested', 'user', $user->ID, array( 'sent' => true === $sent ), 0 );
		}
		return $generic;
	}

	/** The reset link points at the member area, not wp-login.php. */
	public static function reset_message( $message, $key, $user_login, $user_data ): string {
		$link = Settings::frontend_url( '/members/reset-password' ) . '?' . http_build_query(
			array(
				'login' => $user_login,
				'key'   => $key,
			)
		);
		return "Someone asked to reset the password for your Brothers of 1-5-1 member account.\r\n\r\n"
			. "If this wasn't you, ignore this email and nothing will change.\r\n\r\n"
			. "To choose a new password, open this link (it works once and expires in 24 hours):\r\n\r\n"
			. $link . "\r\n";
	}

	/** POST /session/password-reset/confirm */
	public static function confirm_password_reset( WP_REST_Request $request ) {
		$ip = Rate_Limiter::client_ip();
		if ( Rate_Limiter::exceeded( 'reset_confirm_ip', $ip, 20 ) ) {
			return new WP_Error( 'b151_too_many_attempts', 'Too many attempts. Please wait and try again.', array( 'status' => 429 ) );
		}
		Rate_Limiter::hit( 'reset_confirm_ip', $ip, HOUR_IN_SECONDS );

		$user = check_password_reset_key( (string) $request->get_param( 'key' ), (string) $request->get_param( 'login' ) );
		if ( is_wp_error( $user ) ) {
			return new WP_Error( 'b151_reset_invalid', 'This reset link is invalid or has expired. Please request a new one.', array( 'status' => 400 ) );
		}
		$password = (string) $request->get_param( 'password' );
		$policy   = self::check_password_policy( $password, $user );
		if ( is_wp_error( $policy ) ) {
			return $policy;
		}
		reset_password( $user, $password );
		WP_Session_Tokens::get_instance( $user->ID )->destroy_all();
		Audit_Log::record( 'password_reset_completed', 'user', $user->ID, array(), $user->ID );
		return new WP_REST_Response( array( 'message' => 'Your password has been changed. Please sign in.' ), 200 );
	}

	/** POST /session/password — change password while signed in (signs out every other session). */
	public static function change_password( WP_REST_Request $request ) {
		$user = wp_get_current_user();
		if ( ! wp_check_password( (string) $request->get_param( 'current_password' ), $user->user_pass, $user->ID ) ) {
			Audit_Log::record( 'password_change_failed', 'user', $user->ID );
			return new WP_Error( 'b151_wrong_password', 'Your current password is not correct.', array( 'status' => 400 ) );
		}
		$new    = (string) $request->get_param( 'new_password' );
		$policy = self::check_password_policy( $new, $user );
		if ( is_wp_error( $policy ) ) {
			return $policy;
		}
		$was_portal = Sessions::is_portal_session( $user->ID );
		wp_set_password( $new, $user->ID );
		WP_Session_Tokens::get_instance( $user->ID )->destroy_all();
		Audit_Log::record( 'password_changed', 'user', $user->ID );
		// Old cookies no longer validate (the password hash changed); issue a fresh session for this browser.
		$fresh = get_userdata( $user->ID );
		if ( $was_portal ) {
			Sessions::mark_next_as_portal();
		}
		wp_set_auth_cookie( $fresh->ID, false, is_ssl() );
		wp_set_current_user( $fresh->ID );
		Sessions::reset_cache();
		return self::session_response( $fresh->ID, wp_get_session_token(), false );
	}

	/** @return true|WP_Error */
	public static function check_password_policy( string $password, WP_User $user ) {
		$min = (int) Settings::get( 'password_min_length' );
		if ( mb_strlen( $password ) < $min ) {
			return new WP_Error( 'b151_weak_password', sprintf( 'Use at least %d characters.', $min ), array( 'status' => 400 ) );
		}
		$lower = strtolower( $password );
		if ( $lower === strtolower( $user->user_login ) || $lower === strtolower( $user->user_email ) ) {
			return new WP_Error( 'b151_weak_password', 'Your password cannot be your email address or username.', array( 'status' => 400 ) );
		}
		return true;
	}

	/* ------------------------------------------------------------------ */

	private static function anonymous(): WP_REST_Response {
		return new WP_REST_Response( array( 'authenticated' => false ), 200 );
	}

	private static function session_response( int $uid, string $token, bool $created ): WP_REST_Response {
		$remaining = Sessions::remaining( $uid, $token );
		return new WP_REST_Response(
			array(
				'authenticated'          => true,
				'nonce'                  => wp_create_nonce( 'wp_rest' ),
				'member'                 => self::member_payload( $uid ),
				'idle_seconds_remaining' => $remaining['idle_seconds_remaining'] ?? 0,
				'idle_limit_seconds'     => $remaining['idle_limit'] ?? 0,
				'warning_seconds'        => 120,
				'expires_at'             => isset( $remaining['expires_at'] ) ? gmdate( 'c', $remaining['expires_at'] ) : null,
				'admin_session'          => Sessions::is_elevated( $uid, $token ),
			),
			$created ? 201 : 200
		);
	}

	/** What the signed-in member may know about himself. */
	public static function member_payload( int $uid ): array {
		$user     = get_userdata( $uid );
		$standing = Access::standing( $uid );
		$caps     = array();
		foreach ( Roles::all_plugin_caps() as $cap ) {
			if ( user_can( $uid, $cap ) ) {
				$caps[] = $cap;
			}
		}
		return array(
			'id'               => $uid,
			'display_name'     => Membership::get_profile_value( $uid, 'display_name' ),
			'email'            => $user ? $user->user_email : '',
			'membership_number' => Membership::get_number( $uid ),
			'status'           => Membership::get_status( $uid ),
			'classification'   => Membership::get_classification( $uid ),
			'chapter'          => Chapters::summary( Membership::get_chapter_id( $uid ) ),
			'is_active'        => $standing['is_active'],
			'is_backend'       => $standing['is_backend'],
			'capabilities'     => $caps, // For showing/hiding UI only — the server re-checks every action.
		);
	}
}
