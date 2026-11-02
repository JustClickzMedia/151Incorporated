<?php
namespace B151\Members;

use GraphQL\Error\UserError;
use WP_Post;

/**
 * Checkpoint 3 GraphQL: directory, verifyMember (Zoom check-in), member events, announcements and resources.
 * Reads that aren't allowed return null / empty lists (no hint that something exists); see ARCHITECTURE.md §6.
 */
final class Graphql_Member {

	public static function register(): void {
		add_action( 'graphql_register_types', array( self::class, 'register_types' ), 20 );
	}

	private static function node( int $uid ): array {
		return array( '__b151_uid' => $uid );
	}

	/** Member-area reads: signed in, eligible, capability, per-member rate limit. */
	private static function member_read_allowed( string $cap, string $bucket = '' ): bool {
		$uid = get_current_user_id();
		if ( ! $uid || ! Access::current_has_member_access() || ! current_user_can( $cap ) ) {
			return false;
		}
		if ( $bucket ) {
			$max = (int) Settings::get( 'directory_per_minute' );
			if ( Rate_Limiter::exceeded( $bucket, (string) $uid, $max ) ) {
				throw new UserError( 'Too many requests. Please wait a minute and try again.' );
			}
			Rate_Limiter::hit( $bucket, (string) $uid, MINUTE_IN_SECONDS );
		}
		return true;
	}

	/* ---------------- directory ---------------- */

	/** @return array{total:int, nodes:array} */
	public static function directory( array $args ): array {
		if ( ! self::member_read_allowed( Roles::VIEW_DIRECTORY, 'directory' ) ) {
			return array( 'total' => 0, 'nodes' => array() );
		}
		$search = trim( (string) ( $args['search'] ?? '' ) );
		if ( '' !== $search && mb_strlen( $search ) < 2 ) {
			throw new UserError( 'Type at least 2 letters to search.' );
		}
		$query = array(
			'fields'      => 'ID',
			'number'      => max( 1, min( 25, (int) ( $args['first'] ?? 25 ) ) ),
			'offset'      => max( 0, (int) ( $args['offset'] ?? 0 ) ),
			'orderby'     => 'display_name',
			'order'       => 'ASC',
			'count_total' => true,
			'meta_query'  => array( // phpcs:ignore WordPress.DB.SlowDBQuery
				'relation' => 'AND',
				array( 'key' => Membership::META_STATUS, 'value' => Membership::STATUS_ACTIVE ),
			),
		);
		if ( '' !== $search ) {
			$query['search']         = '*' . $search . '*';
			$query['search_columns'] = array( 'display_name' );
		}
		if ( ! empty( $args['chapterId'] ) ) {
			$query['meta_query'][] = array( 'key' => Membership::META_CHAPTER, 'value' => (int) $args['chapterId'], 'type' => 'NUMERIC' );
		}
		$q = new \WP_User_Query( $query );
		return array(
			'total' => (int) $q->get_total(),
			'nodes' => array_map( static fn( $id ) => self::node( (int) $id ), $q->get_results() ),
		);
	}

	public static function profile( int $user_id ): ?array {
		if ( ! self::member_read_allowed( Roles::VIEW_DIRECTORY, 'directory' ) ) {
			return null;
		}
		$user = $user_id > 0 ? get_userdata( $user_id ) : false;
		if ( ! $user ) {
			return null;
		}
		if ( get_current_user_id() === $user_id || Access::current_can( Roles::MANAGE_MEMBERS ) || Access::standing( $user_id )['is_active'] ) {
			return self::node( $user_id );
		}
		return null;
	}

	/**
	 * Zoom check-in: confirm a membership number. Only name, chapter and whether the brother is active.
	 * Needs b151_verify_members on an admin session; rate-limited; every lookup is logged.
	 */
	public static function verify( string $number ): array {
		if ( ! Access::current_can( Roles::VERIFY_MEMBERS ) ) {
			throw new UserError( 'You do not have permission to do that.' );
		}
		$actor = get_current_user_id();
		if ( Rate_Limiter::exceeded( 'verify', (string) $actor, (int) Settings::get( 'verify_per_minute' ) ) ) {
			throw new UserError( 'Too many lookups. Please wait a minute and try again.' );
		}
		Rate_Limiter::hit( 'verify', (string) $actor, MINUTE_IN_SECONDS );
		$number = Membership::normalize_number( $number ) ?? strtoupper( trim( $number ) );
		$uid    = Membership::find_by_number( $number );
		Audit_Log::record( 'member_verified', 'user', $uid, array( 'number' => $number, 'found' => (bool) $uid ) );
		if ( ! $uid ) {
			return array( 'found' => false );
		}
		return array(
			'found'            => true,
			'membershipNumber' => $number,
			'displayName'      => Membership::get_profile_value( $uid, 'display_name' ),
			'chapter'          => Chapters::summary( Membership::get_chapter_id( $uid ) ),
			'isActive'         => Access::standing( $uid )['is_active'],
		);
	}

