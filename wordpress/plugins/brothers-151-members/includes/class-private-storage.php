<?php
namespace B151\Members;

use WP_Error;

/**
 * Files for member resources live in a folder OUTSIDE the web root (ARCHITECTURE.md §7), set in wp-config.php:
 *
 *     define( 'B151_PRIVATE_DIR', '/home1/<cpanel-user>/b151-private' );
 *
 * They are only ever delivered by the download endpoint after the access checks. A "hidden" Media Library URL is
 * never used. If the folder isn't configured (or sits inside the web root), uploads are refused.
 */
final class Private_Storage {

	/** Extension => MIME types accepted (allow-list). */
	public const ALLOWED = array(
		'pdf'  => array( 'application/pdf' ),
		'docx' => array( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip' ),
		'xlsx' => array( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip' ),
		'pptx' => array( 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip' ),
		'jpg'  => array( 'image/jpeg' ),
		'jpeg' => array( 'image/jpeg' ),
		'png'  => array( 'image/png' ),
		'mp3'  => array( 'audio/mpeg' ),
		'm4a'  => array( 'audio/mp4', 'audio/x-m4a', 'video/mp4' ),
		'mp4'  => array( 'video/mp4' ),
	);

	/** MIME type sent to the browser for each extension. */
	public const SEND_AS = array(
		'pdf'  => 'application/pdf',
		'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'png'  => 'image/png',
		'mp3'  => 'audio/mpeg',
		'm4a'  => 'audio/mp4',
		'mp4'  => 'video/mp4',
	);

	public static function register(): void {
		add_action( 'before_delete_post', array( self::class, 'delete_for_post' ) );
	}

	/** The configured folder, or a WP_Error explaining why files can't be stored. */
	public static function dir() {
		$dir = defined( 'B151_PRIVATE_DIR' ) ? (string) B151_PRIVATE_DIR : (string) apply_filters( 'b151_private_dir', '' );
		if ( '' === $dir ) {
			return new WP_Error( 'b151_storage_unconfigured', 'Private file storage is not set up (B151_PRIVATE_DIR in wp-config.php).' );
		}
		if ( ! is_dir( $dir ) && ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'b151_storage_missing', 'The private file folder does not exist and could not be created.' );
		}
		$real = realpath( $dir );
		$root = realpath( ABSPATH );
		if ( ! $real || ! is_writable( $real ) ) {
			return new WP_Error( 'b151_storage_unwritable', 'The private file folder is not writable.' );
		}
		if ( $root && 0 === strpos( trailingslashit( $real ), trailingslashit( $root ) ) ) {
			return new WP_Error( 'b151_storage_public', 'The private file folder must be outside the website folder.' );
		}
		// Defence in depth, in case the folder is ever moved under a web root.
		if ( ! file_exists( $real . '/.htaccess' ) ) {
			@file_put_contents( $real . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore
		}
		return $real;
	}

	public static function max_bytes(): int {
		return max( 1, (int) Settings::get( 'max_upload_mb' ) ) * MB_IN_BYTES;
	}

	/**
	 * Validate and move an uploaded file into private storage.
	 *
	 * @return array{stored:string,name:string,ext:string,mime:string,size:int,sha256:string}|WP_Error
	 */
	public static function store( string $tmp_path, string $original_name ) {
		$dir = self::dir();
		if ( is_wp_error( $dir ) ) {
			return $dir;
		}
		if ( ! is_file( $tmp_path ) ) {
			return new WP_Error( 'b151_upload_missing', 'The upload did not arrive.' );
		}
		$size = (int) filesize( $tmp_path );
		if ( $size <= 0 || $size > self::max_bytes() ) {
			return new WP_Error( 'b151_upload_size', sprintf( 'Files must be smaller than %d MB.', (int) Settings::get( 'max_upload_mb' ) ) );
		}
		$name = sanitize_file_name( wp_basename( $original_name ) );
		$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( ! isset( self::ALLOWED[ $ext ] ) ) {
			return new WP_Error( 'b151_upload_type', 'That file type is not allowed. Use PDF, Word, Excel, PowerPoint, JPG, PNG, MP3, M4A or MP4.' );
		}
		$finfo = function_exists( 'finfo_open' ) ? finfo_open( FILEINFO_MIME_TYPE ) : false;
		$mime  = $finfo ? (string) finfo_file( $finfo, $tmp_path ) : '';
		if ( ! in_array( $mime, self::ALLOWED[ $ext ], true ) ) {
			return new WP_Error( 'b151_upload_type', 'The file content does not match its type.' );
		}
		$stored = bin2hex( random_bytes( 16 ) ) . '.' . $ext;
		$target = $dir . '/' . $stored;
		$moved  = is_uploaded_file( $tmp_path ) ? @move_uploaded_file( $tmp_path, $target ) : @copy( $tmp_path, $target ); // phpcs:ignore
		if ( ! $moved ) {
			return new WP_Error( 'b151_upload_failed', 'The file could not be saved.' );
		}
		@chmod( $target, 0640 ); // phpcs:ignore
		return array(
			'stored' => $stored,
			'name'   => $name,
			'ext'    => $ext,
			'mime'   => self::SEND_AS[ $ext ],
			'size'   => $size,
			'sha256' => hash_file( 'sha256', $target ),
		);
	}

	/** Absolute path of a stored file, or null if it is missing or the name is not one of ours. */
	public static function path( string $stored ): ?string {
		if ( ! preg_match( '/^[a-f0-9]{32}\.[a-z0-9]{2,4}$/', $stored ) ) {
			return null;
		}
		$dir = self::dir();
		if ( is_wp_error( $dir ) ) {
			return null;
		}
		$path = realpath( $dir . '/' . $stored );
		return ( $path && 0 === strpos( $path, $dir . '/' ) && is_file( $path ) ) ? $path : null;
	}

	/** Attach a stored file to a resource post (replacing and deleting any previous one). */
	public static function attach( int $post_id, array $file ): void {
		$old = get_post_meta( $post_id, Content_Types::META_FILE, true );
		update_post_meta( $post_id, Content_Types::META_FILE, $file );
		if ( is_array( $old ) && ! empty( $old['stored'] ) && $old['stored'] !== $file['stored'] ) {
			self::remove( (string) $old['stored'] );
		}
		Audit_Log::record( 'resource_file_uploaded', 'post', $post_id, array( 'name' => $file['name'], 'size' => $file['size'] ) );
	}

	public static function remove( string $stored ): void {
		$path = self::path( $stored );
		if ( $path ) {
			@unlink( $path ); // phpcs:ignore
		}
	}

	public static function delete_for_post( $post_id ): void {
		if ( Content_Types::RESOURCE !== get_post_type( $post_id ) ) {
			return;
		}
		$file = get_post_meta( $post_id, Content_Types::META_FILE, true );
		if ( is_array( $file ) && ! empty( $file['stored'] ) ) {
			self::remove( (string) $file['stored'] );
		}
	}
}
