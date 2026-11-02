<?php
namespace B151\Members;

/**
 * wp-admin screens under one "1-5-1 Members" menu: pending approvals, member events, announcements, resources,
 * chapters, roster export, audit log and settings; plus membership columns on Users and a Membership box on
 * the profile screen. Every action checks capability + nonce; admin powers need an elevated session (Access).
 */
final class Admin {

	public const MENU_SLUG = 'b151-members';

	public static function register(): void {
		add_action( 'admin_post_b151_export_roster', array( self::class, 'export_roster' ) );
		add_action( 'admin_post_b151_approve', array( self::class, 'handle_approve' ) );
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
		add_action( 'add_meta_boxes', array( self::class, 'meta_boxes' ) );
		add_action( 'save_post', array( self::class, 'save_post' ), 10, 2 );
		add_action( 'post_edit_form_tag', array( self::class, 'form_enctype' ) );
	}

	/* ---------------- menu ---------------- */

	public static function menu(): void {
		add_menu_page( '1-5-1 Members', '1-5-1 Members', Roles::BACKEND_ACCESS, self::MENU_SLUG, array( self::class, 'pending_page' ), 'dashicons-shield', 26 );
		add_submenu_page( self::MENU_SLUG, 'Pending approvals', 'Pending approvals', Roles::APPROVE_MEMBERS, self::MENU_SLUG, array( self::class, 'pending_page' ) );
		add_submenu_page( self::MENU_SLUG, 'Roster export', 'Roster export', Roles::EXPORT_ROSTER, 'b151-roster', array( self::class, 'roster_page' ) );
		add_submenu_page( self::MENU_SLUG, 'Audit log', 'Audit log', Roles::VIEW_AUDIT_LOG, 'b151-audit', array( self::class, 'audit_page' ) );
		add_submenu_page( self::MENU_SLUG, 'Settings', 'Settings', Roles::MANAGE_SETTINGS, 'b151-settings', array( self::class, 'settings_page' ) );
	}

	private static function deny_unless( string $cap ): void {
		if ( ! Access::current_can( $cap ) ) {
			wp_die( esc_html__( 'You do not have permission to do that.' ), 403 );
		}
	}

	/* ---------------- pending approvals ---------------- */

