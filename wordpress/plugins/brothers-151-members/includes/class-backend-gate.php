<?php
namespace B151\Members;

/**
 * Keeps members out of wp-admin (owner decision: members use only the front-end member area).
 * Only accounts with b151_backend_access (admin tiers, WordPress administrators) may use the backend.
 */
final class Backend_Gate {

	public static function register(): void {
		add_action( 'admin_init', array( self::class, 'maybe_redirect' ), 1 );
		add_filter( 'show_admin_bar', array( self::class, 'show_admin_bar' ) );
		add_filter( 'login_redirect', array( self::class, 'login_redirect' ), 20, 3 );
		add_filter( 'editable_roles', array( self::class, 'editable_roles' ) );
	}

	/**
	 * Decide where (if anywhere) to send a user who requested a wp-admin page.
	 */
	public static function admin_redirect_for( int $user_id, string $pagenow ): ?string {
		if ( ! $user_id || wp_doing_ajax() || in_array( $pagenow, array( 'admin-ajax.php', 'admin-post.php' ), true ) ) {
			return null;
		}
		if ( ! user_can( $user_id, Roles::BACKEND_ACCESS ) ) {
			return Settings::frontend_url( '/members' );
		}
		// A backend account that signed in through the member area must sign in again through wp-login.php,
		// where the second factor is checked, before using the backend.
		if ( Sessions::is_portal_session( $user_id ) ) {
			return wp_login_url( admin_url(), true );
		}
		return null;
	}

	public static function maybe_redirect(): void {
		global $pagenow;
		$to = self::admin_redirect_for( get_current_user_id(), (string) $pagenow );
		if ( $to ) {
			wp_redirect( $to ); // phpcs:ignore WordPress.Security.SafeRedirect -- configured front-end URL or wp-login.
			exit;
		}
	}

	public static function show_admin_bar( $show ) {
		return $show && current_user_can( Roles::BACKEND_ACCESS );
	}

	public static function login_redirect( $redirect_to, $requested, $user ) {
		if ( $user instanceof \WP_User && ! user_can( $user, Roles::BACKEND_ACCESS ) ) {
			return Settings::frontend_url( '/members' );
		}
		return $redirect_to;
	}

	/** Only accounts allowed to grant backend roles see those roles in role pickers. */
	public static function editable_roles( array $roles ): array {
		if ( current_user_can( Roles::ASSIGN_BACKEND_ROLES ) ) {
			return $roles;
		}
		foreach ( Roles::backend_roles() as $role ) {
			unset( $roles[ $role ] );
		}
		return $roles;
	}
}
