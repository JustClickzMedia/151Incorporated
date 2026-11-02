<?php
namespace B151\Members;

/**
 * Append-only audit log of security-relevant actions. Never stores passwords, tokens, nonces or contact data;
 * IP addresses are stored only as a salted hash.
 */
final class Audit_Log {

	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'b151_audit_log';
	}

	public static function record( string $action, string $target_type = '', int $target_id = 0, array $details = array(), ?int $actor = null ): void {
		global $wpdb;
		$wpdb->insert(
			self::table(),
			array(
				'occurred_at'   => current_time( 'mysql', true ),
				'actor_user_id' => $actor ?? get_current_user_id(),
				'action'        => substr( $action, 0, 64 ),
				'target_type'   => substr( $target_type, 0, 32 ),
				'target_id'     => $target_id,
				'ip_hash'       => self::ip_hash(),
				'details'       => $details ? wp_json_encode( self::scrub( $details ) ) : null,
			),
			array( '%s', '%d', '%s', '%s', '%d', '%s', '%s' )
		);
	}

	/** @return array<int, object> newest first */
	public static function recent( int $limit = 50, array $filters = array() ): array {
		global $wpdb;
		$where  = array( '1=1' );
		$params = array();
		if ( ! empty( $filters['action'] ) ) {
			$where[]  = 'action = %s';
			$params[] = $filters['action'];
		}
		if ( ! empty( $filters['target_id'] ) ) {
			$where[]  = 'target_id = %d';
			$params[] = (int) $filters['target_id'];
		}
		$params[] = max( 1, min( 500, $limit ) );
		$sql      = 'SELECT * FROM ' . self::table() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d';
		return $wpdb->get_results( $wpdb->prepare( $sql, $params ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	public static function ip_hash(): string {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : ''; // phpcs:ignore
		return '' === $ip ? '' : hash_hmac( 'sha256', $ip, wp_salt( 'auth' ) );
	}

	/** Drop anything that looks like a secret. */
	private static function scrub( array $details ): array {
		foreach ( $details as $key => $value ) {
			if ( preg_match( '/pass|token|nonce|secret|key|code/i', (string) $key ) ) {
				unset( $details[ $key ] );
			} elseif ( is_array( $value ) ) {
				$details[ $key ] = self::scrub( $value );
			}
		}
		return $details;
	}
}
