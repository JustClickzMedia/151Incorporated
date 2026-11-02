<?php
use B151\Members\Access;
use B151\Members\Backend_Gate;
use B151\Members\Cache_Headers;
use B151\Members\Cors;
use B151\Members\Roles;
use B151\Members\Sessions;
use B151\Members\Two_Factor_Enforcement;

class Test_Sessions_Gate extends B151_TestCase {

	public function test_member_idle_limit_30_minutes() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		$this->age_session( $uid, $token, 29 * MINUTE_IN_SECONDS );
		$this->assertTrue( Sessions::validate( $uid, $token ) );

		$this->age_session( $uid, $token, 31 * MINUTE_IN_SECONDS );
		$this->assertFalse( Sessions::validate( $uid, $token ) );
		$this->assertNull( WP_Session_Tokens::get_instance( $uid )->get( $token ), 'expired session is destroyed' );
	}

	public function test_backend_idle_limit_15_minutes() {
		$uid   = $this->make_admin();
		$token = $this->sign_in( $uid );
		$this->age_session( $uid, $token, 16 * MINUTE_IN_SECONDS );
		$this->assertFalse( Sessions::validate( $uid, $token ) );
	}

	public function test_absolute_limit_12_hours() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		$this->age_session( $uid, $token, 60, 13 * HOUR_IN_SECONDS );
		$this->assertFalse( Sessions::validate( $uid, $token ) );
		$this->assertSame( 12 * HOUR_IN_SECONDS, Sessions::cookie_expiration() );
	}

	public function test_current_user_dropped_when_idle() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		$this->age_session( $uid, $token, 45 * MINUTE_IN_SECONDS );
		$this->assertSame( 0, Sessions::filter_current_user( $uid ) );
	}

	public function test_passive_requests_do_not_extend_session() {
		$uid   = $this->make_member();
		$token = $this->sign_in( $uid, true );
		$this->age_session( $uid, $token, 10 * MINUTE_IN_SECONDS );
		$_SERVER['HTTP_X_B151_ACTIVITY'] = 'passive';
		$this->assertSame( $uid, Sessions::filter_current_user( $uid ) );
		$s = WP_Session_Tokens::get_instance( $uid )->get( $token );
		$this->assertLessThanOrEqual( time() - 10 * MINUTE_IN_SECONDS + 1, $s[ Sessions::KEY_LAST_ACTIVITY ] );

		unset( $_SERVER['HTTP_X_B151_ACTIVITY'] );
		Sessions::reset_cache();
		Sessions::filter_current_user( $uid );
		$s = WP_Session_Tokens::get_instance( $uid )->get( $token );
		$this->assertGreaterThanOrEqual( time() - 2, $s[ Sessions::KEY_LAST_ACTIVITY ] );
	}

	public function test_portal_sessions_are_never_elevated() {
		$uid   = $this->make_admin();
		$token = $this->sign_in( $uid, true );
		$this->assertTrue( Sessions::is_portal_session( $uid, $token ) );
		$this->assertFalse( Sessions::is_elevated( $uid, $token ) );
		$this->assertFalse( Access::current_can( Roles::APPROVE_MEMBERS ) );
	}

	public function test_admin_session_elevated_only_with_two_factor() {
		$with = $this->make_admin( 'administrator', true );
		$this->sign_in( $with );
		$this->assertTrue( Access::current_can( Roles::APPROVE_MEMBERS ) );

		$without = $this->make_admin( 'administrator', false );
		$this->sign_in( $without );
		$this->assertTrue( Two_Factor_Enforcement::needs_enrolment( $without ) );
		$this->assertFalse( Access::current_can( Roles::APPROVE_MEMBERS ) );
	}

	public function test_suspended_admin_loses_admin_power() {
		$uid = $this->make_admin();
		update_user_meta( $uid, 'b151_status', 'suspended' );
		$this->sign_in( $uid );
		$this->assertFalse( Access::current_can( Roles::APPROVE_MEMBERS ) );
		$this->assertFalse( Access::can_sign_in( $uid ) );
	}

	public function test_members_are_kept_out_of_wp_admin() {
		$uid = $this->make_member();
		$this->sign_in( $uid, true );
		$this->assertSame( 'https://brothersof1-5-1.org/members', Backend_Gate::admin_redirect_for( $uid, 'index.php' ) );
		$this->assertSame( 'https://brothersof1-5-1.org/members', Backend_Gate::admin_redirect_for( $uid, 'profile.php' ) );
		$this->assertNull( Backend_Gate::admin_redirect_for( $uid, 'admin-ajax.php' ) );
		$this->assertFalse( Backend_Gate::show_admin_bar( true ) );
	}

	public function test_admin_with_portal_session_must_reauthenticate_for_wp_admin() {
		$uid = $this->make_admin();
		$this->sign_in( $uid, true );
		$to = Backend_Gate::admin_redirect_for( $uid, 'index.php' );
		$this->assertStringContainsString( 'wp-login.php', $to );
		$this->assertStringContainsString( 'reauth=1', $to );

		$this->sign_in( $uid );
		$this->assertNull( Backend_Gate::admin_redirect_for( $uid, 'index.php' ) );
	}

	public function test_backend_roles_hidden_from_non_administrators() {
		$ma = self::factory()->user->create( array( 'role' => Roles::ROLE_MEMBERSHIP_ADMIN ) );
		wp_set_current_user( $ma );
		$roles = Backend_Gate::editable_roles( get_editable_roles() + array( 'administrator' => array(), Roles::ROLE_PORTAL_ADMIN => array(), Roles::ROLE_MEMBER => array() ) );
		$this->assertArrayNotHasKey( 'administrator', $roles );
		$this->assertArrayNotHasKey( Roles::ROLE_PORTAL_ADMIN, $roles );
		$this->assertArrayHasKey( Roles::ROLE_MEMBER, $roles );
	}

	public function test_two_factor_enrolment_redirect() {
		$admin = $this->make_admin( 'administrator', false );
		$this->assertStringContainsString( 'profile.php', Two_Factor_Enforcement::enrolment_redirect( $admin, 'index.php' ) );
		$this->assertNull( Two_Factor_Enforcement::enrolment_redirect( $admin, 'profile.php' ) );
		$this->enable_two_factor( $admin );
		$this->assertNull( Two_Factor_Enforcement::enrolment_redirect( $admin, 'index.php' ) );
		$this->assertNull( Two_Factor_Enforcement::enrolment_redirect( $this->make_member(), 'index.php' ) );
	}

	public function test_cors_only_for_configured_origins() {
		$ok = Cors::headers_for_origin( 'https://brothersof1-5-1.org' );
		$this->assertSame( 'https://brothersof1-5-1.org', $ok['Access-Control-Allow-Origin'] );
		$this->assertSame( 'true', $ok['Access-Control-Allow-Credentials'] );
		$this->assertStringContainsString( 'X-WP-Nonce', $ok['Access-Control-Allow-Headers'] );

		foreach ( array( 'https://evil.example', 'https://brothersof1-5-1.org.evil.example', 'null', 'http://brothersof1-5-1.org' ) as $bad ) {
			$h = Cors::headers_for_origin( $bad );
			$this->assertArrayNotHasKey( 'Access-Control-Allow-Origin', $h, $bad );
			$this->assertNull( $h['Access-Control-Allow-Credentials'], $bad );
		}
	}

	public function test_graphql_headers_strip_credentials_for_foreign_origin() {
		$_SERVER['HTTP_ORIGIN'] = 'https://evil.example';
		$h = Cors::graphql_headers( array( 'Access-Control-Allow-Credentials' => 'true' ) );
		$this->assertArrayNotHasKey( 'Access-Control-Allow-Credentials', $h );

		$_SERVER['HTTP_ORIGIN'] = 'https://www.brothersof1-5-1.org';
		$h = Cors::graphql_headers( array() );
		$this->assertSame( 'https://www.brothersof1-5-1.org', $h['Access-Control-Allow-Origin'] );
	}

	public function test_localhost_origin_only_outside_production() {
		$this->assertTrue( Cors::origin_allowed( 'http://localhost:4200' ) ); // tests run as "local"
	}

	public function test_signed_in_graphql_responses_are_not_cacheable() {
		$this->assertArrayNotHasKey( 'Cache-Control', Cache_Headers::graphql_headers( array() ) );
		$this->sign_in( $this->make_member(), true );
		$h = Cache_Headers::graphql_headers( array( 'Cache-Control' => 'max-age=86400' ) );
		$this->assertSame( Cache_Headers::NO_STORE, $h['Cache-Control'] );
		$this->assertStringContainsString( 'Cookie', $h['Vary'] );
	}
}
