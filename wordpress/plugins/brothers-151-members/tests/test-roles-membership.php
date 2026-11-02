<?php
use B151\Members\Access;
use B151\Members\Audit_Log;
use B151\Members\Membership;
use B151\Members\Roles;

class Test_Roles_Membership extends B151_TestCase {

	public function test_member_role_has_member_caps_only() {
		$uid = $this->make_member();
		$this->assertTrue( user_can( $uid, Roles::VIEW_MEMBER_CONTENT ) );
		$this->assertFalse( user_can( $uid, Roles::BACKEND_ACCESS ) );
		$this->assertFalse( user_can( $uid, 'edit_posts' ) );
		$this->assertFalse( user_can( $uid, Roles::MANAGE_MEMBERS ) );
	}

	public function test_admin_tiers_are_separated() {
		$ma = self::factory()->user->create( array( 'role' => Roles::ROLE_MEMBERSHIP_ADMIN ) );
		$ca = self::factory()->user->create( array( 'role' => Roles::ROLE_CONTENT_ADMIN ) );
		$pa = self::factory()->user->create( array( 'role' => Roles::ROLE_PORTAL_ADMIN ) );

		$this->assertTrue( user_can( $ma, Roles::APPROVE_MEMBERS ) );
		$this->assertFalse( user_can( $ma, 'edit_posts' ) );
		$this->assertFalse( user_can( $ma, 'manage_options' ) );
		$this->assertFalse( user_can( $ma, Roles::ASSIGN_BACKEND_ROLES ) );

		$this->assertTrue( user_can( $ca, 'edit_posts' ) );
		$this->assertFalse( user_can( $ca, Roles::MANAGE_MEMBERS ) );
		$this->assertFalse( user_can( $ca, 'manage_options' ) );

		$this->assertTrue( user_can( $pa, Roles::APPROVE_MEMBERS ) && user_can( $pa, 'edit_posts' ) );
		$this->assertFalse( user_can( $pa, 'manage_options' ) );
		$this->assertFalse( user_can( $pa, Roles::MANAGE_SETTINGS ) );
	}

	public function test_administrator_has_every_plugin_cap() {
		$uid = self::factory()->user->create( array( 'role' => 'administrator' ) );
		foreach ( Roles::all_plugin_caps() as $cap ) {
			$this->assertTrue( user_can( $uid, $cap ), $cap );
		}
	}

	public function test_new_accounts_are_pending_and_cannot_sign_in() {
		$uid = $this->make_member( 'pending' );
		$this->assertSame( 'pending', Membership::get_status( $uid ) );
		$this->assertFalse( Access::can_sign_in( $uid ) );
	}

	public function test_inactive_and_suspended_cannot_sign_in() {
		$this->assertFalse( Access::can_sign_in( $this->make_member( 'inactive' ) ) );
		$this->assertFalse( Access::can_sign_in( $this->make_member( 'suspended' ) ) );
		$this->assertTrue( Access::can_sign_in( $this->make_member( 'active' ) ) );
	}

	public function test_approval_assigns_sequential_numbers() {
		$a = $this->make_member( 'pending' );
		$b = $this->make_member( 'pending' );
		$this->assertTrue( Membership::approve( $a, 'member', 1 ) );
		$this->assertTrue( Membership::approve( $b, 'life_member', 1 ) );
		$this->assertSame( '151-00001', Membership::get_number( $a ) );
		$this->assertSame( '151-00002', Membership::get_number( $b ) );
		$this->assertSame( 'active', Membership::get_status( $a ) );
		$this->assertSame( 'life_member', Membership::get_classification( $b ) );
		$this->assertSame( $b, Membership::find_by_number( '151-00002' ) );
	}

	public function test_numbers_are_never_reused_or_duplicated() {
		$a = $this->make_member( 'pending' );
		$b = $this->make_member( 'pending' );
		$this->assertTrue( Membership::import_number( $a, '151-00042' ) );
		$this->assertWPError( Membership::import_number( $b, '151-00042' ) );
		$this->assertWPError( Membership::import_number( $b, '42' ) );
		$this->assertWPError( Membership::import_number( $a, '151-00043' ), 'a member keeps one number' );
		Membership::approve( $b );
		$this->assertSame( '151-00043', Membership::get_number( $b ) );
	}

	public function test_approve_rejects_non_pending_and_bad_classification() {
		$this->assertWPError( Membership::approve( $this->make_member( 'active' ) ) );
		$this->assertWPError( Membership::approve( $this->make_member( 'pending' ), 'king' ) );
	}

	public function test_leaving_active_ends_all_sessions() {
		$uid = $this->make_member();
		$this->sign_in( $uid );
		$this->sign_in( $uid );
		$this->assertCount( 2, WP_Session_Tokens::get_instance( $uid )->get_all() );
		Membership::set_status( $uid, 'suspended', 'test' );
		$this->assertCount( 0, WP_Session_Tokens::get_instance( $uid )->get_all() );
	}

	public function test_profile_update_uses_allow_list() {
		$uid = $this->make_member();
		$this->assertWPError( Membership::update_profile( $uid, array( 'status' => 'active' ) ) );
		$this->assertWPError( Membership::update_profile( $uid, array( 'membership_number' => '151-99999' ) ) );
		$this->assertWPError( Membership::update_profile( $uid, array( 'joined_year' => 'abc' ) ) );
		$this->assertTrue( Membership::update_profile( $uid, array( 'phone' => '555-0100', 'bio' => '<script>x</script>Hello' ) ) );
		$this->assertSame( '555-0100', Membership::get_profile_value( $uid, 'phone' ) );
		$this->assertStringNotContainsString( '<script>', Membership::get_profile_value( $uid, 'bio' ) );
	}

	public function test_visibility_defaults_to_admins_only() {
		$uid = $this->make_member();
		foreach ( Membership::get_visibility( $uid ) as $audience ) {
			$this->assertSame( 'admins', $audience );
		}
		$this->assertWPError( Membership::set_visibility( $uid, array( 'status' => 'members' ) ) );
	}

	public function test_audit_log_never_stores_secrets() {
		Audit_Log::record( 'x', 'user', 1, array( 'password' => 'p', 'token' => 't', 'ok' => 'fine', 'nested' => array( 'secret' => 's' ) ), 0 );
		$row = Audit_Log::recent( 1 )[0];
		$this->assertStringNotContainsString( '"p"', $row->details );
		$this->assertStringNotContainsString( 'token', $row->details );
		$this->assertStringNotContainsString( 'secret', $row->details );
		$this->assertStringContainsString( 'fine', $row->details );
		$this->assertStringNotContainsString( '203.0.113.7', $row->ip_hash );
	}
}
