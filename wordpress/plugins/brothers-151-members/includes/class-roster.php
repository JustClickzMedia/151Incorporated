<?php
namespace B151\Members;

/**
 * Roster export (CSV) for membership admins. Contains contact data, so: capability + elevated session +
 * nonce, every export audit-logged, and cells escaped against spreadsheet formula injection.
 */
final class Roster {

	public const COLUMNS = array(
		'membership_number' => 'Membership #',
		'display_name'      => 'Name',
		'email'             => 'Email',
		'phone'             => 'Phone',
		'address1'          => 'Address',
		'address2'          => 'Address 2',
		'city'              => 'City',
		'state'             => 'State',
		'postal_code'       => 'ZIP',
		'chapter'           => 'Chapter',
		'joined_year'       => 'Year',
		'line'              => 'Line',
		'classification'    => 'Classification',
		'status'            => 'Status',
		'approved_at'       => 'Approved (UTC)',
	);

	/** A cell that starts with = + - @ (or a tab/CR) would run as a formula in Excel/Sheets: prefix it with '. */
	public static function cell( $value ): string {
		$v = (string) $value;
		return ( '' !== $v && preg_match( '/^[=+\-@\t\r]/', $v ) ) ? "'" . $v : $v;
	}

	/** @return array<int,array<string,string>> */
	public static function rows( string $status = '' ): array {
		$meta = array();
		if ( in_array( $status, Membership::STATUSES, true ) ) {
			$meta[] = array( 'key' => Membership::META_STATUS, 'value' => $status );
		} else {
			$meta[] = array( 'key' => Membership::META_STATUS, 'compare' => 'EXISTS' );
		}
		$ids  = get_users( array( 'fields' => 'ID', 'meta_query' => $meta, 'orderby' => 'display_name', 'order' => 'ASC', 'number' => 5000 ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
		$rows = array();
		foreach ( $ids as $id ) {
			$id      = (int) $id;
			$user    = get_userdata( $id );
			$chapter = Chapters::summary( Membership::get_chapter_id( $id ) );
			$row     = array();
			foreach ( array_keys( self::COLUMNS ) as $col ) {
				switch ( $col ) {
					case 'membership_number':
						$row[ $col ] = Membership::get_number( $id );
						break;
					case 'email':
						$row[ $col ] = $user ? $user->user_email : '';
						break;
					case 'chapter':
						$row[ $col ] = $chapter ? $chapter['name'] : '';
						break;
					case 'classification':
						$row[ $col ] = Membership::get_classification( $id );
						break;
					case 'status':
						$row[ $col ] = Membership::get_status( $id );
						break;
					case 'approved_at':
						$row[ $col ] = (string) get_user_meta( $id, Membership::META_APPROVED_AT, true );
						break;
					default:
						$row[ $col ] = Membership::get_profile_value( $id, $col );
				}
			}
			$rows[] = $row;
		}
		return $rows;
	}

	public static function csv( array $rows ): string {
		$fh = fopen( 'php://temp', 'r+' ); // phpcs:ignore
		fwrite( $fh, "\xEF\xBB\xBF" ); // UTF-8 BOM so Excel shows names correctly // phpcs:ignore
		fputcsv( $fh, array_values( self::COLUMNS ), ',', '"', '' );
		foreach ( $rows as $row ) {
			fputcsv( $fh, array_map( array( self::class, 'cell' ), array_values( $row ) ), ',', '"', '' );
		}
		rewind( $fh );
		$out = stream_get_contents( $fh );
		fclose( $fh ); // phpcs:ignore
		return (string) $out;
	}
}
