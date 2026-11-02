<?php
namespace B151\Members;

/**
 * Private member content (ARCHITECTURE.md §6–7): member events, announcements and resources.
 * Not public, not in the public REST API or the public GraphQL schema, no front-end URLs. Members read them only
 * through the plugin's own GraphQL fields, which apply status, capability and chapter checks (Member_Content).
 * Content admins edit them in wp-admin (1-5-1 Members menu).
 */
final class Content_Types {

	public const EVENT        = 'b151_member_event';
	public const ANNOUNCEMENT = 'b151_announcement';
	public const RESOURCE     = 'b151_resource';

	/** Post type => capability that manages it. */
	public const MANAGE_CAP = array(
		self::EVENT        => Roles::MANAGE_MEMBER_EVENTS,
		self::ANNOUNCEMENT => Roles::MANAGE_ANNOUNCEMENTS,
		self::RESOURCE     => Roles::MANAGE_RESOURCES,
	);

	public static function register(): void {
		add_action( 'init', array( self::class, 'register_post_types' ) );
	}

	public static function register_post_types(): void {
		$defs = array(
			self::EVENT        => array( 'Member Events', 'Member Event', array( 'title', 'editor', 'thumbnail' ) ),
			self::ANNOUNCEMENT => array( 'Announcements', 'Announcement', array( 'title', 'editor' ) ),
			self::RESOURCE     => array( 'Resources', 'Resource', array( 'title', 'editor' ) ),
		);
		foreach ( $defs as $type => list( $plural, $singular, $supports ) ) {
			$cap = self::MANAGE_CAP[ $type ];
			register_post_type(
				$type,
				array(
					'labels'              => array(
						'name'          => $plural,
						'singular_name' => $singular,
						'add_new_item'  => 'Add ' . $singular,
						'edit_item'     => 'Edit ' . $singular,
						'all_items'     => $plural,
					),
					'public'              => false,
					'publicly_queryable'  => false,
					'exclude_from_search' => true,
					'show_ui'             => true,
					'show_in_menu'        => Admin::MENU_SLUG,
					'show_in_nav_menus'   => false,
					'show_in_admin_bar'   => false,
					'show_in_rest'        => false, // classic editor; keeps the content out of /wp-json/wp/v2
					'show_in_graphql'     => false, // members read it through the plugin's checked fields only
					'has_archive'         => false,
					'rewrite'             => false,
					'query_var'           => false,
					'supports'            => $supports,
					'capability_type'     => array( $type, $type . 's' ),
					'map_meta_cap'        => true,
					'capabilities'        => array(
						'edit_posts'             => $cap,
						'edit_others_posts'      => $cap,
						'edit_published_posts'   => $cap,
						'edit_private_posts'     => $cap,
						'publish_posts'          => $cap,
						'read_private_posts'     => $cap,
						'delete_posts'           => $cap,
						'delete_others_posts'    => $cap,
						'delete_published_posts' => $cap,
						'delete_private_posts'   => $cap,
						'create_posts'           => $cap,
					),
				)
			);
		}
	}

	/* ---------- meta (one place, sanitized) ---------- */

	public const META_AUDIENCE   = 'b151_audience';   // all | chapter
	public const META_CHAPTER    = 'b151_chapter_id';
	public const META_STARTS     = 'b151_starts_at';  // Y-m-d H:i (site time)
	public const META_ENDS       = 'b151_ends_at';
	public const META_LOCATION   = 'b151_location';
	public const META_VURL       = 'b151_virtual_url';
	public const META_VMEETING   = 'b151_virtual_meeting_id';
	public const META_VPASSCODE  = 'b151_virtual_passcode';
	public const META_EXPIRES    = 'b151_expires_on'; // Y-m-d
	public const META_PINNED     = 'b151_pinned';
	public const META_CATEGORY   = 'b151_resource_category';
	public const META_FILE       = 'b151_file';

	/** Normalise "2026-11-21 18:00", "2026-11-21T18:00" or "2026-11-21" to "Y-m-d H:i"; '' if invalid. */
	public static function clean_datetime( $value ): string {
		$value = trim( (string) $value );
		if ( preg_match( '/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/', $value, $m ) ) {
			list( $y, $mo, $d ) = array_map( 'intval', explode( '-', $m[1] ) );
			if ( checkdate( $mo, $d, $y ) ) {
				return $m[1] . ' ' . ( $m[2] ?? '00:00' );
			}
		}
		return '';
	}

	public static function clean_date( $value ): string {
		$dt = self::clean_datetime( $value );
		return $dt ? substr( $dt, 0, 10 ) : '';
	}

	/**
	 * Save the scoped/meta fields for a post from an array (wp-admin form or tests). Unknown keys are ignored.
	 *
	 * @param array<string,mixed> $in
	 */
	public static function save_meta( int $post_id, array $in ): void {
		$type = get_post_type( $post_id );
		if ( ! isset( self::MANAGE_CAP[ $type ] ) ) {
			return;
		}
		$audience = ( isset( $in['audience'] ) && 'chapter' === $in['audience'] ) ? 'chapter' : 'all';
		$chapter  = isset( $in['chapter_id'] ) ? (int) $in['chapter_id'] : 0;
		if ( 'chapter' === $audience && ! Chapters::exists( $chapter ) ) {
			$audience = 'all';
			$chapter  = 0;
		}
		update_post_meta( $post_id, self::META_AUDIENCE, $audience );
		update_post_meta( $post_id, self::META_CHAPTER, 'chapter' === $audience ? $chapter : 0 );

		if ( self::EVENT === $type ) {
			update_post_meta( $post_id, self::META_STARTS, self::clean_datetime( $in['starts_at'] ?? '' ) );
			update_post_meta( $post_id, self::META_ENDS, self::clean_datetime( $in['ends_at'] ?? '' ) );
			update_post_meta( $post_id, self::META_LOCATION, sanitize_text_field( (string) ( $in['location'] ?? '' ) ) );
			$url = esc_url_raw( trim( (string) ( $in['virtual_url'] ?? '' ) ), array( 'https' ) );
			update_post_meta( $post_id, self::META_VURL, $url );
			update_post_meta( $post_id, self::META_VMEETING, sanitize_text_field( (string) ( $in['virtual_meeting_id'] ?? '' ) ) );
			update_post_meta( $post_id, self::META_VPASSCODE, sanitize_text_field( (string) ( $in['virtual_passcode'] ?? '' ) ) );
		} elseif ( self::ANNOUNCEMENT === $type ) {
			update_post_meta( $post_id, self::META_EXPIRES, self::clean_date( $in['expires_on'] ?? '' ) );
			update_post_meta( $post_id, self::META_PINNED, ! empty( $in['pinned'] ) ? 1 : 0 );
		} elseif ( self::RESOURCE === $type ) {
			update_post_meta( $post_id, self::META_CATEGORY, sanitize_text_field( (string) ( $in['category'] ?? '' ) ) );
		}
	}
}
