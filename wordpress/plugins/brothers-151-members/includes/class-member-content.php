<?php
namespace B151\Members;

use WP_Post;
use WP_Query;

/**
 * Who may see which member event / announcement / resource, and the listing queries.
 * Rule: published, viewer has member access (active, or a backend account), and the item is for everyone or for
 * the viewer's chapter. Admins who manage that content type (with an elevated session) see every item.
 */
final class Member_Content {

	public static function can_manage( string $type ): bool {
		return isset( Content_Types::MANAGE_CAP[ $type ] ) && Access::current_can( Content_Types::MANAGE_CAP[ $type ] );
	}

	public static function can_view( $post, int $user_id = 0 ): bool {
		$post    = get_post( $post );
		$user_id = $user_id ?: get_current_user_id();
		if ( ! $post instanceof WP_Post || ! isset( Content_Types::MANAGE_CAP[ $post->post_type ] ) || 'publish' !== $post->post_status ) {
			return false;
		}
		if ( ! $user_id || ! Access::standing( $user_id )['has_member_access'] || ! user_can( $user_id, Roles::VIEW_MEMBER_CONTENT ) ) {
			return false;
		}
		if ( $user_id === get_current_user_id() && self::can_manage( $post->post_type ) ) {
			return true;
		}
		if ( Content_Types::ANNOUNCEMENT === $post->post_type && self::is_expired( $post->ID ) ) {
			return false;
		}
		if ( 'chapter' === get_post_meta( $post->ID, Content_Types::META_AUDIENCE, true ) ) {
			$chapter = (int) get_post_meta( $post->ID, Content_Types::META_CHAPTER, true );
			return $chapter > 0 && Membership::get_chapter_id( $user_id ) === $chapter;
		}
		return true;
	}

	public static function is_expired( int $post_id ): bool {
		$exp = (string) get_post_meta( $post_id, Content_Types::META_EXPIRES, true );
		return '' !== $exp && $exp < current_time( 'Y-m-d' );
	}

	/** Meta query limiting to "everyone" + the viewer's chapter (skipped for managers). */
	private static function scope_query( string $type ): array {
		if ( self::can_manage( $type ) ) {
			return array();
		}
		$chapter = Membership::get_chapter_id( get_current_user_id() );
		$any     = array(
			'relation' => 'OR',
			array( 'key' => Content_Types::META_AUDIENCE, 'value' => 'all' ),
			array( 'key' => Content_Types::META_AUDIENCE, 'compare' => 'NOT EXISTS' ),
		);
		if ( $chapter ) {
			$any[] = array(
				'relation' => 'AND',
				array( 'key' => Content_Types::META_AUDIENCE, 'value' => 'chapter' ),
				array( 'key' => Content_Types::META_CHAPTER, 'value' => $chapter, 'type' => 'NUMERIC' ),
			);
		}
		return $any;
	}

	private static function page( array $args ): array {
		return array(
			'posts_per_page'      => max( 1, min( 50, (int) ( $args['first'] ?? 20 ) ) ),
			'offset'              => max( 0, (int) ( $args['offset'] ?? 0 ) ),
			'post_status'         => 'publish',
			'ignore_sticky_posts' => true,
			'no_found_rows'       => false,
			'suppress_filters'    => true,
		);
	}

