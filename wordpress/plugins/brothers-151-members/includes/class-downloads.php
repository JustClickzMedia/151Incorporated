<?php
namespace B151\Members;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * GET /wp-json/b151/v1/resources/{id}/download?_wpnonce=<nonce>
 *
 * Cookie session + WordPress REST nonce (core checks `_wpnonce`, so it also works for links and <audio src>).
 * Re-checks every access rule, logs the download, and streams the file with Range support (audio/video seeking).
 */
final class Downloads {

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'routes' ) );
	}

	public static function routes(): void {
		register_rest_route(
			Session_Api::NS,
			'/resources/(?P<id>\d+)/download',
			array(
				'methods'             => 'GET',
				'callback'            => array( self::class, 'download' ),
				'permission_callback' => array( self::class, 'permission' ),
				'args'                => array( 'id' => array( 'type' => 'integer', 'required' => true ) ),
			)
		);
	}

	public static function url( int $post_id ): string {
		return add_query_arg( '_wpnonce', wp_create_nonce( 'wp_rest' ), rest_url( Session_Api::NS . '/resources/' . $post_id . '/download' ) );
	}

	public static function permission( WP_REST_Request $request ) {
		$o = Session_Api::origin_permission( $request );
		if ( true !== $o ) {
			return $o;
		}
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'b151_not_signed_in', 'Please sign in.', array( 'status' => 401 ) );
		}
		// Same answer for "doesn't exist" and "not yours to see".
		if ( ! Member_Content::get( (int) $request['id'], Content_Types::RESOURCE ) ) {
			return new WP_Error( 'b151_not_found', 'Not found.', array( 'status' => 404 ) );
		}
		return true;
	}

	/**
	 * Parse an HTTP Range header for a file of $size bytes.
	 *
	 * @return array{0:int,1:int}|null|false [start, end] inclusive; null = whole file; false = unsatisfiable (416)
	 */
	public static function parse_range( ?string $header, int $size ) {
		if ( null === $header || '' === $header ) {
			return null;
		}
		if ( ! preg_match( '/^bytes=(\d*)-(\d*)$/', trim( $header ), $m ) || ( '' === $m[1] && '' === $m[2] ) ) {
			return null; // ignore malformed / multi-range requests and send the whole file
		}
		if ( '' === $m[1] ) { // suffix: last N bytes
			$n = (int) $m[2];
			if ( 0 === $n ) {
				return false;
			}
			return array( max( 0, $size - $n ), $size - 1 );
		}
		$start = (int) $m[1];
		$end   = '' === $m[2] ? $size - 1 : min( (int) $m[2], $size - 1 );
		if ( $start >= $size || $start > $end ) {
			return false;
		}
		return array( $start, $end );
	}

	/** Content-Disposition with a safe ASCII fallback and the UTF-8 name. */
	public static function disposition( string $name, bool $inline ): string {
		$ascii = preg_replace( '/[^A-Za-z0-9._ -]/', '_', $name );
		return ( $inline ? 'inline' : 'attachment' ) . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode( $name );
	}

	public static function download( WP_REST_Request $request ) {
		$post = Member_Content::get( (int) $request['id'], Content_Types::RESOURCE );
		$file = $post ? get_post_meta( $post->ID, Content_Types::META_FILE, true ) : null;
		$path = is_array( $file ) && ! empty( $file['stored'] ) ? Private_Storage::path( (string) $file['stored'] ) : null;
		if ( ! $post || ! $path ) {
			return new WP_Error( 'b151_not_found', 'Not found.', array( 'status' => 404 ) );
		}
		$size  = (int) filesize( $path );
		$range = self::parse_range( $request->get_header( 'range' ), $size );
		if ( false === $range ) {
			$r = new WP_REST_Response( null, 416 );
			$r->header( 'Content-Range', 'bytes */' . $size );
			return $r;
		}
		list( $start, $end ) = $range ?? array( 0, $size - 1 );

		// Log only the first request of a download (not every seek of an audio player).
		if ( 0 === $start ) {
			Audit_Log::record( 'resource_downloaded', 'post', $post->ID );
		}
		$inline  = in_array( $file['ext'], array( 'pdf', 'jpg', 'jpeg', 'png', 'mp3', 'm4a', 'mp4' ), true );
		$headers = array(
			'Content-Type'           => $file['mime'],
			'Content-Length'         => (string) ( $end - $start + 1 ),
			'Content-Disposition'    => self::disposition( (string) $file['name'], $inline ),
			'Accept-Ranges'          => 'bytes',
			'X-Content-Type-Options' => 'nosniff',
			'Cache-Control'          => Cache_Headers::NO_STORE,
			'Content-Security-Policy' => "default-src 'none'; sandbox",
		);
		$status = null === $range ? 200 : 206;
		if ( 206 === $status ) {
			$headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
		}

		/** Tests turn streaming off and inspect the plan instead. */
		if ( ! apply_filters( 'b151_stream_downloads', true ) ) {
			$r = new WP_REST_Response( array( 'path' => $path, 'start' => $start, 'end' => $end ), $status );
			foreach ( $headers as $k => $v ) {
				$r->header( $k, $v );
			}
			return $r;
		}

		self::stream( $path, $start, $end, $status, $headers );
		exit;
	}

	private static function stream( string $path, int $start, int $end, int $status, array $headers ): void {
		while ( ob_get_level() ) {
			ob_end_clean();
		}
		status_header( $status );
		foreach ( $headers as $k => $v ) {
			header( $k . ': ' . $v );
		}
		$fh = fopen( $path, 'rb' ); // phpcs:ignore
		if ( ! $fh ) {
			return;
		}
		fseek( $fh, $start );
		$left = $end - $start + 1;
		while ( $left > 0 && ! feof( $fh ) && ! connection_aborted() ) {
			$chunk = fread( $fh, (int) min( 8192, $left ) ); // phpcs:ignore
			echo $chunk; // phpcs:ignore WordPress.Security.EscapeOutput
			$left -= strlen( $chunk );
			flush();
		}
		fclose( $fh ); // phpcs:ignore
	}
}
