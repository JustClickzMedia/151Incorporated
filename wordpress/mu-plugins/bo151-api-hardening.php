<?php
/**
 * Plugin Name: 1-5-1 API Hardening
 * Description: Hides user records from anonymous REST/GraphQL requests and restricts CORS to approved origins.
 * Version: 1.0.0
 * Author: Brothers of 1-5-1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Origins allowed to call the API from a browser.
 */
function bo151_allowed_origins() {
	return array(
		'https://brothersof1-5-1.org',
		'https://www.brothersof1-5-1.org',
		'http://localhost:4200',
	);
}

function bo151_matching_origin() {
	$origin = get_http_origin();
	return ( $origin && in_array( $origin, bo151_allowed_origins(), true ) ) ? $origin : '';
}

/* ---------- 1. Hide users from anonymous visitors ---------- */

// REST: remove the users endpoints for logged-out requests.
add_filter(
	'rest_endpoints',
	function ( $endpoints ) {
		if ( is_user_logged_in() ) {
			return $endpoints;
		}
		foreach ( array_keys( $endpoints ) as $route ) {
			if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
				unset( $endpoints[ $route ] );
			}
		}
		return $endpoints;
	}
);

// GraphQL: treat every user object as private for logged-out requests.
add_filter(
	'graphql_data_is_private',
	function ( $is_private, $model_name ) {
		if ( 'UserObject' === $model_name && ! is_user_logged_in() ) {
			return true;
		}
		return $is_private;
	},
	10,
	2
);

/* ---------- 2. CORS allow-list ---------- */

// REST: replace core's "reflect any origin" behaviour with the allow-list.
add_action(
	'rest_api_init',
	function () {
		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
		add_filter(
			'rest_pre_serve_request',
			function ( $value ) {
				$origin = bo151_matching_origin();
				if ( $origin ) {
					header( 'Access-Control-Allow-Origin: ' . $origin );
					header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
					header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
				} else {
					header_remove( 'Access-Control-Allow-Origin' );
				}
				header( 'Vary: Origin', false );
				return $value;
			}
		);
	},
	15
);

// GraphQL: only send CORS headers for approved origins.
add_filter(
	'graphql_response_headers_to_send',
	function ( $headers ) {
		$origin = bo151_matching_origin();
		unset( $headers['Access-Control-Allow-Origin'], $headers['Access-Control-Allow-Credentials'] );
		if ( $origin ) {
			$headers['Access-Control-Allow-Origin']  = $origin;
			$headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
			$headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
		}
		$headers['Vary'] = 'Origin';
		return $headers;
	},
	99
);
