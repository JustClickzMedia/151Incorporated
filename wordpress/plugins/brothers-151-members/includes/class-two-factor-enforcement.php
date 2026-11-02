<?php
namespace B151\Members;

/**
 * Two-step sign-in is mandatory for every backend-capable account (ARCHITECTURE.md §4.5).
 * The free "Two Factor" plugin provides the factors; this class enforces enrolment.
 */
final class Two_Factor_Enforcement {

	public static function register(): void {
		add_action( 'admin_init', array( self::class, 'maybe_force_enrolment' ), 20 );
		add_action( 'admin_notices', array( self::class, 'notices' ) );
	}

	public static function plugin_available(): bool {
		return class_exists( '\Two_Factor_Core' );
	}

	public static function required(): bool {
		return (bool) Settings::get( 'require_two_factor_backend' );
	}

	/** Backend account that must still set up two-step sign-in. */
	public static function needs_enrolment( int $user_id ): bool {
		if ( ! $user_id || ! self::required() || ! Access::is_backend_user( $user_id ) ) {
			return false;
		}
		if ( ! self::plugin_available() ) {
			// Fail closed for admin operations through the portal; wp-admin shows a notice instead of locking out.
			return true;
		}
		return ! \Two_Factor_Core::is_user_using_two_factor( $user_id );
	}

	/** Where to send a backend user who has not enrolled yet (null = allowed). */
	public static function enrolment_redirect( int $user_id, string $pagenow ): ?string {
		if ( ! self::plugin_available() || ! self::needs_enrolment( $user_id ) ) {
			return null;
		}
		if ( in_array( $pagenow, array( 'profile.php', 'admin-ajax.php', 'admin-post.php' ), true ) ) {
			return null;
		}
		return admin_url( 'profile.php?b151_2fa_required=1#two-factor-options' );
	}

	public static function maybe_force_enrolment(): void {
		global $pagenow;
		$to = self::enrolment_redirect( get_current_user_id(), (string) $pagenow );
		if ( $to ) {
			wp_safe_redirect( $to );
			exit;
		}
	}

	public static function notices(): void {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( Roles::BACKEND_ACCESS ) ) {
			return;
		}
		if ( self::required() && ! self::plugin_available() && current_user_can( 'activate_plugins' ) ) {
			echo '<div class="notice notice-error"><p><strong>Brothers of 1-5-1 Members:</strong> two-step sign-in is required for admin accounts, but the Two Factor plugin is not active. Install and activate it; until then admin actions in the member area are disabled.</p></div>';
		}
		if ( isset( $_GET['b151_2fa_required'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			echo '<div class="notice notice-warning"><p>Your account can manage the site, so two-step sign-in is required. Set up an authenticator app (and save backup codes) below to continue.</p></div>';
		}
	}
}
