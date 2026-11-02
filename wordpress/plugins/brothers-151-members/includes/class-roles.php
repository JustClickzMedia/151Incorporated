<?php
namespace B151\Members;

/**
 * Roles are bundles of capabilities. Every check in the plugin uses capabilities, never role names.
 * See ARCHITECTURE.md §5.
 */
final class Roles {

	// Member-area capabilities.
	public const VIEW_MEMBER_CONTENT = 'b151_view_member_content';
	public const VIEW_DIRECTORY      = 'b151_view_directory';
	public const EDIT_OWN_PROFILE    = 'b151_edit_own_profile';

	// Backend / administrative capabilities.
	public const BACKEND_ACCESS        = 'b151_backend_access';
	public const MANAGE_MEMBERS        = 'b151_manage_members';
	public const APPROVE_MEMBERS       = 'b151_approve_members';
	public const CHANGE_MEMBER_STATUS  = 'b151_change_member_status';
	public const EXPORT_ROSTER         = 'b151_export_roster';
	public const VERIFY_MEMBERS        = 'b151_verify_members';
	public const MANAGE_MEMBER_EVENTS  = 'b151_manage_member_events';
	public const MANAGE_ANNOUNCEMENTS  = 'b151_manage_announcements';
	public const MANAGE_RESOURCES      = 'b151_manage_resources';
	public const VIEW_AUDIT_LOG        = 'b151_view_audit_log';
	public const ASSIGN_BACKEND_ROLES  = 'b151_assign_backend_roles';
	public const MANAGE_SETTINGS       = 'b151_manage_settings';

	public const ROLE_MEMBER            = 'b151_member';
	public const ROLE_MEMBERSHIP_ADMIN  = 'b151_membership_admin';
	public const ROLE_CONTENT_ADMIN     = 'b151_content_admin';
	public const ROLE_PORTAL_ADMIN      = 'b151_portal_admin';

	/** @return array<string, array{label:string, caps:array<string,bool>}> */
	public static function definitions(): array {
		$member = array(
			'read'                    => true,
			self::VIEW_MEMBER_CONTENT => true,
			self::VIEW_DIRECTORY      => true,
			self::EDIT_OWN_PROFILE    => true,
		);

		$membership_admin = $member + array(
			self::BACKEND_ACCESS       => true,
			self::MANAGE_MEMBERS       => true,
			self::APPROVE_MEMBERS      => true,
			self::CHANGE_MEMBER_STATUS => true,
			self::EXPORT_ROSTER        => true,
			self::VERIFY_MEMBERS       => true,
			self::VIEW_AUDIT_LOG       => true,
			'list_users'               => true,
		);

		$content_admin = $member + array(
			self::BACKEND_ACCESS       => true,
			self::VERIFY_MEMBERS       => true,
			self::MANAGE_MEMBER_EVENTS => true,
			self::MANAGE_ANNOUNCEMENTS => true,
			self::MANAGE_RESOURCES     => true,
			// Site content editing (Editor-level, no settings/plugins/users).
			'edit_posts'               => true,
			'edit_others_posts'        => true,
			'edit_published_posts'     => true,
			'publish_posts'            => true,
			'delete_posts'             => true,
			'edit_pages'               => true,
			'edit_others_pages'        => true,
			'edit_published_pages'     => true,
			'publish_pages'            => true,
			'upload_files'             => true,
		);

		return array(
			self::ROLE_MEMBER           => array(
				'label' => 'Member (1-5-1)',
				'caps'  => $member,
			),
			self::ROLE_MEMBERSHIP_ADMIN => array(
				'label' => 'Membership Admin (1-5-1)',
				'caps'  => $membership_admin,
			),
			self::ROLE_CONTENT_ADMIN    => array(
				'label' => 'Content Admin (1-5-1)',
				'caps'  => $content_admin,
			),
			self::ROLE_PORTAL_ADMIN     => array(
				'label' => 'Portal Admin (1-5-1)',
				'caps'  => $membership_admin + $content_admin,
			),
		);
	}

	/** Every capability the plugin defines (administrators receive all of them). */
	public static function all_plugin_caps(): array {
		return array(
			self::VIEW_MEMBER_CONTENT, self::VIEW_DIRECTORY, self::EDIT_OWN_PROFILE, self::BACKEND_ACCESS,
			self::MANAGE_MEMBERS, self::APPROVE_MEMBERS, self::CHANGE_MEMBER_STATUS, self::EXPORT_ROSTER,
			self::VERIFY_MEMBERS, self::MANAGE_MEMBER_EVENTS, self::MANAGE_ANNOUNCEMENTS, self::MANAGE_RESOURCES,
			self::VIEW_AUDIT_LOG, self::ASSIGN_BACKEND_ROLES, self::MANAGE_SETTINGS,
		);
	}

	/** Create/refresh roles and give administrators every plugin capability. Safe to run repeatedly. */
	public static function sync(): void {
		foreach ( self::definitions() as $role => $def ) {
			remove_role( $role );
			add_role( $role, $def['label'], $def['caps'] );
		}
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( self::all_plugin_caps() as $cap ) {
				$admin->add_cap( $cap );
			}
		}
	}

	/** Roles that carry backend access (granting them is restricted to administrators). */
	public static function backend_roles(): array {
		$roles = array();
		foreach ( self::definitions() as $role => $def ) {
			if ( ! empty( $def['caps'][ self::BACKEND_ACCESS ] ) ) {
				$roles[] = $role;
			}
		}
		$roles[] = 'administrator';
		return $roles;
	}

	public static function remove(): void {
		foreach ( array_keys( self::definitions() ) as $role ) {
			remove_role( $role );
		}
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( self::all_plugin_caps() as $cap ) {
				$admin->remove_cap( $cap );
			}
		}
	}
}
