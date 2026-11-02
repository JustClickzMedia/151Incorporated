<?php
namespace B151\Members;

/**
 * The single place that decides "is this brother active / may he see member content / may he sign in".
 * Everything else (login gate, resolvers, directory) calls these methods. Dues rules plug in here later
 * through settings (ARCHITECTURE.md §3.6), without changing callers.
 */
final class Access {

	/**
	 * @return array{is_active:bool, has_member_access:bool, is_backend:bool, reasons:string[]}
	 */
	public static function standing( int $user_id ): array {
		$reasons = array();
		$user    = $user_id ? get_userdata( $user_id ) : false;
		if ( ! $user ) {
			return array( 'is_active' => false, 'has_member_access' => false, 'is_backend' => false, 'reasons' => array( 'no_user' ) );
		}

		$is_backend = user_can( $user, Roles::BACKEND_ACCESS );
		$status     = Membership::get_status( $user_id );
		$is_active  = Membership::STATUS_ACTIVE === $status;
		if ( ! $is_active ) {
			$reasons[] = 'status_' . $status;
		}

		$has_member_access = $is_active && user_can( $user, Roles::VIEW_MEMBER_CONTENT );

		// Backend accounts (admins) can always see the member area, unless explicitly suspended.
		if ( $is_backend && Membership::STATUS_SUSPENDED !== $status ) {
			$has_member_access = true;
		}

		/**
		 * Dues hook (deferred decisions). Receives and returns the standing array.
		 * Default behaviour (setting 'dues_affect' = 'nothing') leaves it unchanged.
		 */
		$standing = array(
			'is_active'         => $is_active,
			'has_member_access' => $has_member_access,
			'is_backend'        => $is_backend,
			'reasons'           => $reasons,
		);
		return (array) apply_filters( 'b151_member_standing', $standing, $user_id );
	}

	/** May this user sign in to the member area (password or Google/Microsoft)? */
	public static function can_sign_in( int $user_id ): bool {
		return self::standing( $user_id )['has_member_access'];
	}

	/** Current user may see member-only content (capability + eligible status). */
	public static function current_has_member_access(): bool {
		$id = get_current_user_id();
		return $id > 0 && self::standing( $id )['has_member_access'];
	}

	/**
	 * Current user may use an administrative capability: has the capability, isn't suspended, and the session is
	 * elevated (signed in through wp-login.php with two-step sign-in — never a member-area session).
	 */
	public static function current_can( string $cap ): bool {
		$id = get_current_user_id();
		return $id > 0
			&& current_user_can( $cap )
			&& Membership::STATUS_SUSPENDED !== Membership::get_status( $id )
			&& Sessions::is_elevated( $id );
	}

	/** Is the account backend-capable (admins)? */
	public static function is_backend_user( int $user_id ): bool {
		return $user_id > 0 && user_can( $user_id, Roles::BACKEND_ACCESS );
	}
}
