<?php
namespace B151\Members;

use WP_Error;
use WP_Session_Tokens;

/**
 * Membership model: status (separate from roles), classification, membership numbers, chapter, profile fields
 * and directory visibility. Data lives in WordPress users + user meta (+ the membership-number table).
 * See ARCHITECTURE.md §3.
 */
final class Membership {

	public const STATUS_PENDING   = 'pending';
	public const STATUS_ACTIVE    = 'active';
	public const STATUS_INACTIVE  = 'inactive';
	public const STATUS_SUSPENDED = 'suspended';

	public const STATUSES        = array( self::STATUS_PENDING, self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_SUSPENDED );
	public const CLASSIFICATIONS = array( 'member', 'life_member', 'honorary' );

	public const META_STATUS         = 'b151_status';
	public const META_CLASSIFICATION = 'b151_classification';
	public const META_NUMBER         = 'b151_membership_number';
	public const META_CHAPTER        = 'b151_chapter_id';
	public const META_APPROVED_AT    = 'b151_approved_at';
	public const META_APPROVED_BY    = 'b151_approved_by';
	public const META_STATUS_AT      = 'b151_status_changed_at';
	public const META_STATUS_REASON  = 'b151_status_reason';
	public const META_VISIBILITY     = 'b151_visibility';
	public const META_UPDATED_AT     = 'b151_profile_updated_at';

	public const NUMBER_PREFIX = '151-';
	public const NUMBER_DIGITS = 5;

	/**
	 * Profile fields a member may edit about himself (allow-list). Status, number, chapter, roles and
	 * classification are never editable by the member.
	 */
	public const PROFILE_FIELDS = array(
		'display_name' => 'b151_display_name',
		'bio'          => 'b151_bio',
		'phone'        => 'b151_phone',
		'address1'     => 'b151_address_line1',
		'address2'     => 'b151_address_line2',
		'city'         => 'b151_address_city',
		'state'        => 'b151_address_state',
		'postal_code'  => 'b151_address_postal_code',
		'joined_year'  => 'b151_joined_year',
		'line'         => 'b151_line',
	);

	/** Fields other members always see (owner decision): name, chapter, year, Active indicator. */
	public const ALWAYS_VISIBLE = array( 'display_name', 'chapter', 'joined_year', 'is_active' );

	/** Fields a brother may opt in to sharing with other members (default: admins only). */
	public const OPT_IN_FIELDS = array( 'email', 'phone', 'address', 'bio', 'line', 'classification' );

	public static function register(): void {
		// Status changes away from active end every session immediately.
		add_action( 'b151_status_changed', array( self::class, 'on_status_changed' ), 10, 3 );
	}

