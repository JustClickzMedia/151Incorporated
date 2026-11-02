<?php
namespace B151\Members;

/**
 * Pre-launch hardening from the readiness audit (WORDPRESS-AUDIT.md §13, ARCHITECTURE.md §13).
 * Each item can be switched off in settings if it ever gets in the way. Settings key => what it does:
 *
 *  - harden_xmlrpc        Turn off XML-RPC (a password-guessing path that skips the portal's throttling and 2FA).
 *  - harden_jwt_login     Remove Simple-JWT-Login's password → token endpoint (same reason). The Angular site
 *                         doesn't use it; it reads public content anonymously and members use the cookie session.
 *  - harden_private_types Take the `new-prospects` and `brothers` types out of the public REST API and GraphQL.
 *  - harden_enumeration   Stop ?author=N username discovery and the users list in wp-sitemap.xml.
 *  - harden_noindex       Keep the WordPress backend (tzin) out of search engines: no core sitemap, X-Robots-Tag.
 *                         The public site is brothersof1-5-1.org, which has its own sitemap.
 *  - harden_graphql       GraphQL depth limit 10 and no batched queries.
 */
final class Hardening {

	public const PRIVATE_TYPES = array( 'new-prospects', 'brothers' );
	public const JWT_PASSWORD_ROUTE = '/simple-jwt-login/v1/auth';

	public static function register(): void {
		if ( Settings::get( 'harden_xmlrpc' ) ) {
			add_filter( 'xmlrpc_enabled', '__return_false' );
			add_filter( 'xmlrpc_methods', static fn() => array() );
			add_filter( 'wp_headers', array( self::class, 'drop_pingback_header' ) );
		}
		if ( Settings::get( 'harden_jwt_login' ) ) {
			add_filter( 'rest_endpoints', array( self::class, 'drop_jwt_password_route' ), 99 );
		}
		if ( Settings::get( 'harden_private_types' ) ) {
			add_filter( 'register_post_type_args', array( self::class, 'private_type_args' ), 99, 2 );
		}
		if ( Settings::get( 'harden_enumeration' ) ) {
			add_action( 'template_redirect', array( self::class, 'block_author_scan' ), 1 );
			add_filter( 'wp_sitemaps_add_provider', array( self::class, 'drop_users_sitemap' ), 10, 2 );
		}
		if ( Settings::get( 'harden_noindex' ) ) {
			add_filter( 'wp_sitemaps_enabled', '__return_false' );
			add_action( 'send_headers', array( self::class, 'noindex_header' ) );
			add_filter( 'wp_robots', 'wp_robots_no_robots' );
		}
		if ( Settings::get( 'harden_graphql' ) ) {
			add_filter( 'graphql_query_depth_max', array( self::class, 'graphql_depth' ), 99 );
			add_filter( 'graphql_is_batch_queries_enabled', '__return_false', 99 );
		}
	}

	public static function drop_pingback_header( array $headers ): array {
		unset( $headers['X-Pingback'] );
		return $headers;
	}

	public static function drop_jwt_password_route( array $endpoints ): array {
		foreach ( array_keys( $endpoints ) as $route ) {
			if ( 0 === strpos( $route, self::JWT_PASSWORD_ROUTE ) ) {
				unset( $endpoints[ $route ] );
			}
		}
		return $endpoints;
	}

	public static function private_type_args( array $args, string $type ): array {
		if ( in_array( $type, self::PRIVATE_TYPES, true ) ) {
			$args['show_in_rest']       = false;
			$args['show_in_graphql']    = false;
			$args['publicly_queryable'] = false;
			$args['exclude_from_search'] = true;
		}
		return $args;
	}

	/** ?author=1 redirects to /author/<username>/, revealing logins. Answer 404 instead. */
	public static function block_author_scan(): void {
		if ( is_admin() || ! isset( $_GET['author'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			return;
		}
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
	}

	public static function drop_users_sitemap( $provider, string $name ) {
		return 'users' === $name ? false : $provider;
	}

	public static function noindex_header(): void {
		if ( ! headers_sent() ) {
			header( 'X-Robots-Tag: noindex, nofollow', true );
		}
	}

	public static function graphql_depth( $max ): int {
		$max = (int) $max;
		return ( $max > 0 && $max < 10 ) ? $max : 10;
	}
}
