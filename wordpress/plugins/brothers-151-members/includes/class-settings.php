<?php
namespace B151\Members;

/**
 * Plugin settings with safe defaults (Members → Settings in wp-admin; stored in one option).
 */
final class Settings {

	public const OPTION = 'b151_members_settings';

	public static function defaults(): array {
		return array(
			'frontend_url'                => 'https://brothersof1-5-1.org',
			// Origins allowed to send credentialed (cookie) requests. localhost is added outside production only.
			'credential_origins'          => array( 'https://brothersof1-5-1.org', 'https://www.brothersof1-5-1.org' ),
			'idle_minutes_member'         => 30,
			'idle_minutes_backend'        => 15,
			'session_max_hours'           => 12,
			'login_max_failures'          => 5,
			'login_lock_minutes'          => 15,
			'password_min_length'         => 12,
			'require_two_factor_backend'  => true,
			'notify_members'              => true,  // approval / suspension emails
			'max_upload_mb'               => 64,    // resource files (host limit 64 MB)
			'directory_per_minute'        => 60,    // directory/profile lookups per member per minute
			'verify_per_minute'           => 30,    // verifyMember lookups per admin per minute
			// Hardening (class-hardening.php). All on by default; switch one off only if it breaks something.
			'harden_xmlrpc'               => true,
			'harden_jwt_login'            => true,
			'harden_private_types'        => true,
			'harden_enumeration'          => true,
			'harden_noindex'              => true,
			'harden_graphql'              => true,
			// Dues (ARCHITECTURE.md §3.6) — decisions deferred; 'nothing' keeps today's behaviour.
			'dues_affect'                 => 'nothing', // nothing | indicator | indicator_and_access
			'dues_exempt_classifications' => array(),
			'dues_grace_days'             => 0,
		);
	}

	public static function all(): array {
		$saved = get_option( self::OPTION, array() );
		return array_merge( self::defaults(), is_array( $saved ) ? $saved : array() );
	}

	public static function get( string $key ) {
		$all = self::all();
		return $all[ $key ] ?? null;
	}

	public static function update( array $values ): void {
		$clean = array_intersect_key( $values, self::defaults() );
		update_option( self::OPTION, array_merge( self::all(), $clean ), false );
	}

	/** Exact origins allowed for credentialed requests. */
	public static function credential_origins(): array {
		$origins = (array) self::get( 'credential_origins' );
		if ( 'production' !== wp_get_environment_type() ) {
			$origins[] = 'http://localhost:4200';
		}
		return array_values( array_unique( array_filter( $origins ) ) );
	}

	public static function frontend_url( string $path = '' ): string {
		return rtrim( (string) self::get( 'frontend_url' ), '/' ) . $path;
	}
}
