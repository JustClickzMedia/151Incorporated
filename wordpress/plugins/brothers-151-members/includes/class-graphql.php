<?php
namespace B151\Members;

use GraphQL\Error\UserError;

/**
 * Protected GraphQL operations (ARCHITECTURE.md §6). Every resolver checks, in this order:
 * signed in → eligible status → capability (+ elevated session for admin operations) → resource → field visibility.
 * Angular only decides what to show; the server decides what is allowed.
 */
final class Graphql {

	private const FIELD_MAP = array(
		'displayName' => 'display_name',
		'bio'         => 'bio',
		'phone'       => 'phone',
		'address1'    => 'address1',
		'address2'    => 'address2',
		'city'        => 'city',
		'state'       => 'state',
		'postalCode'  => 'postal_code',
		'joinedYear'  => 'joined_year',
		'line'        => 'line',
	);

	public static function register(): void {
		add_action( 'graphql_register_types', array( self::class, 'register_types' ) );
	}

	/* ---------------- authorization helpers ---------------- */

	/** May the current viewer see `$field` of member `$target`? */
	public static function can_view( int $target, string $field ): bool {
		$viewer = get_current_user_id();
		if ( ! $viewer ) {
			return false;
		}
		if ( $viewer === $target ) {
			return Access::current_has_member_access();
		}
		if ( Access::current_can( Roles::MANAGE_MEMBERS ) ) {
			return true;
		}
		if ( in_array( $field, array( 'membershipNumber' ), true ) ) {
			return Access::current_can( Roles::VERIFY_MEMBERS );
		}
		if ( in_array( $field, array( 'status' ), true ) ) {
			return false;
		}
		if ( ! Access::current_has_member_access() || ! current_user_can( Roles::VIEW_DIRECTORY ) ) {
			return false;
		}
		if ( ! Access::standing( $target )['is_active'] ) {
			return false; // the directory only shows active brothers to other members
		}
		$always = array( 'id', 'displayName', 'chapter', 'joinedYear', 'isActive' );
		if ( in_array( $field, $always, true ) ) {
			return true;
		}
		$opt_in_map = array(
			'email'          => 'email',
			'phone'          => 'phone',
			'address1'       => 'address',
			'address2'       => 'address',
			'city'           => 'address',
			'state'          => 'address',
			'postalCode'     => 'address',
			'bio'            => 'bio',
			'line'           => 'line',
			'classification' => 'classification',
		);
		if ( isset( $opt_in_map[ $field ] ) ) {
			return 'members' === ( Membership::get_visibility( $target )[ $opt_in_map[ $field ] ] ?? 'admins' );
		}
		return false;
	}

	private static function require_member_access(): int {
		if ( ! is_user_logged_in() ) {
			throw new UserError( 'Please sign in.' );
		}
		if ( ! Access::current_has_member_access() ) {
			throw new UserError( 'Your membership is not active.' );
		}
		return get_current_user_id();
	}

	private static function require_admin( string $cap ): int {
		if ( ! is_user_logged_in() ) {
			throw new UserError( 'Please sign in.' );
		}
		if ( ! Access::current_can( $cap ) ) {
			throw new UserError( 'You do not have permission to do that.' );
		}
		return get_current_user_id();
	}

	private static function require_target( int $user_id ): \WP_User {
		$user = $user_id > 0 ? get_userdata( $user_id ) : false;
		if ( ! $user ) {
			throw new UserError( 'Member not found.' );
		}
		return $user;
	}

	/** Status changes on admin accounts, or on yourself, need the highest tier. */
	private static function guard_status_target( \WP_User $target ): void {
		if ( get_current_user_id() === $target->ID ) {
			throw new UserError( 'You cannot change your own membership status.' );
		}
		if ( user_can( $target, Roles::BACKEND_ACCESS ) && ! Access::current_can( Roles::ASSIGN_BACKEND_ROLES ) ) {
			throw new UserError( 'You do not have permission to change an admin account.' );
		}
	}

	private static function member_node( int $uid ): array {
		return array( '__b151_uid' => $uid );
	}