	/* ---------------- content mapping ---------------- */

	private static function scope( WP_Post $p ): array {
		$aud = (string) get_post_meta( $p->ID, Content_Types::META_AUDIENCE, true );
		return array(
			'audience' => 'chapter' === $aud ? 'CHAPTER' : 'ALL',
			'chapter'  => 'chapter' === $aud ? Chapters::summary( (int) get_post_meta( $p->ID, Content_Types::META_CHAPTER, true ) ) : null,
		);
	}

	private static function iso( string $local ): ?string {
		if ( '' === $local ) {
			return null;
		}
		$dt = date_create_immutable( $local, wp_timezone() );
		return $dt ? $dt->format( DATE_ATOM ) : null;
	}

	public static function event( WP_Post $p ): array {
		$m   = static fn( string $k ) => (string) get_post_meta( $p->ID, $k, true );
		$img = get_the_post_thumbnail_url( $p, 'large' );
		return self::scope( $p ) + array(
			'id'          => $p->ID,
			'title'       => get_the_title( $p ),
			'contentHtml' => Member_Content::html( $p ),
			'startsAt'    => self::iso( $m( Content_Types::META_STARTS ) ),
			'endsAt'      => self::iso( $m( Content_Types::META_ENDS ) ),
			'location'    => $m( Content_Types::META_LOCATION ) ?: null,
			'isVirtual'   => '' !== $m( Content_Types::META_VURL ),
			// Virtual meeting details are only ever returned here, to members allowed to see the event.
			'virtualUrl'  => $m( Content_Types::META_VURL ) ?: null,
			'meetingId'   => $m( Content_Types::META_VMEETING ) ?: null,
			'passcode'    => $m( Content_Types::META_VPASSCODE ) ?: null,
			'imageUrl'    => $img ?: null,
		);
	}

	public static function announcement( WP_Post $p ): array {
		return self::scope( $p ) + array(
			'id'          => $p->ID,
			'title'       => get_the_title( $p ),
			'contentHtml' => Member_Content::html( $p ),
			'date'        => get_post_time( DATE_ATOM, true, $p ),
			'expiresOn'   => (string) get_post_meta( $p->ID, Content_Types::META_EXPIRES, true ) ?: null,
			'pinned'      => (bool) get_post_meta( $p->ID, Content_Types::META_PINNED, true ),
		);
	}

	public static function resource( WP_Post $p ): array {
		$file = get_post_meta( $p->ID, Content_Types::META_FILE, true );
		$has  = is_array( $file ) && ! empty( $file['stored'] );
		return self::scope( $p ) + array(
			'id'              => $p->ID,
			'title'           => get_the_title( $p ),
			'descriptionHtml' => Member_Content::html( $p ),
			'category'        => (string) get_post_meta( $p->ID, Content_Types::META_CATEGORY, true ) ?: null,
			'fileName'        => $has ? (string) $file['name'] : null,
			'fileSize'        => $has ? (int) $file['size'] : null,
			'mimeType'        => $has ? (string) $file['mime'] : null,
			'downloadUrl'     => $has ? Downloads::url( $p->ID ) : null,
			'updatedAt'       => get_post_modified_time( DATE_ATOM, true, $p ),
		);
	}

	/* ---------------- schema ---------------- */