	public static function pending_page(): void {
		self::deny_unless( Roles::APPROVE_MEMBERS );
		$ids = get_users(
			array(
				'fields'       => 'ID',
				'number'       => 200,
				'role__not_in' => Roles::backend_roles(),
				'orderby'      => 'registered',
				'meta_query'   => array( // phpcs:ignore WordPress.DB.SlowDBQuery
					'relation' => 'OR',
					array( 'key' => Membership::META_STATUS, 'value' => Membership::STATUS_PENDING ),
					array( 'key' => Membership::META_STATUS, 'compare' => 'NOT EXISTS' ),
				),
			)
		);
		echo '<div class="wrap"><h1>Pending approvals</h1>';
		if ( isset( $_GET['b151_msg'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			echo '<div class="notice notice-info"><p>' . esc_html( sanitize_text_field( wp_unslash( $_GET['b151_msg'] ) ) ) . '</p></div>'; // phpcs:ignore
		}
		if ( ! $ids ) {
			echo '<p>No accounts are waiting for approval.</p></div>';
			return;
		}
		echo '<table class="widefat striped"><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Classification</th><th></th></tr></thead><tbody>';
		foreach ( $ids as $id ) {
			$u = get_userdata( (int) $id );
			echo '<tr><td>' . esc_html( $u->display_name ) . '</td><td>' . esc_html( $u->user_email ) . '</td><td>' . esc_html( $u->user_registered ) . '</td><td>';
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:flex;gap:8px">';
			echo '<input type="hidden" name="action" value="b151_approve"><input type="hidden" name="user_id" value="' . (int) $id . '">';
			wp_nonce_field( 'b151_approve_' . (int) $id );
			echo '<select name="classification">';
			foreach ( Membership::CLASSIFICATIONS as $c ) {
				echo '<option value="' . esc_attr( $c ) . '">' . esc_html( ucwords( str_replace( '_', ' ', $c ) ) ) . '</option>';
			}
			echo '</select></td><td><button class="button button-primary">Approve</button> <a class="button" href="' . esc_url( get_edit_user_link( (int) $id ) ) . '">Open</a></form></td></tr>';
		}
		echo '</tbody></table></div>';
	}

	public static function handle_approve(): void {
		$uid = isset( $_POST['user_id'] ) ? (int) $_POST['user_id'] : 0; // phpcs:ignore WordPress.Security.NonceVerification
		check_admin_referer( 'b151_approve_' . $uid );
		self::deny_unless( Roles::APPROVE_MEMBERS );
		$class  = isset( $_POST['classification'] ) ? sanitize_key( wp_unslash( $_POST['classification'] ) ) : 'member';
		$target = get_userdata( $uid );
		$msg    = 'Approved.';
		if ( ! $target || user_can( $target, Roles::BACKEND_ACCESS ) || get_current_user_id() === $uid ) {
			$msg = 'That account cannot be approved here.';
		} else {
			$r = Membership::approve( $uid, $class );
			if ( is_wp_error( $r ) ) {
				$msg = $r->get_error_message();
			} else {
				$msg = 'Approved ' . $target->display_name . ' (' . Membership::get_number( $uid ) . ').';
			}
		}
		wp_safe_redirect( add_query_arg( 'b151_msg', rawurlencode( $msg ), admin_url( 'admin.php?page=' . self::MENU_SLUG ) ) );
		exit;
	}

	/* ---------------- roster export ---------------- */

	public static function roster_page(): void {
		self::deny_unless( Roles::EXPORT_ROSTER );
		echo '<div class="wrap"><h1>Roster export</h1><p>Downloads a spreadsheet (CSV) with contact details. Every export is recorded in the audit log. Store the file securely and delete it when you are done.</p>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="b151_export_roster">';
		wp_nonce_field( 'b151_export_roster' );
		echo '<select name="status"><option value="">Everyone</option>';
		foreach ( Membership::STATUSES as $s ) {
			echo '<option value="' . esc_attr( $s ) . '">' . esc_html( ucfirst( $s ) ) . ' only</option>';
		}
		echo '</select> ';
		submit_button( 'Download CSV', 'primary', 'submit', false );
		echo '</form></div>';
	}

	public static function export_roster(): void {
		check_admin_referer( 'b151_export_roster' );
		self::deny_unless( Roles::EXPORT_ROSTER );
		$status = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : '';
		$rows   = Roster::rows( $status );
		Audit_Log::record( 'roster_exported', 'roster', 0, array( 'status' => $status ?: 'all', 'rows' => count( $rows ) ) );
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="151-roster-' . gmdate( 'Y-m-d' ) . '.csv"' );
		header( 'X-Content-Type-Options: nosniff' );
		echo Roster::csv( $rows ); // phpcs:ignore WordPress.Security.EscapeOutput
		exit;
	}

	/* ---------------- audit log ---------------- */

	public static function audit_page(): void {
		self::deny_unless( Roles::VIEW_AUDIT_LOG );
		$action = isset( $_GET['log_action'] ) ? sanitize_key( wp_unslash( $_GET['log_action'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$rows   = Audit_Log::recent( 200, array( 'action' => $action ) );
		echo '<div class="wrap"><h1>Audit log</h1><form method="get"><input type="hidden" name="page" value="b151-audit">';
		echo '<input type="search" name="log_action" placeholder="Filter by action, e.g. login_failed" value="' . esc_attr( $action ) . '"> <button class="button">Filter</button></form>';
		echo '<table class="widefat striped" style="margin-top:12px"><thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$actor = $r->actor_user_id ? get_userdata( (int) $r->actor_user_id ) : null;
			$tuser = 'user' === $r->target_type && $r->target_id ? get_userdata( (int) $r->target_id ) : null;
			echo '<tr><td>' . esc_html( $r->occurred_at ) . '</td><td>' . esc_html( $actor ? $actor->display_name : '—' ) . '</td><td><code>' . esc_html( $r->action ) . '</code></td><td>'
				. esc_html( $tuser ? $tuser->display_name : ( $r->target_type . ( $r->target_id ? ' #' . $r->target_id : '' ) ) ) . '</td><td><code style="white-space:pre-wrap">' . esc_html( (string) $r->details ) . '</code></td></tr>';
		}
		echo '</tbody></table></div>';
	}

	/* ---------------- content meta boxes ---------------- */

	public static function form_enctype( $post ): void {
		if ( $post instanceof \WP_Post && Content_Types::RESOURCE === $post->post_type ) {
			echo ' enctype="multipart/form-data"';
		}
	}

	public static function meta_boxes(): void {
		foreach ( array_keys( Content_Types::MANAGE_CAP ) as $type ) {
			add_meta_box( 'b151_details', 'Details', array( self::class, 'details_box' ), $type, 'normal', 'high' );
		}
	}

	public static function details_box( \WP_Post $post ): void {
		$m        = static fn( string $k ) => (string) get_post_meta( $post->ID, $k, true );
		$chapters = get_posts( array( 'post_type' => Chapters::POST_TYPE, 'numberposts' => 200, 'post_status' => 'publish', 'orderby' => 'title', 'order' => 'ASC' ) );
		$dt       = static fn( string $v ) => $v ? str_replace( ' ', 'T', $v ) : '';
		wp_nonce_field( 'b151_details_' . $post->ID, 'b151_details_nonce' );
		echo '<table class="form-table" role="presentation">';
		echo '<tr><th>Who can see it</th><td><select name="b151[audience]"><option value="all">All members</option><option value="chapter" ' . selected( $m( Content_Types::META_AUDIENCE ), 'chapter', false ) . '>One chapter only</option></select> ';
		echo '<select name="b151[chapter_id]"><option value="0">— chapter —</option>';
		foreach ( $chapters as $ch ) {
			echo '<option value="' . (int) $ch->ID . '" ' . selected( (int) $m( Content_Types::META_CHAPTER ), $ch->ID, false ) . '>' . esc_html( $ch->post_title ) . '</option>';
		}
		echo '</select></td></tr>';

		if ( Content_Types::EVENT === $post->post_type ) {
			echo '<tr><th>Starts</th><td><input type="datetime-local" name="b151[starts_at]" value="' . esc_attr( $dt( $m( Content_Types::META_STARTS ) ) ) . '" required></td></tr>';
			echo '<tr><th>Ends</th><td><input type="datetime-local" name="b151[ends_at]" value="' . esc_attr( $dt( $m( Content_Types::META_ENDS ) ) ) . '"></td></tr>';
			echo '<tr><th>Location</th><td><input class="regular-text" name="b151[location]" value="' . esc_attr( $m( Content_Types::META_LOCATION ) ) . '"></td></tr>';
			echo '<tr><th>Zoom / meeting link</th><td><input class="regular-text" type="url" name="b151[virtual_url]" placeholder="https://" value="' . esc_attr( $m( Content_Types::META_VURL ) ) . '"><p class="description">Shown only to members who can see this event.</p></td></tr>';
			echo '<tr><th>Meeting ID</th><td><input name="b151[virtual_meeting_id]" value="' . esc_attr( $m( Content_Types::META_VMEETING ) ) . '"></td></tr>';
			echo '<tr><th>Passcode</th><td><input name="b151[virtual_passcode]" value="' . esc_attr( $m( Content_Types::META_VPASSCODE ) ) . '"></td></tr>';
		} elseif ( Content_Types::ANNOUNCEMENT === $post->post_type ) {
			echo '<tr><th>Hide after</th><td><input type="date" name="b151[expires_on]" value="' . esc_attr( $m( Content_Types::META_EXPIRES ) ) . '"> <span class="description">Leave empty to keep it up.</span></td></tr>';
			echo '<tr><th>Pin to top</th><td><label><input type="checkbox" name="b151[pinned]" value="1" ' . checked( (bool) $m( Content_Types::META_PINNED ), true, false ) . '> Pinned</label></td></tr>';
		} else {
			$file    = get_post_meta( $post->ID, Content_Types::META_FILE, true );
			$storage = Private_Storage::dir();
			echo '<tr><th>Category</th><td><input class="regular-text" name="b151[category]" value="' . esc_attr( $m( Content_Types::META_CATEGORY ) ) . '" placeholder="e.g. Bylaws, Minutes, Audio"></td></tr>';
			echo '<tr><th>File</th><td>';
			if ( is_array( $file ) && ! empty( $file['name'] ) ) {
				echo '<p>Current: <strong>' . esc_html( $file['name'] ) . '</strong> (' . esc_html( size_format( (int) $file['size'] ) ) . ')</p>';
			}
			if ( is_wp_error( $storage ) ) {
				echo '<p class="notice notice-error inline" style="padding:8px">' . esc_html( $storage->get_error_message() ) . ' Files cannot be uploaded until this is fixed.</p>';
			} else {
				echo '<input type="file" name="b151_file" accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.mp3,.m4a,.mp4"><p class="description">Up to ' . (int) Settings::get( 'max_upload_mb' ) . ' MB. Stored privately; members download it only after signing in.</p>';
			}
			echo '</td></tr>';
		}
		echo '</table>';
	}

	public static function save_post( int $post_id, \WP_Post $post ): void {
		if ( ! isset( Content_Types::MANAGE_CAP[ $post->post_type ] ) || wp_is_post_revision( $post_id ) || ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ) {
			return;
		}
		if ( ! isset( $_POST['b151_details_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['b151_details_nonce'] ) ), 'b151_details_' . $post_id ) ) {
			return;
		}
		if ( ! current_user_can( Content_Types::MANAGE_CAP[ $post->post_type ] ) ) {
			return;
		}
		$in = isset( $_POST['b151'] ) && is_array( $_POST['b151'] ) ? wp_unslash( $_POST['b151'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized per field in save_meta
		Content_Types::save_meta( $post_id, (array) $in );

		if ( Content_Types::RESOURCE === $post->post_type && ! empty( $_FILES['b151_file']['tmp_name'] ) ) {
			$f      = $_FILES['b151_file']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			$stored = Private_Storage::store( (string) $f['tmp_name'], (string) $f['name'] );
			if ( is_wp_error( $stored ) ) {
				set_transient( 'b151_upload_error_' . get_current_user_id(), $stored->get_error_message(), 60 );
				add_filter( 'redirect_post_location', static fn( $loc ) => add_query_arg( 'b151_upload_error', 1, $loc ) );
			} else {
				Private_Storage::attach( $post_id, $stored );
			}
		}
		Audit_Log::record( 'member_content_saved', 'post', $post_id, array( 'type' => $post->post_type ) );
	}

	/* ---------------- users list + profile ---------------- */

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
		if ( ! Access::current_can( Roles::MANAGE_MEMBERS ) ) {
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
		if ( Access::current_can( Roles::CHANGE_MEMBER_STATUS ) && get_current_user_id() !== $user_id && isset( $_POST['b151_status'] ) ) {
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

	/* ---------------- settings ---------------- */

	public static function settings_page(): void {
		self::deny_unless( Roles::MANAGE_SETTINGS );
		$numeric = array(
			'idle_minutes_member'  => 'Member idle sign-out (minutes)',
			'idle_minutes_backend' => 'Admin idle sign-out (minutes)',
			'session_max_hours'    => 'Maximum session length (hours)',
			'login_max_failures'   => 'Failed sign-ins before a pause',
			'login_lock_minutes'   => 'Pause length (minutes)',
			'password_min_length'  => 'Minimum password length',
			'max_upload_mb'        => 'Largest resource file (MB)',
		);
		if ( isset( $_POST['b151_settings_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['b151_settings_nonce'] ) ), 'b151_settings' ) ) {
			$values = array();
			foreach ( array_keys( $numeric ) as $k ) {
				if ( isset( $_POST[ $k ] ) ) {
					$values[ $k ] = max( 1, (int) $_POST[ $k ] );
				}
			}
			$values['require_two_factor_backend'] = ! empty( $_POST['require_two_factor_backend'] );
			$values['notify_members']             = ! empty( $_POST['notify_members'] );
			Settings::update( $values );
			Audit_Log::record( 'settings_updated', 'settings', 0, array( 'keys' => array_keys( $values ) ) );
			echo '<div class="notice notice-success"><p>Saved.</p></div>';
		}
		$s       = Settings::all();
		$storage = Private_Storage::dir();
		?>
		<div class="wrap"><h1>Members Portal settings</h1>
		<form method="post"><?php wp_nonce_field( 'b151_settings', 'b151_settings_nonce' ); ?>
		<table class="form-table" role="presentation">
			<?php foreach ( $numeric as $k => $label ) : ?>
				<tr><th><label for="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $label ); ?></label></th>
				<td><input type="number" min="1" id="<?php echo esc_attr( $k ); ?>" name="<?php echo esc_attr( $k ); ?>" value="<?php echo (int) $s[ $k ]; ?>" /></td></tr>
			<?php endforeach; ?>
			<tr><th>Two-step sign-in</th><td><label><input type="checkbox" name="require_two_factor_backend" value="1" <?php checked( $s['require_two_factor_backend'] ); ?> /> Required for every admin account</label></td></tr>
			<tr><th>Member emails</th><td><label><input type="checkbox" name="notify_members" value="1" <?php checked( $s['notify_members'] ); ?> /> Email members when they are approved, paused or restored</label></td></tr>
			<tr><th>Private file folder</th><td><?php echo is_wp_error( $storage ) ? '<span style="color:#b32d2e">' . esc_html( $storage->get_error_message() ) . '</span>' : '<code>' . esc_html( $storage ) . '</code> ✓'; ?></td></tr>
		</table>
		<?php submit_button(); ?>
		</form></div>
		<?php
	}
}
