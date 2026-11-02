<?php
use B151\Members\Graphql;
use B151\Members\Membership;
use B151\Members\Roles;

class Test_Graphql extends B151_TestCase {

	private const ME = 'query { currentMember { id displayName email membershipNumber status } }';

	private function errors( array $r ): string {
		return wp_json_encode( $r['errors'] ?? array() );
	}

	public function test_guest_and_pending_get_no_member() {
		$r = $this->gql( self::ME );
		$this->assertNull( $r['data']['currentMember'] );

		$this->sign_in( $this->make_member( 'pending' ), true );
		$this->assertNull( $this->gql( self::ME )['data']['currentMember'] );
	}

	public function test_active_member_sees_own_record() {
		$uid = $this->make_member( 'active', array( 'user_email' => 'me@example.org' ) );
		update_user_meta( $uid, Membership::META_NUMBER, '151-00007' );
		$this->sign_in( $uid, true );
		$m = $this->gql( self::ME )['data']['currentMember'];
		$this->assertSame( $uid, $m['id'] );
		$this->assertSame( 'me@example.org', $m['email'] );
		$this->assertSame( '151-00007', $m['membershipNumber'] );
		$this->assertSame( 'ACTIVE', $m['status'] );
	}

	public function test_directory_visibility_rules() {
		$other = $this->make_member( 'active' );
		update_user_meta( $other, 'b151_phone', '555-0101' );
		update_user_meta( $other, 'b151_joined_year', '1990' );
		$viewer = $this->make_member();
		$this->sign_in( $viewer, true );

		$this->assertTrue( Graphql::can_view( $other, 'displayName' ) );
		$this->assertTrue( Graphql::can_view( $other, 'joinedYear' ) );
		$this->assertTrue( Graphql::can_view( $other, 'isActive' ) );
		$this->assertFalse( Graphql::can_view( $other, 'phone' ), 'contact details are admins-only by default' );
		$this->assertFalse( Graphql::can_view( $other, 'email' ) );
		$this->assertFalse( Graphql::can_view( $other, 'status' ) );
		$this->assertFalse( Graphql::can_view( $other, 'membershipNumber' ) );

		Membership::set_visibility( $other, array( 'phone' => 'members' ) );
		$this->assertTrue( Graphql::can_view( $other, 'phone' ), 'visible after opting in' );
		$this->assertFalse( Graphql::can_view( $other, 'email' ) );

		update_user_meta( $other, Membership::META_STATUS, 'inactive' );
		$this->assertFalse( Graphql::can_view( $other, 'displayName' ), 'inactive brothers are not listed' );
	}

	public function test_suspended_viewer_sees_nothing() {
		$other  = $this->make_member( 'active' );
		$viewer = $this->make_member( 'suspended' );
		$this->sign_in( $viewer, true );
		$this->assertFalse( Graphql::can_view( $other, 'displayName' ) );
		$this->assertFalse( Graphql::can_view( $viewer, 'displayName' ) );
	}

	public function test_pending_members_requires_elevated_admin() {
		$this->make_member( 'pending', array( 'display_name' => 'Waiting Brother' ) );
		$q = 'query { pendingMembers { id displayName } }';

		$this->sign_in( $this->make_member(), true );
		$this->assertStringContainsString( 'permission', $this->errors( $this->gql( $q ) ) );

		$admin = $this->make_admin();
		$this->sign_in( $admin, true ); // member-area session: not enough
		$this->assertStringContainsString( 'permission', $this->errors( $this->gql( $q ) ) );

		$this->sign_in( $admin ); // wp-login session with two-step sign-in
		$r = $this->gql( $q );
		$this->assertArrayNotHasKey( 'errors', $r );
		$this->assertContains( 'Waiting Brother', wp_list_pluck( $r['data']['pendingMembers'], 'displayName' ) );
		$this->assertNotContains( $admin, wp_list_pluck( $r['data']['pendingMembers'], 'id' ) );
	}

