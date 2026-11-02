<?php
use B151\Members\Membership;
use B151\Members\Session_Api;
use B151\Members\Sessions;

class Test_Session_Api extends B151_TestCase {

	private const ORIGIN = 'https://brothersof1-5-1.org';

	public function set_up(): void {
		parent::set_up();
		reset_phpmailer_instance();
		do_action( 'rest_api_init' );
	}

	private function login( string $user, string $pass, ?string $origin = self::ORIGIN ): WP_REST_Response {
		return $this->rest( 'POST', '/b151/v1/session', array( 'username' => $user, 'password' => $pass ), $origin );
	}

	public function test_active_member_signs_in_with_portal_cookie_session() {
		$uid = $this->make_member( 'active', array( 'user_email' => 'bro@example.org' ) );
		$res = $this->login( 'bro@example.org', 'correct horse battery' );
		$this->assertSame( 201, $res->get_status() );
		$data = $res->get_data();
		$this->assertTrue( $data['authenticated'] );
		$this->assertSame( $uid, $data['member']['id'] );
		$this->assertFalse( $data['admin_session'] );
		$this->assertArrayNotHasKey( 'token', $data );
		$this->assertNotEmpty( $_COOKIE[ LOGGED_IN_COOKIE ] );

		$token = wp_get_session_token();
		$this->assertTrue( Sessions::is_portal_session( $uid, $token ) );
		$this->assertSame( 1, wp_verify_nonce( $data['nonce'], 'wp_rest' ), 'nonce is bound to the new session' );
		$this->assertStringNotContainsString( 'correct horse', wp_json_encode( $data ) );
	}

	public function test_wrong_password_and_ineligible_accounts_get_the_same_answer() {
		$this->make_member( 'active', array( 'user_login' => 'active1' ) );
		$this->make_member( 'pending', array( 'user_login' => 'pending1' ) );
		$this->make_member( 'suspended', array( 'user_login' => 'susp1' ) );

		$wrong   = $this->login( 'active1', 'nope nope nope' );
		$pending = $this->login( 'pending1', 'correct horse battery' );
		$susp    = $this->login( 'susp1', 'correct horse battery' );
		$unknown = $this->login( 'ghost', 'correct horse battery' );

		foreach ( array( $wrong, $pending, $susp, $unknown ) as $r ) {
			$this->assertSame( 401, $r->get_status() );
			$this->assertSame( Session_Api::GENERIC_LOGIN_ERROR, $r->as_error()->get_error_message() );
		}
		$this->assertSame( 0, get_current_user_id() );
	}

	public function test_foreign_origin_is_refused() {
		$this->make_member( 'active', array( 'user_login' => 'bro2' ) );
		$this->assertSame( 403, $this->login( 'bro2', 'correct horse battery', 'https://evil.example' )->get_status() );
		$this->assertSame( 403, $this->rest( 'GET', '/b151/v1/session', array(), 'https://evil.example' )->get_status() );
	}

	public function test_repeated_failures_are_throttled() {
		$this->make_member( 'active', array( 'user_login' => 'bro3' ) );
		for ( $i = 0; $i < 5; $i++ ) {
			$this->assertSame( 401, $this->login( 'bro3', 'wrong password!' )->get_status() );
		}
		$this->assertSame( 429, $this->login( 'bro3', 'correct horse battery' )->get_status(), 'locked even with the right password' );
	}

	public function test_two_factor_admin_is_sent_to_admin_sign_in() {
		$uid = $this->make_admin();
		$u   = get_userdata( $uid );
		add_filter( 'two_factor_enabled_providers_for_user', static fn( $p, $id ) => $id === $uid ? array( 'Two_Factor_Totp' ) : $p, 10, 2 );
		if ( ! defined( 'REST_REQUEST' ) ) {
			define( 'REST_REQUEST', true );
		}
		$res = $this->login( $u->user_login, 'admin password 123' );
		$this->assertSame( 403, $res->get_status() );
		$this->assertSame( 'b151_use_admin_sign_in', $res->as_error()->get_error_code() );
		$this->assertEmpty( $_COOKIE[ LOGGED_IN_COOKIE ] ?? '' );
	}

	public function test_get_session_reads_cookie_and_returns_nonce() {
		$this->assertFalse( $this->rest( 'GET', '/b151/v1/session' )->get_data()['authenticated'] );

		$uid = $this->make_member();
		$this->sign_in( $uid, true );
		wp_set_current_user( 0 ); // REST without nonce is a guest — the endpoint must read the cookie itself
		$data = $this->rest( 'GET', '/b151/v1/session', array(), self::ORIGIN )->get_data();
		$this->assertTrue( $data['authenticated'] );
		$this->assertSame( $uid, $data['member']['id'] );
		$this->assertSame( 1, wp_verify_nonce( $data['nonce'], 'wp_rest' ) );
		$this->assertGreaterThan( 25 * 60, $data['idle_seconds_remaining'] );
	}

	public function test_get_session_after_suspension_or_idle_is_anonymous() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		update_user_meta( $uid, Membership::META_STATUS, 'suspended' );
		$this->assertFalse( $this->rest( 'GET', '/b151/v1/session' )->get_data()['authenticated'] );
		$this->assertNull( WP_Session_Tokens::get_instance( $uid )->get( $token ) );

