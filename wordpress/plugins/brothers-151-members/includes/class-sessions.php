<?php
namespace B151\Members;

use WP_Session_Tokens;

/**
 * Session lifetime rules on top of WordPress's own session tokens (ARCHITECTURE.md §4.3):
 *  - idle limit: members 30 min, backend-capable accounts 15 min (settings);
 *  - absolute limit: 12 h from sign-in, no "remember me";
 *  - only real activity extends a session. Requests that send `X-B151-Activity: passive`
 *    (the Angular idle-warning poll) never extend it.
 *
 * A session created by the member-area sign-in (password via the REST endpoint, Google, Microsoft) is a
 * "portal" session. Portal sessions never carry administrative power: admin operations require a session created
 * through wp-login.php, where the Two Factor plugin applies the second factor (see is_elevated()).
 */
final class Sessions {

	public const KEY_LAST_ACTIVITY = 'b151_last_activity';
	public const KEY_PORTAL        = 'b151_portal';
	public const TOUCH_INTERVAL    = 60; // seconds between activity writes

	private static bool $next_is_portal = false;

	/** @var array<string,bool> per-request cache of validated sessions */
	private static array $checked = array();

	public static function register(): void {
		add_filter( 'attach_session_information', array( self::class, 'attach_session_information' ), 20, 2 );
		add_filter( 'determine_current_user', array( self::class, 'filter_current_user' ), 99 );
		add_filter( 'auth_cookie_expiration', array( self::class, 'cookie_expiration' ), 99 );
	}

	/** Mark the next session created in this request as a member-area (portal) session. */
	public static function mark_next_as_portal(): void {
		self::$next_is_portal = true;
	}

	public static function attach_session_information( array $session, int $user_id ): array {
		$session[ self::KEY_LAST_ACTIVITY ] = time();
		if ( self::$next_is_portal ) {
			$session[ self::KEY_PORTAL ] = true;
			self::$next_is_portal        = false;
		}
		return $session;
	}

	public static function cookie_expiration(): int {
		return max( 1, (int) Settings::get( 'session_max_hours' ) ) * HOUR_IN_SECONDS;
	}

	/** Idle limit in seconds for this account. */
	public static function idle_limit( int $user_id ): int {
		$minutes = Access::is_backend_user( $user_id ) ? Settings::get( 'idle_minutes_backend' ) : Settings::get( 'idle_minutes_member' );
		return max( 1, (int) $minutes ) * MINUTE_IN_SECONDS;
	}

	public static function is_passive_request(): bool {
		$h = isset( $_SERVER['HTTP_X_B151_ACTIVITY'] ) ? strtolower( (string) $_SERVER['HTTP_X_B151_ACTIVITY'] ) : ''; // phpcs:ignore
		return 'passive' === $h;
	}

	/** determine_current_user: drop the user if the session is idle or past its absolute limit. */
	public static function filter_current_user( $user_id ) {
		if ( ! $user_id ) {
			return $user_id;
		}
		$token = wp_get_session_token();
		if ( '' === $token ) {
			return $user_id; // Not a cookie session (e.g. WP-CLI). Application passwords are never "elevated".
		}
		return self::validate( (int) $user_id, $token, ! self::is_passive_request() ) ? $user_id : 0;
	}

	/**
	 * Validate (and optionally extend) a session. Expired sessions are destroyed.
	 */
	public static function validate( int $user_id, string $token, bool $touch = true ): bool {
		$cache_key = $user_id . ':' . hash( 'sha256', $token );
		if ( isset( self::$checked[ $cache_key ] ) ) {
			return self::$checked[ $cache_key ];
		}
		$manager = WP_Session_Tokens::get_instance( $user_id );
		$session = $manager->get( $token );
		if ( ! $session ) {
			return self::$checked[ $cache_key ] = false;
		}
		$now   = time();
		$login = (int) ( $session['login'] ?? $now );
		$last  = (int) ( $session[ self::KEY_LAST_ACTIVITY ] ?? $login );

		$reason = '';
		if ( $now - $login > self::cookie_expiration() ) {
			$reason = 'absolute';
		} elseif ( $now - $last > self::idle_limit( $user_id ) ) {
			$reason = 'idle';
		}
		if ( $reason ) {
			$manager->destroy( $token );
			// Actor passed explicitly: we are inside determine_current_user.
			Audit_Log::record( 'session_expired', 'user', $user_id, array( 'reason' => $reason ), $user_id );
			return self::$checked[ $cache_key ] = false;
		}
		if ( $touch && $now - $last >= self::TOUCH_INTERVAL ) {
			$session[ self::KEY_LAST_ACTIVITY ] = $now;
			$manager->update( $token, $session );
		}
		return self::$checked[ $cache_key ] = true;
	}

	/** Clear the per-request cache (tests, or after sign-in/out). */
	public static function reset_cache(): void {
		self::$checked = array();
	}

	/** @return array<string,mixed>|null */
	public static function current_session( int $user_id = 0, string $token = '' ): ?array {
		$user_id = $user_id ?: get_current_user_id();
		$token   = $token ?: wp_get_session_token();
		if ( ! $user_id || '' === $token ) {
			return null;
		}
		$s = WP_Session_Tokens::get_instance( $user_id )->get( $token );
		return $s ?: null;
	}

	/**
	 * Seconds left before idle logout and the absolute expiry timestamp.
	 *
	 * @return array{idle_seconds_remaining:int, expires_at:int, idle_limit:int}|null
	 */
	public static function remaining( int $user_id, string $token ): ?array {
		$s = self::current_session( $user_id, $token );
		if ( ! $s ) {
			return null;
		}
		$now  = time();
		$last = (int) ( $s[ self::KEY_LAST_ACTIVITY ] ?? $s['login'] );
		$lim  = self::idle_limit( $user_id );
		$abs  = (int) $s['login'] + self::cookie_expiration();
		return array(
			'idle_seconds_remaining' => max( 0, min( $lim - ( $now - $last ), $abs - $now ) ),
			'expires_at'             => $abs,
			'idle_limit'             => $lim,
		);
	}

	public static function is_portal_session( int $user_id = 0, string $token = '' ): bool {
		$s = self::current_session( $user_id, $token );
		return $s ? ! empty( $s[ self::KEY_PORTAL ] ) : false;
	}

	/**
	 * May the current session use administrative capabilities? Only a cookie session created through wp-login.php
	 * (not a portal session) and, when 2FA is required, only once the account has two-step sign-in set up.
	 */
	public static function is_elevated( int $user_id = 0, string $token = '' ): bool {
		$user_id = $user_id ?: get_current_user_id();
		$s       = self::current_session( $user_id, $token );
		if ( ! $s || ! empty( $s[ self::KEY_PORTAL ] ) ) {
			return false;
		}
		return ! Two_Factor_Enforcement::needs_enrolment( $user_id );
	}

	/** Sign the current session out (destroy its token and clear cookies). */
	public static function end_current( int $user_id, string $token ): void {
		if ( $user_id && '' !== $token ) {
			WP_Session_Tokens::get_instance( $user_id )->destroy( $token );
		}
		wp_clear_auth_cookie();
		self::reset_cache();
	}
}