	public function test_approve_member() {
		$pending = $this->make_member( 'pending' );
		$m       = 'mutation($id:Int!){ approveMember(input:{userId:$id, classification:HONORARY}) { member { status classification membershipNumber } } }';

		$this->sign_in( $this->make_member(), true );
		$this->assertStringContainsString( 'permission', $this->errors( $this->gql( $m, array( 'id' => $pending ) ) ) );
		$this->assertSame( 'pending', Membership::get_status( $pending ) );

		$ma = $this->make_admin( Roles::ROLE_MEMBERSHIP_ADMIN );
		$this->sign_in( $ma );
		$r = $this->gql( $m, array( 'id' => $pending ) );
		$this->assertArrayNotHasKey( 'errors', $r, $this->errors( $r ) );
		$this->assertSame( 'ACTIVE', $r['data']['approveMember']['member']['status'] );
		$this->assertSame( 'HONORARY', $r['data']['approveMember']['member']['classification'] );
		$this->assertMatchesRegularExpression( '/^151-\d{5}$/', $r['data']['approveMember']['member']['membershipNumber'] );
	}

	public function test_status_changes_are_guarded() {
		$ma     = $this->make_admin( Roles::ROLE_MEMBERSHIP_ADMIN );
		$pa     = $this->make_admin( Roles::ROLE_PORTAL_ADMIN );
		$member = $this->make_member();
		$token  = $this->sign_in( $member, true );
		$s      = 'mutation($id:Int!){ suspendMember(input:{userId:$id, reason:"test"}) { member { status } } }';

		$this->sign_in( $ma );
		$this->assertStringContainsString( 'own', $this->errors( $this->gql( $s, array( 'id' => $ma ) ) ) );
		$this->assertStringContainsString( 'admin account', $this->errors( $this->gql( $s, array( 'id' => $pa ) ) ) );

		$r = $this->gql( $s, array( 'id' => $member ) );
		$this->assertSame( 'SUSPENDED', $r['data']['suspendMember']['member']['status'] );
		$this->assertNull( WP_Session_Tokens::get_instance( $member )->get( $token ), 'suspended member signed out everywhere' );

		$re = $this->gql( 'mutation($id:Int!){ reactivateMember(input:{userId:$id}) { member { status } } }', array( 'id' => $member ) );
		$this->assertSame( 'ACTIVE', $re['data']['reactivateMember']['member']['status'] );

		$pending = $this->make_member( 'pending' );
		$this->assertStringContainsString( 'approved', $this->errors( $this->gql( 'mutation($id:Int!){ reactivateMember(input:{userId:$id}) { member { status } } }', array( 'id' => $pending ) ) ) );
	}

	public function test_content_admin_cannot_change_membership() {
		$ca = $this->make_admin( Roles::ROLE_CONTENT_ADMIN );
		$this->sign_in( $ca );
		$r = $this->gql( 'mutation($id:Int!){ suspendMember(input:{userId:$id}) { member { status } } }', array( 'id' => $this->make_member() ) );
		$this->assertStringContainsString( 'permission', $this->errors( $r ) );
	}

	public function test_update_own_profile_and_cannot_touch_protected_fields() {
		$uid = $this->make_member();
		$this->sign_in( $uid, true );
		$r = $this->gql( 'mutation { updateMyMemberProfile(input:{phone:"555-0199", visibility:[{field:"phone", audience:"members"}]}) { member { phone } } }' );
		$this->assertSame( '555-0199', $r['data']['updateMyMemberProfile']['member']['phone'] );
		$this->assertSame( 'members', Membership::get_visibility( $uid )['phone'] );

		$bad = $this->gql( 'mutation { updateMyMemberProfile(input:{membershipNumber:"151-00001"}) { member { id } } }' );
		$this->assertArrayHasKey( 'errors', $bad );
		$bad2 = $this->gql( 'mutation { updateMyMemberProfile(input:{visibility:[{field:"status", audience:"members"}]}) { member { id } } }' );
		$this->assertArrayHasKey( 'errors', $bad2 );
	}

	public function test_pending_member_cannot_update_profile() {
		$this->sign_in( $this->make_member( 'pending' ), true );
		$r = $this->gql( 'mutation { updateMyMemberProfile(input:{phone:"1"}) { member { id } } }' );
		$this->assertStringContainsString( 'not active', $this->errors( $r ) );
	}

	public function test_session_status() {
		$this->assertFalse( $this->gql( 'query { portalSessionStatus { authenticated } }' )['data']['portalSessionStatus']['authenticated'] );
		$this->sign_in( $this->make_member(), true );
		$s = $this->gql( 'query { portalSessionStatus { authenticated idleSecondsRemaining adminSession } }' )['data']['portalSessionStatus'];
		$this->assertTrue( $s['authenticated'] );
		$this->assertFalse( $s['adminSession'] );
		$this->assertGreaterThan( 0, $s['idleSecondsRemaining'] );
	}
}