	private static function field( string $name, string $type, callable $value, string $description = '' ): array {
		return array(
			'type'        => $type,
			'description' => $description,
			'resolve'     => static function ( $node ) use ( $name, $value ) {
				$uid = (int) ( $node['__b151_uid'] ?? 0 );
				return ( $uid && self::can_view( $uid, $name ) ) ? $value( $uid ) : null;
			},
		);
	}

	/* ---------------- schema ---------------- */

	public static function register_types(): void {
		register_graphql_enum_type(
			'PortalMemberClassificationEnum',
			array(
				'description' => 'Membership classification.',
				'values'      => array(
					'MEMBER'      => array( 'value' => 'member' ),
					'LIFE_MEMBER' => array( 'value' => 'life_member' ),
					'HONORARY'    => array( 'value' => 'honorary' ),
				),
			)
		);
		register_graphql_enum_type(
			'PortalMemberStatusEnum',
			array(
				'description' => 'Membership status.',
				'values'      => array(
					'PENDING'   => array( 'value' => 'pending' ),
					'ACTIVE'    => array( 'value' => 'active' ),
					'INACTIVE'  => array( 'value' => 'inactive' ),
					'SUSPENDED' => array( 'value' => 'suspended' ),
				),
			)
		);

		register_graphql_object_type(
			'PortalChapter',
			array(
				'description' => 'A chapter of The Brothers of 1-5-1.',
				'fields'      => array(
					'id'   => array( 'type' => 'Int' ),
					'name' => array( 'type' => 'String' ),
				),
			)
		);

		$addr = static fn( string $f ) => static fn( int $u ) => Membership::get_profile_value( $u, $f ) ?: null;

		register_graphql_object_type(
			'PortalMember',
			array(
				'description' => 'A brother, as visible to the current viewer. Fields the viewer may not see are null.',
				'fields'      => array(
					'id'               => self::field( 'id', 'Int', static fn( int $u ) => $u ),
					'displayName'      => self::field( 'displayName', 'String', static fn( int $u ) => Membership::get_profile_value( $u, 'display_name' ) ),
					'chapter'          => self::field( 'chapter', 'PortalChapter', static fn( int $u ) => Chapters::summary( Membership::get_chapter_id( $u ) ) ),
					'joinedYear'       => self::field( 'joinedYear', 'String', $addr( 'joined_year' ) ),
					'isActive'         => self::field( 'isActive', 'Boolean', static fn( int $u ) => Access::standing( $u )['is_active'] ),
					'membershipNumber' => self::field( 'membershipNumber', 'String', static fn( int $u ) => Membership::get_number( $u ) ?: null ),
					'status'           => self::field( 'status', 'PortalMemberStatusEnum', static fn( int $u ) => Membership::get_status( $u ) ),
					'classification'   => self::field( 'classification', 'PortalMemberClassificationEnum', static fn( int $u ) => Membership::get_classification( $u ) ),
					'email'            => self::field( 'email', 'String', static fn( int $u ) => get_userdata( $u )->user_email ),
					'phone'            => self::field( 'phone', 'String', $addr( 'phone' ) ),
					'address1'         => self::field( 'address1', 'String', $addr( 'address1' ) ),
					'address2'         => self::field( 'address2', 'String', $addr( 'address2' ) ),
					'city'             => self::field( 'city', 'String', $addr( 'city' ) ),
					'state'            => self::field( 'state', 'String', $addr( 'state' ) ),
					'postalCode'       => self::field( 'postalCode', 'String', $addr( 'postal_code' ) ),
					'bio'              => self::field( 'bio', 'String', $addr( 'bio' ) ),
					'line'             => self::field( 'line', 'String', $addr( 'line' ) ),
				),
			)
		);

		register_graphql_object_type(
			'PortalVisibility',
			array(
				'fields' => array(
					'field'    => array( 'type' => 'String' ),
					'audience' => array( 'type' => 'String', 'description' => '"members" or "admins".' ),
				),
			)
		);

		register_graphql_object_type(
			'PortalSessionStatus',
			array(
				'fields' => array(
					'authenticated'        => array( 'type' => array( 'non_null' => 'Boolean' ) ),
					'idleSecondsRemaining' => array( 'type' => 'Int' ),
					'expiresAt'            => array( 'type' => 'String' ),
					'adminSession'         => array( 'type' => 'Boolean' ),
					'member'               => array( 'type' => 'PortalMember' ),
				),
			)
		);

		register_graphql_field(
			'RootQuery',
			'currentMember',
			array(
				'type'        => 'PortalMember',
				'description' => 'The signed-in brother (null when not signed in or not active).',
				'resolve'     => static function () {
					$uid = get_current_user_id();
					return ( $uid && Access::current_has_member_access() ) ? self::member_node( $uid ) : null;
				},
			)
		);

		register_graphql_field(
			'RootQuery',
			'myMemberVisibility',
			array(
				'type'    => array( 'list_of' => 'PortalVisibility' ),
				'resolve' => static function () {
					$uid = self::require_member_access();
					$out = array();
					foreach ( Membership::get_visibility( $uid ) as $f => $a ) {
						$out[] = array( 'field' => $f, 'audience' => $a );
					}
					return $out;
				},
			)
		);

		register_graphql_field(
			'RootQuery',
			'portalSessionStatus',
			array(
				'type'    => array( 'non_null' => 'PortalSessionStatus' ),
				'resolve' => static function () {
					$uid   = get_current_user_id();
					$token = wp_get_session_token();
					$rem   = $uid ? Sessions::remaining( $uid, $token ) : null;
					if ( ! $uid || ! Access::current_has_member_access() ) {
						return array( 'authenticated' => false );
					}
					return array(
						'authenticated'        => true,
						'idleSecondsRemaining' => $rem['idle_seconds_remaining'] ?? null,
						'expiresAt'            => isset( $rem['expires_at'] ) ? gmdate( 'c', $rem['expires_at'] ) : null,
						'adminSession'         => Sessions::is_elevated( $uid ),
						'member'               => self::member_node( $uid ),
					);
				},
			)
		);

		register_graphql_field(
			'RootQuery',
			'pendingMembers',
			array(
				'type'        => array( 'list_of' => 'PortalMember' ),
				'description' => 'Accounts waiting for approval (membership admins).',
				'args'        => array(
					'first'  => array( 'type' => 'Int' ),
					'offset' => array( 'type' => 'Int' ),
				),
				'resolve'     => static function ( $root, array $args ) {
					self::require_admin( Roles::APPROVE_MEMBERS );
					$ids = get_users(
						array(
							'fields'       => 'ID',
							'number'       => max( 1, min( 100, (int) ( $args['first'] ?? 20 ) ) ),
							'offset'       => max( 0, (int) ( $args['offset'] ?? 0 ) ),
							'role__not_in' => Roles::backend_roles(),
							'orderby'      => 'registered',
							'order'        => 'ASC',
							'meta_query'   => array( // phpcs:ignore WordPress.DB.SlowDBQuery
								'relation' => 'OR',
								array( 'key' => Membership::META_STATUS, 'value' => Membership::STATUS_PENDING ),
								array( 'key' => Membership::META_STATUS, 'compare' => 'NOT EXISTS' ),
							),
						)
					);
					return array_map( static fn( $id ) => self::member_node( (int) $id ), $ids );
				},
			)
		);

		register_graphql_input_type(
			'PortalVisibilityInput',
			array(
				'fields' => array(
					'field'    => array( 'type' => array( 'non_null' => 'String' ) ),
					'audience' => array( 'type' => array( 'non_null' => 'String' ) ),
				),
			)
		);

		$profile_inputs = array();
		foreach ( array_keys( self::FIELD_MAP ) as $f ) {
			$profile_inputs[ $f ] = array( 'type' => 'String' );
		}
		$profile_inputs['visibility'] = array( 'type' => array( 'list_of' => 'PortalVisibilityInput' ) );

		register_graphql_mutation(
			'updateMyMemberProfile',
			array(
				'inputFields'         => $profile_inputs,
				'outputFields'        => array( 'member' => array( 'type' => 'PortalMember' ) ),
				'mutateAndGetPayload' => static function ( array $input ) {
					$uid = self::require_member_access();
					if ( ! current_user_can( Roles::EDIT_OWN_PROFILE ) ) {
						throw new UserError( 'You do not have permission to do that.' );
					}
					$values = array();
					foreach ( self::FIELD_MAP as $gql => $key ) {
						if ( array_key_exists( $gql, $input ) ) {
							$values[ $key ] = (string) $input[ $gql ];
						}
					}
					if ( isset( $input['visibility'] ) ) {
						$values['visibility'] = array();
						foreach ( (array) $input['visibility'] as $v ) {
							$values['visibility'][ (string) $v['field'] ] = (string) $v['audience'];
						}
					}
					$result = Membership::update_profile( $uid, $values );
					if ( is_wp_error( $result ) ) {
						throw new UserError( $result->get_error_message() );
					}
					return array( 'member' => self::member_node( $uid ) );
				},
			)
		);

		register_graphql_mutation(
			'approveMember',
			array(
				'inputFields'         => array(
					'userId'         => array( 'type' => array( 'non_null' => 'Int' ) ),
					'classification'   => array( 'type' => 'PortalMemberClassificationEnum' ),
					'membershipNumber' => array( 'type' => 'String', 'description' => 'Existing brothers: the number they already have. Empty = next number.' ),
				),
				'outputFields'        => array( 'member' => array( 'type' => 'PortalMember' ) ),
				'mutateAndGetPayload' => static function ( array $input ) {
					$actor  = self::require_admin( Roles::APPROVE_MEMBERS );
					$target = self::require_target( (int) $input['userId'] );
					self::guard_status_target( $target );
					$result = Membership::approve( $target->ID, (string) ( $input['classification'] ?? 'member' ), $actor, (string) ( $input['membershipNumber'] ?? '' ) );
					if ( is_wp_error( $result ) ) {
						throw new UserError( $result->get_error_message() );
					}
					return array( 'member' => self::member_node( $target->ID ) );
				},
			)
		);

		register_graphql_mutation(
			'setMembershipNumber',
			array(
				'description'         => 'Set or correct a membership number (membership admins). The old number is released.',
				'inputFields'         => array(
					'userId'           => array( 'type' => array( 'non_null' => 'Int' ) ),
					'membershipNumber' => array( 'type' => array( 'non_null' => 'String' ) ),
				),
				'outputFields'        => array( 'member' => array( 'type' => 'PortalMember' ) ),
				'mutateAndGetPayload' => static function ( array $input ) {
					self::require_admin( Roles::MANAGE_MEMBERS );
					$target = self::require_target( (int) $input['userId'] );
					$result = Membership::set_number( $target->ID, (string) $input['membershipNumber'] );
					if ( is_wp_error( $result ) ) {
						throw new UserError( $result->get_error_message() );
					}
					return array( 'member' => self::member_node( $target->ID ) );
				},
			)
		);

		$status_mutations = array(
			'suspendMember'    => Membership::STATUS_SUSPENDED,
			'reactivateMember' => Membership::STATUS_ACTIVE,
			'deactivateMember' => Membership::STATUS_INACTIVE,
		);
		foreach ( $status_mutations as $name => $status ) {
			register_graphql_mutation(
				$name,
				array(
					'inputFields'         => array(
						'userId' => array( 'type' => array( 'non_null' => 'Int' ) ),
						'reason' => array( 'type' => 'String' ),
					),
					'outputFields'        => array( 'member' => array( 'type' => 'PortalMember' ) ),
					'mutateAndGetPayload' => static function ( array $input ) use ( $status ) {
						self::require_admin( Roles::CHANGE_MEMBER_STATUS );
						$target = self::require_target( (int) $input['userId'] );
						self::guard_status_target( $target );
						if ( Membership::STATUS_ACTIVE === $status && Membership::STATUS_PENDING === Membership::get_status( $target->ID ) ) {
							throw new UserError( 'Pending accounts must be approved, not reactivated.' );
						}
						$result = Membership::set_status( $target->ID, $status, (string) ( $input['reason'] ?? '' ) );
						if ( is_wp_error( $result ) ) {
							throw new UserError( $result->get_error_message() );
						}
						return array( 'member' => self::member_node( $target->ID ) );
					},
				)
			);
		}
	}
}