	public static function register_types(): void {
		register_graphql_enum_type(
			'PortalAudienceEnum',
			array( 'values' => array( 'ALL' => array( 'value' => 'ALL' ), 'CHAPTER' => array( 'value' => 'CHAPTER' ) ) )
		);

		$scoped = array(
			'id'       => array( 'type' => 'Int' ),
			'title'    => array( 'type' => 'String' ),
			'audience' => array( 'type' => 'PortalAudienceEnum' ),
			'chapter'  => array( 'type' => 'PortalChapter' ),
		);

		register_graphql_object_type(
			'PortalMemberEvent',
			array(
				'description' => 'A members-only event.',
				'fields'      => $scoped + array(
					'contentHtml' => array( 'type' => 'String' ),
					'startsAt'    => array( 'type' => 'String' ),
					'endsAt'      => array( 'type' => 'String' ),
					'location'    => array( 'type' => 'String' ),
					'isVirtual'   => array( 'type' => 'Boolean' ),
					'virtualUrl'  => array( 'type' => 'String' ),
					'meetingId'   => array( 'type' => 'String' ),
					'passcode'    => array( 'type' => 'String' ),
					'imageUrl'    => array( 'type' => 'String' ),
				),
			)
		);
		register_graphql_object_type(
			'PortalAnnouncement',
			array(
				'fields' => $scoped + array(
					'contentHtml' => array( 'type' => 'String' ),
					'date'        => array( 'type' => 'String' ),
					'expiresOn'   => array( 'type' => 'String' ),
					'pinned'      => array( 'type' => 'Boolean' ),
				),
			)
		);
		register_graphql_object_type(
			'PortalResource',
			array(
				'fields' => $scoped + array(
					'descriptionHtml' => array( 'type' => 'String' ),
					'category'        => array( 'type' => 'String' ),
					'fileName'        => array( 'type' => 'String' ),
					'fileSize'        => array( 'type' => 'Int' ),
					'mimeType'        => array( 'type' => 'String' ),
					'downloadUrl'     => array( 'type' => 'String', 'description' => 'Signed-in download link (works only in this browser session).' ),
					'updatedAt'       => array( 'type' => 'String' ),
				),
			)
		);
		foreach ( array( 'PortalMember', 'PortalMemberEvent', 'PortalAnnouncement', 'PortalResource' ) as $t ) {
			register_graphql_object_type(
				$t . 'List',
				array(
					'fields' => array(
						'total' => array( 'type' => 'Int' ),
						'nodes' => array( 'type' => array( 'list_of' => $t ) ),
					),
				)
			);
		}
		register_graphql_object_type(
			'PortalMemberVerification',
			array(
				'description' => 'Result of a membership-number check (Zoom check-in).',
				'fields'      => array(
					'found'            => array( 'type' => 'Boolean' ),
					'membershipNumber' => array( 'type' => 'String' ),
					'displayName'      => array( 'type' => 'String' ),
					'chapter'          => array( 'type' => 'PortalChapter' ),
					'isActive'         => array( 'type' => 'Boolean' ),
				),
			)
		);

		$page = array( 'first' => array( 'type' => 'Int' ), 'offset' => array( 'type' => 'Int' ) );

		register_graphql_field( 'RootQuery', 'memberDirectory', array(
			'type'        => 'PortalMemberList',
			'description' => 'Active brothers (25 per page). Fields each brother has not shared come back null.',
			'args'        => $page + array( 'search' => array( 'type' => 'String' ), 'chapterId' => array( 'type' => 'Int' ) ),
			'resolve'     => static fn( $root, array $args ) => self::directory( $args ),
		) );
		register_graphql_field( 'RootQuery', 'memberProfile', array(
			'type'    => 'PortalMember',
			'args'    => array( 'id' => array( 'type' => array( 'non_null' => 'Int' ) ) ),
			'resolve' => static fn( $root, array $args ) => self::profile( (int) $args['id'] ),
		) );
		register_graphql_field( 'RootQuery', 'verifyMember', array(
			'type'    => 'PortalMemberVerification',
			'args'    => array( 'membershipNumber' => array( 'type' => array( 'non_null' => 'String' ) ) ),
			'resolve' => static fn( $root, array $args ) => self::verify( (string) $args['membershipNumber'] ),
		) );

		$lists = array(
			'memberEvents'        => array( 'PortalMemberEventList', 'events', array( 'event' ), $page + array( 'from' => array( 'type' => 'String' ), 'to' => array( 'type' => 'String' ), 'includePast' => array( 'type' => 'Boolean' ) ) ),
			'memberAnnouncements' => array( 'PortalAnnouncementList', 'announcements', array( 'announcement' ), $page ),
			'memberResources'     => array( 'PortalResourceList', 'resources', array( 'resource' ), $page + array( 'category' => array( 'type' => 'String' ) ) ),
		);
		foreach ( $lists as $field => list( $type, $method, $map, $args ) ) {
			register_graphql_field( 'RootQuery', $field, array(
				'type'    => $type,
				'args'    => $args,
				'resolve' => static function ( $root, array $a ) use ( $method, $map ) {
					$r = Member_Content::$method( $a );
					return array( 'total' => $r['total'], 'nodes' => array_map( array( self::class, $map[0] ), $r['posts'] ) );
				},
			) );
		}

		$singles = array(
			'memberEvent'        => array( 'PortalMemberEvent', Content_Types::EVENT, 'event' ),
			'memberAnnouncement' => array( 'PortalAnnouncement', Content_Types::ANNOUNCEMENT, 'announcement' ),
			'memberResource'     => array( 'PortalResource', Content_Types::RESOURCE, 'resource' ),
		);
		foreach ( $singles as $field => list( $type, $post_type, $map ) ) {
			register_graphql_field( 'RootQuery', $field, array(
				'type'    => $type,
				'args'    => array( 'id' => array( 'type' => array( 'non_null' => 'Int' ) ) ),
				'resolve' => static function ( $root, array $a ) use ( $post_type, $map ) {
					$p = Member_Content::get( (int) $a['id'], $post_type );
					return $p ? self::$map( $p ) : null;
				},
			) );
		}
	}
}
