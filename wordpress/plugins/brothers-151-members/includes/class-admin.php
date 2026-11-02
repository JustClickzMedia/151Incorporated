<?php
namespace B151\Members;

/**
 * Minimal wp-admin screens for Checkpoint 2: membership columns on Users, a Membership box on the profile screen,
 * and the Members settings page. Richer admin tools (roster, exports, audit viewer) come in later checkpoints.
 */
final class Admin {

	public static function register(): void {
		if ( ! is_admin() ) {
			return;
		}
		add_filter( 'manage_users_columns', array( self::class, 'columns' ) );
		add_filter( 'manage_users_custom_column', array( self::class, 'column_value' ), 10, 3 );
		add_action( 'show_user_profile', array( self::class, 'profile_box' ), 5 );
		add_action( 'edit_user_profile', array( self::class, 'profile_box' ), 5 );
		add_action( 'edit_user_profile_update', array( self::class, 'save_profile_box' ) );
		add_action( 'personal_options_update', array( self::class, 'save_profile_box' ) );
		add_action( 'admin_menu', array( self::class, 'menu' ) );
	}

	public static function columns( array $cols ): array {
		$cols['b151_status'] = 'Membership';
		$cols['b151_number'] = 'Member #';
		return $cols;
	}

	public static function column_value( $out, $col, $user_id ) {
		if ( 'b151_status' === $col ) {
			return esc_html( ucfirst( Membership::get_status( (int) $user_id ) ) );
		}
		if ( 'b151_number' === $col ) {
			return esc_html( Membership::get_number( (int) $user_id ) );
		}
		return $out;
	}

	public static function profile_box( \WP_User $user ): void {
		if ( ! current_user_can( Roles::MANAGE_MEMBERS ) ) {
			return;
		}
		$can_status = current_user_can( Roles::CHANGE_MEMBER_STATUS ) && get_current_user_id() !== $user->ID;
		$status     = Membership::get_status( $user->ID );
		$class      = Membership::get_classification( $user->ID );
		$chapter    = Membership::get_chapter_id( $user->ID );
		$chapters   = get_posts( array( 'post_type' => Chapters::POST_TYPE, 'numberposts' => 200, 'post_status' => 'publish', 'orderby' => 'title', 'order' => 'ASC' ) );
		wp_nonce_field( 'b151_member_box', 'b151_member_box_nonce' );
		?>
		<h2>Brothers of 1-5-1 membership</h2>
		<table class="form-table" role="presentation">
			<tr><th>Membership number</th><td><code><?php echo esc_html( Membership::get_number( $user->ID ) ?: '— (assigned on approval)' ); ?></code></td></tr>
			<tr><th><label for="b151_status">Status</label></th><td>
				<select name="b151_status" id="b151_status" <?php disabled( ! $can_status ); ?>>
					<?php foreach ( Membership::STATUSES as $s ) : ?>
						<option value="<?php echo esc_attr( $s ); ?>" <?php selected( $status, $s ); ?>><?php echo esc_html( ucfirst( $s ) ); ?></option>
					<?php endforeach; ?>
				</select>
				<input type="text" name="b151_status_reason" placeholder="Reason (kept in the audit log)" class="regular-text" <?php disabled( ! $can_status ); ?> />
			</td></tr>
			<tr><th><label for="b151_classification">Classification</label></th><td>
				<select name="b151_classification" id="b151_classification">
					<?php foreach ( Membership::CLASSIFICATIONS as $c ) : ?>
						<option value="<?php echo esc_attr( $c ); ?>" <?php selected( $class, $c ); ?>><?php echo esc_html( ucwords( str_replace( '_', ' ', $c ) ) ); ?></option>
					<?php endforeach; ?>
				</select>
			</td></tr>
			<tr><th><label for="b151_chapter">Chapter</label></th><td>
				<select name="b151_chapter" id="b151_chapter">
					<option value="0">—</option>
					<?php foreach ( $chapters as $ch ) : ?>
						<option value="<?php echo (int) $ch->ID; ?>" <?php selected( $chapter, $ch->ID ); ?>><?php echo esc_html( $ch->post_title ); ?></option>
					<?php endforeach; ?>
				</select>
			</td></tr>
		</table>
		<?php
	}