	/**
	 * Events, soonest first. By default only events that haven't finished (from = today).
	 *
	 * @return array{posts:WP_Post[], total:int}
	 */
	public static function events( array $args = array() ): array {
		if ( ! Access::current_has_member_access() ) {
			return array( 'posts' => array(), 'total' => 0 );
		}
		$meta = array( 'relation' => 'AND' );
		$from = Content_Types::clean_date( $args['from'] ?? '' );
		if ( '' === $from && empty( $args['includePast'] ) ) {
			$from = current_time( 'Y-m-d' );
		}
		if ( '' !== $from ) {
			$meta[] = array(
				'relation' => 'OR',
				array( 'key' => Content_Types::META_ENDS, 'value' => $from . ' 00:00', 'compare' => '>=', 'type' => 'CHAR' ),
				array(
					'relation' => 'AND',
					array( 'key' => Content_Types::META_ENDS, 'value' => '', 'compare' => '=' ),
					array( 'key' => Content_Types::META_STARTS, 'value' => $from . ' 00:00', 'compare' => '>=', 'type' => 'CHAR' ),
				),
			);
		}
		$to = Content_Types::clean_date( $args['to'] ?? '' );
		if ( '' !== $to ) {
			$meta[] = array( 'key' => Content_Types::META_STARTS, 'value' => $to . ' 23:59', 'compare' => '<=', 'type' => 'CHAR' );
		}
		$scope = self::scope_query( Content_Types::EVENT );
		if ( $scope ) {
			$meta[] = $scope;
		}
		$q = new WP_Query(
			self::page( $args ) + array(
				'post_type'  => Content_Types::EVENT,
				'meta_query' => $meta, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_key'   => Content_Types::META_STARTS, // phpcs:ignore WordPress.DB.SlowDBQuery
				'orderby'    => array( 'meta_value' => 'ASC', 'ID' => 'ASC' ),
			)
		);
		return array( 'posts' => $q->posts, 'total' => (int) $q->found_posts );
	}

	/** Announcements: pinned first, then newest; expired ones hidden. */
	public static function announcements( array $args = array() ): array {
		if ( ! Access::current_has_member_access() ) {
			return array( 'posts' => array(), 'total' => 0 );
		}
		$today = current_time( 'Y-m-d' );
		$meta  = array(
			'relation' => 'AND',
			'pinned'   => array(
				'relation' => 'OR',
				'pin_set'  => array( 'key' => Content_Types::META_PINNED, 'type' => 'NUMERIC' ),
				array( 'key' => Content_Types::META_PINNED, 'compare' => 'NOT EXISTS' ),
			),
			array(
				'relation' => 'OR',
				array( 'key' => Content_Types::META_EXPIRES, 'compare' => 'NOT EXISTS' ),
				array( 'key' => Content_Types::META_EXPIRES, 'value' => '' ),
				array( 'key' => Content_Types::META_EXPIRES, 'value' => $today, 'compare' => '>=', 'type' => 'CHAR' ),
			),
		);
		$scope = self::scope_query( Content_Types::ANNOUNCEMENT );
		if ( $scope ) {
			$meta[] = $scope;
		}
		$q = new WP_Query(
			self::page( $args ) + array(
				'post_type'  => Content_Types::ANNOUNCEMENT,
				'meta_query' => $meta, // phpcs:ignore WordPress.DB.SlowDBQuery
				'orderby'    => array( 'pin_set' => 'DESC', 'date' => 'DESC', 'ID' => 'DESC' ),
			)
		);
		return array( 'posts' => $q->posts, 'total' => (int) $q->found_posts );
	}

	/** Resources, A–Z, optional category. */
	public static function resources( array $args = array() ): array {
		if ( ! Access::current_has_member_access() ) {
			return array( 'posts' => array(), 'total' => 0 );
		}
		$meta = array( 'relation' => 'AND' );
		if ( ! empty( $args['category'] ) ) {
			$meta[] = array( 'key' => Content_Types::META_CATEGORY, 'value' => sanitize_text_field( (string) $args['category'] ) );
		}
		$scope = self::scope_query( Content_Types::RESOURCE );
		if ( $scope ) {
			$meta[] = $scope;
		}
		$q = new WP_Query(
			self::page( $args ) + array(
				'post_type'  => Content_Types::RESOURCE,
				'meta_query' => $meta, // phpcs:ignore WordPress.DB.SlowDBQuery
				'orderby'    => array( 'title' => 'ASC', 'ID' => 'ASC' ),
			)
		);
		return array( 'posts' => $q->posts, 'total' => (int) $q->found_posts );
	}

	/** One item of a given type, or null when it doesn't exist or the viewer may not see it (no difference shown). */
	public static function get( int $id, string $type ): ?WP_Post {
		$post = get_post( $id );
		return ( $post && $type === $post->post_type && self::can_view( $post ) ) ? $post : null;
	}

	/** Safe HTML for content (shortcodes and scripts removed). */
	public static function html( WP_Post $post ): string {
		return wp_kses_post( wpautop( strip_shortcodes( $post->post_content ) ) );
	}
}
