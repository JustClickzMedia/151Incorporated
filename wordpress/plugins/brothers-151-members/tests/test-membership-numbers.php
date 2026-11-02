<?php
use B151\Members\Admin;
use B151\Members\Membership;
use B151\Members\Roles;

/** Existing brothers keep their numbers; admins can set or correct them. */
class Test_Membership_Numbers extends B151_TestCase {

	public function test_normalize_accepts_common_ways_of_typing_a_number() {
		foreach ( array( '42', '0042', '00042', '151-42', '151-00042', '151 00042', ' 151-00042 ', '15100042' ) as $in ) {
			$this->assertSame( '151-00042', Membership::normalize_number( $in ), $in );
		}
		$this->assertSame( '151-99999', Membership::normalize_number( '99999' ) );
		foreach ( array( '', '0', '151-0', 'abc', '100000', '151-100000', '42a', '-42' ) as $bad ) {
			$this->assertNull( Membership::normalize_number( $bad ), $bad );
		}
	}

	public function test_approve_with_existing_number() {
		$uid = $this->make_member( 'pending' );
		$this->assertTrue( Membership::approve( $uid, 'life_member', 1, '17' ) );
		$this->assertSame( '151-00017', Membership::get_number( $uid ) );
		$this->assertSame( 'active', Membership::get_status( $uid ) );
	}

	public function test_auto_numbers_continue_after_imported_ones() {
		$a = $this->make_member( 'pending' );
		$b = $this->make_member( 'pending' );
		Membership::approve( $a, 'member', 1, '130' );
		Membership::approve( $b );
		$this->assertSame( '151-00131', Membership::get_number( $b ) );
	}

	public function test_override_an_auto_number_and_free_it() {
		$test = $this->make_member( 'pending' );
		Membership::approve( $test );                       // gets 151-00001 by mistake
		$this->assertSame( '151-00001', Membership::get_number( $test ) );
		$this->assertTrue( Membership::set_number( $test, '151-00250' ) );
		$this->assertSame( '151-00250', Membership::get_number( $test ) );
		$this->assertSame( 0, Membership::find_by_number( '151-00001' ), 'old number released' );
		$this->assertSame( $test, Membership::find_by_number( '250' ) );

		$real = $this->make_member( 'pending' );            // the brother who really is #1
		$this->assertTrue( Membership::approve( $real, 'member', 1, '1' ) );
		$this->assertSame( '151-00001', Membership::get_number( $real ) );
		$this->assertSame( 'membership_number_changed', \B151\Members\Audit_Log::recent( 50, array( 'action' => 'membership_number_changed' ) )[0]->action );
	}

	public function test_numbers_cannot_be_shared() {
		$a = $this->make_member( 'pending' );
		$b = $this->make_member( 'pending', array( 'display_name' => 'Brother A' ) );
		Membership::approve( $b, 'member', 1, '5' );
		$err = Membership::set_number( $a, '5' );
		$this->assertWPError( $err );
		$this->assertStringContainsString( 'Brother A', $err->get_error_message() );
		$this->assertWPError( Membership::approve( $a, 'member', 1, '151-00005' ) );
		$this->assertSame( 'pending', Membership::get_status( $a ), 'failed approval changes nothing' );
		$this->assertWPError( Membership::set_number( $a, 'abc' ) );
		$this->assertTrue( Membership::set_number( $b, '151-00005' ), 'setting the same number again is fine' );
	}

	public function test_verify_member_accepts_loose_input() {
		$uid = $this->make_member( 'pending' );
		Membership::approve( $uid, 'member', 1, '42' );
		$this->assertSame( $uid, Membership::find_by_number( '42' ) );
		$this->assertSame( $uid, Membership::find_by_number( '151-00042' ) );
	}

	public function test_graphql_set_number_needs_membership_admin_session() {
		$uid = $this->make_member();
		$m   = 'mutation($id:Int!){ setMembershipNumber(input:{userId:$id, membershipNumber:"77"}) { member { membershipNumber } } }';

		$this->sign_in( $this->make_member(), true );
		$this->assertStringContainsString( 'permission', wp_json_encode( $this->gql( $m, array( 'id' => $uid ) )['errors'] ) );

		$ca = $this->make_admin( Roles::ROLE_CONTENT_ADMIN );
		$this->sign_in( $ca );
		$this->assertArrayHasKey( 'errors', $this->gql( $m, array( 'id' => $uid ) ) );

		$this->sign_in( $this->make_admin( Roles::ROLE_MEMBERSHIP_ADMIN ) );
		$r = $this->gql( $m, array( 'id' => $uid ) );
		$this->assertSame( '151-00077', $r['data']['setMembershipNumber']['member']['membershipNumber'] );
	}

	public function test_graphql_approve_with_number() {
		$uid = $this->make_member( 'pending' );
		$this->sign_in( $this->make_admin( Roles::ROLE_MEMBERSHIP_ADMIN ) );
		$r = $this->gql( 'mutation($id:Int!){ approveMember(input:{userId:$id, membershipNumber:"151-00009"}) { member { membershipNumber status } } }', array( 'id' => $uid ) );
		$this->assertSame( '151-00009', $r['data']['approveMember']['member']['membershipNumber'] );
	}

	public function test_profile_screen_validates_and_saves_number() {
		$taken = $this->make_member( 'pending', array( 'display_name' => 'Taken Brother' ) );
		Membership::approve( $taken, 'member', 1, '3' );
		$uid   = $this->make_member();
		$admin = $this->make_admin();
		$this->sign_in( $admin );

		$_POST = array( 'b151_member_box_nonce' => wp_create_nonce( 'b151_member_box' ), 'b151_number' => '3' );
		$errors = new WP_Error();
		Admin::validate_profile_box( $errors, true, get_userdata( $uid ) );
		$this->assertStringContainsString( 'Taken Brother', $errors->get_error_message() );

		$_POST['b151_number'] = 'nope';
		$errors = new WP_Error();
		Admin::validate_profile_box( $errors, true, get_userdata( $uid ) );
		$this->assertSame( 'b151_bad_number', $errors->get_error_code() );

		$_POST['b151_number'] = '88';
		$errors = new WP_Error();
		Admin::validate_profile_box( $errors, true, get_userdata( $uid ) );
		$this->assertFalse( $errors->has_errors() );
		Admin::save_profile_box( $uid );
		$this->assertSame( '151-00088', Membership::get_number( $uid ) );
		$_POST = array();
	}
}