	public static function save_profile_box( int $user_id ): void {
		if ( ! isset( $_POST['b151_member_box_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['b151_member_box_nonce'] ) ), 'b151_member_box' ) ) {
			return;
		}
		if ( ! current_user_can( Roles::MANAGE_MEMBERS ) ) {
			return;
		}
		$class = isset( $_POST['b151_classification'] ) ? sanitize_key( wp_unslash( $_POST['b151_classification'] ) ) : '';
		if ( $class && $class !== Membership::get_classification( $user_id ) ) {
			Membership::set_classification( $user_id, $class );
		}
		$chapter = isset( $_POST['b151_chapter'] ) ? (int) $_POST['b151_chapter'] : null;
		if ( null !== $chapter && $chapter !== Membership::get_chapter_id( $user_id ) ) {
			Membership::set_chapter( $user_id, $chapter );
		}
		if ( current_user_can( Roles::CHANGE_MEMBER_STATUS ) && get_current_user_id() !== $user_id && isset( $_POST['b151_status'] ) ) {
			$new = sanitize_key( wp_unslash( $_POST['b151_status'] ) );
			$old = Membership::get_status( $user_id );
			if ( $new !== $old ) {
				if ( Membership::STATUS_PENDING === $old && Membership::STATUS_ACTIVE === $new ) {
					Membership::approve( $user_id, Membership::get_classification( $user_id ) );
				} else {
					Membership::set_status( $user_id, $new, isset( $_POST['b151_status_reason'] ) ? sanitize_text_field( wp_unslash( $_POST['b151_status_reason'] ) ) : '' );
				}
			}
		}
	}

	public static function menu(): void {
		add_options_page( 'Members Portal', 'Members Portal', Roles::MANAGE_SETTINGS, 'b151-members', array( self::class, 'settings_page' ) );
	}

	public static function settings_page(): void {
		if ( ! current_user_can( Roles::MANAGE_SETTINGS ) ) {
			return;
		}
		$numeric = array(
			'idle_minutes_member'  => 'Member idle sign-out (minutes)',
			'idle_minutes_backend' => 'Admin idle sign-out (minutes)',
			'session_max_hours'    => 'Maximum session length (hours)',
			'login_max_failures'   => 'Failed sign-ins before a pause',
			'login_lock_minutes'   => 'Pause length (minutes)',
			'password_min_length'  => 'Minimum password length',
		);
		if ( isset( $_POST['b151_settings_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['b151_settings_nonce'] ) ), 'b151_settings' ) ) {
			$values = array();
			foreach ( array_keys( $numeric ) as $k ) {
				if ( isset( $_POST[ $k ] ) ) {
					$values[ $k ] = max( 1, (int) $_POST[ $k ] );
				}
			}
			$values['require_two_factor_backend'] = ! empty( $_POST['require_two_factor_backend'] );
			Settings::update( $values );
			Audit_Log::record( 'settings_updated', 'settings', 0, array( 'keys' => array_keys( $values ) ) );
			echo '<div class="notice notice-success"><p>Saved.</p></div>';
		}
		$s = Settings::all();
		?>
		<div class="wrap"><h1>Members Portal</h1>
		<form method="post"><?php wp_nonce_field( 'b151_settings', 'b151_settings_nonce' ); ?>
		<table class="form-table" role="presentation">
			<?php foreach ( $numeric as $k => $label ) : ?>
				<tr><th><label for="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $label ); ?></label></th>
				<td><input type="number" min="1" id="<?php echo esc_attr( $k ); ?>" name="<?php echo esc_attr( $k ); ?>" value="<?php echo (int) $s[ $k ]; ?>" /></td></tr>
			<?php endforeach; ?>
			<tr><th>Two-step sign-in</th><td><label><input type="checkbox" name="require_two_factor_backend" value="1" <?php checked( $s['require_two_factor_backend'] ); ?> /> Required for every admin account</label></td></tr>
		</table>
		<?php submit_button(); ?>
		</form></div>
		<?php
	}
}