	public static function numbers_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'b151_member_numbers';
	}

	/* ---------- Status ---------- */

	public static function get_status( int $user_id ): string {
		$status = (string) get_user_meta( $user_id, self::META_STATUS, true );
		return in_array( $status, self::STATUSES, true ) ? $status : self::STATUS_PENDING;
	}

	/**
	 * Change a member's status (audited). Leaving `active` destroys all of the member's sessions.
	 *
	 * @return true|WP_Error
	 */
	public static function set_status( int $user_id, string $status, string $reason = '' ) {
		if ( ! in_array( $status, self::STATUSES, true ) ) {
			return new WP_Error( 'b151_invalid_status', 'Invalid status.' );
		}
		if ( ! get_userdata( $user_id ) ) {
			return new WP_Error( 'b151_unknown_user', 'Unknown user.' );
		}
		$old = self::get_status( $user_id );
		update_user_meta( $user_id, self::META_STATUS, $status );
		update_user_meta( $user_id, self::META_STATUS_AT, current_time( 'mysql', true ) );
		update_user_meta( $user_id, self::META_STATUS_REASON, sanitize_text_field( $reason ) );
		Audit_Log::record( 'member_status_changed', 'user', $user_id, array( 'from' => $old, 'to' => $status, 'reason' => sanitize_text_field( $reason ) ) );
		do_action( 'b151_status_changed', $user_id, $old, $status );
		return true;
	}

	public static function on_status_changed( int $user_id, string $old, string $new ): void {
		if ( self::STATUS_ACTIVE !== $new ) {
			WP_Session_Tokens::get_instance( $user_id )->destroy_all();
		}
	}

	/**
	 * Approve a pending member: status active, approval stamp, classification, membership number (if missing),
	 * member role (if the user has no role yet).
	 *
	 * @return true|WP_Error
	 */
	public static function approve( int $user_id, string $classification = 'member', ?int $approver = null ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return new WP_Error( 'b151_unknown_user', 'Unknown user.' );
		}
		if ( ! in_array( $classification, self::CLASSIFICATIONS, true ) ) {
			return new WP_Error( 'b151_invalid_classification', 'Invalid classification.' );
		}
		if ( self::STATUS_PENDING !== self::get_status( $user_id ) ) {
			return new WP_Error( 'b151_not_pending', 'Only pending members can be approved.' );
		}
		if ( ! self::get_number( $user_id ) ) {
			$number = self::assign_next_number( $user_id );
			if ( is_wp_error( $number ) ) {
				return $number;
			}
		}
		if ( ! array_intersect( (array) $user->roles, array_merge( array( Roles::ROLE_MEMBER ), Roles::backend_roles() ) ) ) {
			$user->set_role( Roles::ROLE_MEMBER );
		}
		update_user_meta( $user_id, self::META_CLASSIFICATION, $classification );
		update_user_meta( $user_id, self::META_APPROVED_AT, current_time( 'mysql', true ) );
		update_user_meta( $user_id, self::META_APPROVED_BY, $approver ?? get_current_user_id() );
		Audit_Log::record( 'member_approved', 'user', $user_id, array( 'classification' => $classification ) );
		return self::set_status( $user_id, self::STATUS_ACTIVE, 'approved' );
	}

	/* ---------- Classification ---------- */

	public static function get_classification( int $user_id ): string {
		$c = (string) get_user_meta( $user_id, self::META_CLASSIFICATION, true );
		return in_array( $c, self::CLASSIFICATIONS, true ) ? $c : 'member';
	}

	/** @return true|WP_Error */
	public static function set_classification( int $user_id, string $classification ) {
		if ( ! in_array( $classification, self::CLASSIFICATIONS, true ) ) {
			return new WP_Error( 'b151_invalid_classification', 'Invalid classification.' );
		}
		update_user_meta( $user_id, self::META_CLASSIFICATION, $classification );
		Audit_Log::record( 'member_classification_changed', 'user', $user_id, array( 'to' => $classification ) );
		return true;
	}

	/* ---------- Membership numbers (151-NNNNN, permanent, never reused) ---------- */

	public static function format_number( int $sequence ): string {
		return self::NUMBER_PREFIX . str_pad( (string) $sequence, self::NUMBER_DIGITS, '0', STR_PAD_LEFT );
	}

	public static function parse_number( string $number ): ?int {
		return preg_match( '/^151-(\d{5})$/', trim( $number ), $m ) ? (int) $m[1] : null;
	}

	public static function get_number( int $user_id ): string {
		return (string) get_user_meta( $user_id, self::META_NUMBER, true );
	}

	/** Assign the next free number. The table's unique keys guarantee no duplicates even under concurrency. */
	public static function assign_next_number( int $user_id ) {
		global $wpdb;
		if ( self::get_number( $user_id ) ) {
			return new WP_Error( 'b151_has_number', 'This member already has a membership number.' );
		}
		for ( $attempt = 0; $attempt < 5; $attempt++ ) {
			$max  = (int) $wpdb->get_var( 'SELECT MAX(sequence) FROM ' . self::numbers_table() ); // phpcs:ignore
			$next = $max + 1;
			if ( $next > ( 10 ** self::NUMBER_DIGITS ) - 1 ) {
				return new WP_Error( 'b151_numbers_exhausted', 'Membership numbers are exhausted; the format needs revisiting.' );
			}
			$ok = self::insert_number( $user_id, $next );
			if ( true === $ok ) {
				return self::format_number( $next );
			}
		}
		return new WP_Error( 'b151_number_conflict', 'Could not assign a membership number. Please try again.' );
	}

	/**
	 * Set a specific number once (importing existing brothers). Fails if the format is wrong, the number was ever
	 * used, or the member already has one.
	 *
	 * @return true|WP_Error
	 */
	public static function import_number( int $user_id, string $number ) {
		$seq = self::parse_number( $number );
		if ( null === $seq || $seq < 1 ) {
			return new WP_Error( 'b151_bad_number', 'Membership numbers look like 151-00001.' );
		}
		if ( self::get_number( $user_id ) ) {
			return new WP_Error( 'b151_has_number', 'This member already has a membership number.' );
		}
		return true === self::insert_number( $user_id, $seq )
			? true
			: new WP_Error( 'b151_number_taken', 'That membership number has already been used.' );
	}

	private static function insert_number( int $user_id, int $sequence ) {
		global $wpdb;
		$number = self::format_number( $sequence );
		$prev   = $wpdb->suppress_errors( true );
		$ok     = $wpdb->insert(
			self::numbers_table(),
			array(
				'membership_number' => $number,
				'sequence'          => $sequence,
				'user_id'           => $user_id,
				'assigned_at'       => current_time( 'mysql', true ),
			),
			array( '%s', '%d', '%d', '%s' )
		);
		$wpdb->suppress_errors( $prev );
		if ( ! $ok ) {
			return false;
		}
		update_user_meta( $user_id, self::META_NUMBER, $number );
		Audit_Log::record( 'membership_number_assigned', 'user', $user_id, array( 'number' => $number ) );
		return true;
	}

	/** Look a member up by number (for the Zoom host check). */
	public static function find_by_number( string $number ): int {
		global $wpdb;
		if ( null === self::parse_number( $number ) ) {
			return 0;
		}
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT user_id FROM ' . self::numbers_table() . ' WHERE membership_number = %s', trim( $number ) ) ); // phpcs:ignore
	}

	/* ---------- Chapter ---------- */

	public static function get_chapter_id( int $user_id ): int {
		return (int) get_user_meta( $user_id, self::META_CHAPTER, true );
	}

	/** @return true|WP_Error */
	public static function set_chapter( int $user_id, int $chapter_id ) {
		if ( $chapter_id && ! Chapters::exists( $chapter_id ) ) {
			return new WP_Error( 'b151_unknown_chapter', 'Unknown chapter.' );
		}
		$old = self::get_chapter_id( $user_id );
		update_user_meta( $user_id, self::META_CHAPTER, $chapter_id );
		Audit_Log::record( 'member_chapter_changed', 'user', $user_id, array( 'from' => $old, 'to' => $chapter_id ) );
		return true;
	}

	/* ---------- Profile ---------- */

	public static function get_profile_value( int $user_id, string $field ): string {
		if ( 'display_name' === $field ) {
			$v = (string) get_user_meta( $user_id, self::PROFILE_FIELDS['display_name'], true );
			if ( '' === $v ) {
				$user = get_userdata( $user_id );
				$v    = $user ? $user->display_name : '';
			}
			return $v;
		}
		return isset( self::PROFILE_FIELDS[ $field ] ) ? (string) get_user_meta( $user_id, self::PROFILE_FIELDS[ $field ], true ) : '';
	}

	/**
	 * Update own profile. Only allow-listed fields are accepted; anything else is rejected.
	 *
	 * @param array<string,mixed> $values
	 * @return true|WP_Error
	 */
	public static function update_profile( int $user_id, array $values ) {
		$unknown = array_diff( array_keys( $values ), array_merge( array_keys( self::PROFILE_FIELDS ), array( 'visibility' ) ) );
		if ( $unknown ) {
			return new WP_Error( 'b151_field_not_editable', 'These fields cannot be changed here: ' . implode( ', ', $unknown ) );
		}
		foreach ( self::PROFILE_FIELDS as $field => $meta_key ) {
			if ( ! array_key_exists( $field, $values ) ) {
				continue;
			}
			$value = 'bio' === $field ? sanitize_textarea_field( (string) $values[ $field ] ) : sanitize_text_field( (string) $values[ $field ] );
			if ( 'joined_year' === $field && '' !== $value && ! preg_match( '/^(19|20)\d{2}$/', $value ) ) {
				return new WP_Error( 'b151_invalid_year', 'Year must look like 1982.' );
			}
			if ( 'display_name' === $field && '' === trim( $value ) ) {
				return new WP_Error( 'b151_invalid_name', 'Display name cannot be empty.' );
			}
			update_user_meta( $user_id, $meta_key, mb_substr( $value, 0, 'bio' === $field ? 2000 : 200 ) );
			if ( 'display_name' === $field ) {
				// Keep WordPress's own display name in step (the directory searches it; wp-admin shows it).
				wp_update_user( array( 'ID' => $user_id, 'display_name' => mb_substr( $value, 0, 200 ) ) );
			}
		}
		if ( array_key_exists( 'visibility', $values ) ) {
			$result = self::set_visibility( $user_id, (array) $values['visibility'] );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}
		update_user_meta( $user_id, self::META_UPDATED_AT, current_time( 'mysql', true ) );
		Audit_Log::record( 'member_profile_updated', 'user', $user_id, array( 'fields' => array_keys( $values ) ) );
		return true;
	}

	/* ---------- Directory visibility ---------- */

	/** @return array<string,string> field => 'members'|'admins' (defaults: admins) */
	public static function get_visibility( int $user_id ): array {
		$saved = get_user_meta( $user_id, self::META_VISIBILITY, true );
		$saved = is_array( $saved ) ? $saved : array();
		$out   = array();
		foreach ( self::OPT_IN_FIELDS as $field ) {
			$out[ $field ] = ( isset( $saved[ $field ] ) && 'members' === $saved[ $field ] ) ? 'members' : 'admins';
		}
		return $out;
	}

	/** @return true|WP_Error */
	public static function set_visibility( int $user_id, array $visibility ) {
		$current = self::get_visibility( $user_id );
		foreach ( $visibility as $field => $audience ) {
			if ( ! in_array( $field, self::OPT_IN_FIELDS, true ) || ! in_array( $audience, array( 'members', 'admins' ), true ) ) {
				return new WP_Error( 'b151_invalid_visibility', 'Invalid visibility setting.' );
			}
			$current[ $field ] = $audience;
		}
		update_user_meta( $user_id, self::META_VISIBILITY, $current );
		return true;
	}
}
