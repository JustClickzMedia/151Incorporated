<?php
namespace B151\Members;

/**
 * Simple fixed-window counters in transients. Keys are hashed so no e-mail address or IP is stored in clear.
 */
final class Rate_Limiter {

	private static function key( string $bucket, string $subject ): string {
		return 'b151_rl_' . substr( hash_hmac( 'sha256', $bucket . '|' . strtolower( $subject ), wp_salt( 'nonce' ) ), 0, 32 );
	}

	public static function count( string $bucket, string $subject ): int {
		$data = get_transient( self::key( $bucket, $subject ) );
		return is_array( $data ) ? (int) $data['n'] : 0;
	}

	public static function hit( string $bucket, string $subject, int $window_seconds ): int {
		$key  = self::key( $bucket, $subject );
		$data = get_transient( $key );
		$data = is_array( $data ) ? $data : array( 'n' => 0, 'since' => time() );
		++$data['n'];
		$ttl = max( 1, $window_seconds - ( time() - (int) $data['since'] ) );
		set_transient( $key, $data, $ttl );
		return (int) $data['n'];
	}

	public static function exceeded( string $bucket, string $subject, int $max ): bool {
		return self::count( $bucket, $subject ) >= $max;
	}

	public static function reset( string $bucket, string $subject ): void {
		delete_transient( self::key( $bucket, $subject ) );
	}

	public static function client_ip(): string {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : ''; // phpcs:ignore
	}
}
