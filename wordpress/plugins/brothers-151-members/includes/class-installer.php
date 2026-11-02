<?php
namespace B151\Members;

/**
 * Activation, database tables and upgrades.
 */
final class Installer {

	public const DB_VERSION        = '1';
	public const DB_VERSION_OPTION = 'b151_members_db_version';

	public static function activate(): void {
		self::install();
		flush_rewrite_rules( false );
	}

	public static function deactivate(): void {
		// Keep roles, data and settings: deactivating is the rollback path and must not lose member records.
		flush_rewrite_rules( false );
	}

	public static function maybe_upgrade(): void {
		if ( get_option( self::DB_VERSION_OPTION ) !== self::DB_VERSION ) {
			self::install();
		}
	}

	public static function install(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$audit   = Audit_Log::table();
		$numbers = Membership::numbers_table();

		dbDelta(
			"CREATE TABLE {$audit} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				occurred_at datetime NOT NULL,
				actor_user_id bigint(20) unsigned NOT NULL DEFAULT 0,
				action varchar(64) NOT NULL,
				target_type varchar(32) NOT NULL DEFAULT '',
				target_id bigint(20) unsigned NOT NULL DEFAULT 0,
				ip_hash char(64) NOT NULL DEFAULT '',
				details longtext NULL,
				PRIMARY KEY  (id),
				KEY occurred_at (occurred_at),
				KEY action (action),
				KEY target (target_type, target_id)
			) {$charset};"
		);

		dbDelta(
			"CREATE TABLE {$numbers} (
				membership_number varchar(20) NOT NULL,
				sequence int(10) unsigned NOT NULL,
				user_id bigint(20) unsigned NOT NULL,
				assigned_at datetime NOT NULL,
				PRIMARY KEY  (membership_number),
				UNIQUE KEY sequence (sequence),
				KEY user_id (user_id)
			) {$charset};"
		);

		Roles::sync();
		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}
}