		$uid2   = $this->make_member();
		$token2 = $this->sign_in( $uid2, true );
		$this->age_session( $uid2, $token2, 31 * MINUTE_IN_SECONDS );
		$this->assertFalse( $this->rest( 'GET', '/b151/v1/session' )->get_data()['authenticated'] );
	}

	public function test_sign_out_destroys_the_session() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		$this->rest( 'DELETE', '/b151/v1/session', array(), self::ORIGIN );
		$this->assertNull( WP_Session_Tokens::get_instance( $uid )->get( $token ) );
		$this->assertSame( 0, get_current_user_id() );
	}

	public function test_password_reset_request_is_generic_and_links_to_member_area() {
		$res = $this->rest( 'POST', '/b151/v1/session/password-reset', array( 'email' => 'nobody@example.org' ) );
		$this->assertSame( 202, $res->get_status() );
		$this->assertFalse( tests_retrieve_phpmailer_instance()->get_sent() );

		$this->make_member( 'active', array( 'user_email' => 'reset@example.org' ) );
		$res2 = $this->rest( 'POST', '/b151/v1/session/password-reset', array( 'email' => 'reset@example.org' ) );
		$this->assertSame( 202, $res2->get_status() );
		$this->assertSame( $res->get_data(), $res2->get_data(), 'same answer whether or not the address exists' );
		$body = tests_retrieve_phpmailer_instance()->get_sent()->body;
		$this->assertStringContainsString( 'https://brothersof1-5-1.org/members/reset-password?login=', $body );
		$this->assertStringNotContainsString( 'wp-login.php', $body );
	}

	public function test_password_reset_not_sent_to_pending_accounts() {
		$this->make_member( 'pending', array( 'user_email' => 'pend@example.org' ) );
		$this->rest( 'POST', '/b151/v1/session/password-reset', array( 'email' => 'pend@example.org' ) );
		$this->assertFalse( tests_retrieve_phpmailer_instance()->get_sent() );
	}

	public function test_password_reset_confirm() {
		$uid  = $this->make_member( 'active', array( 'user_login' => 'resetme' ) );
		$this->sign_in( $uid, true );
		$user = get_userdata( $uid );
		$key  = get_password_reset_key( $user );

		$this->assertSame( 400, $this->rest( 'POST', '/b151/v1/session/password-reset/confirm', array( 'login' => 'resetme', 'key' => 'bad', 'password' => 'a brand new password' ) )->get_status() );
		$this->assertSame( 400, $this->rest( 'POST', '/b151/v1/session/password-reset/confirm', array( 'login' => 'resetme', 'key' => $key, 'password' => 'short' ) )->get_status() );
		$ok = $this->rest( 'POST', '/b151/v1/session/password-reset/confirm', array( 'login' => 'resetme', 'key' => $key, 'password' => 'a brand new password' ) );
		$this->assertSame( 200, $ok->get_status() );
		$this->assertCount( 0, WP_Session_Tokens::get_instance( $uid )->get_all(), 'all sessions ended' );
		$this->assertTrue( wp_check_password( 'a brand new password', get_userdata( $uid )->user_pass, $uid ) );
		// Key works once.
		$this->assertSame( 400, $this->rest( 'POST', '/b151/v1/session/password-reset/confirm', array( 'login' => 'resetme', 'key' => $key, 'password' => 'another new password' ) )->get_status() );
	}

	public function test_change_password_requires_current_password_and_rotates_session() {
		$uid = $this->make_member();
		$old = $this->sign_in( $uid, true );
		$this->sign_in( $uid, true ); // another device
		$token = $this->sign_in( $uid, true );

		$bad = $this->rest( 'POST', '/b151/v1/session/password', array( 'current_password' => 'wrong', 'new_password' => 'a brand new password' ), self::ORIGIN );
		$this->assertSame( 400, $bad->get_status() );

		$ok = $this->rest( 'POST', '/b151/v1/session/password', array( 'current_password' => 'correct horse battery', 'new_password' => 'a brand new password' ), self::ORIGIN );
		$this->assertSame( 200, $ok->get_status() );
		$sessions = WP_Session_Tokens::get_instance( $uid )->get_all();
		$this->assertCount( 1, $sessions, 'other devices signed out; this browser gets one fresh session' );
		$this->assertNull( WP_Session_Tokens::get_instance( $uid )->get( $old ) );
		$this->assertNull( WP_Session_Tokens::get_instance( $uid )->get( $token ) );
		$this->assertTrue( Sessions::is_portal_session( $uid, wp_get_session_token() ) );
	}

	public function test_change_password_requires_sign_in() {
		$this->assertSame( 401, $this->rest( 'POST', '/b151/v1/session/password', array( 'current_password' => 'x', 'new_password' => 'a brand new password' ) )->get_status() );
	}

	public function test_b151_rest_responses_are_not_cacheable() {
		$req = new WP_REST_Request( 'GET', '/b151/v1/session' );
		$res = rest_get_server()->dispatch( $req );
		$res = apply_filters( 'rest_post_dispatch', $res, rest_get_server(), $req );
		$this->assertSame( 'no-store, private, max-age=0', $res->get_headers()['Cache-Control'] );
	}
}
