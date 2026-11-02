<?php
use B151\Members\Admin;
use B151\Members\Membership;
use B151\Members\Notifications;
use B151\Members\Roster;
use B151\Members\Settings;

class Test_Admin_Notifications extends B151_TestCase {

	public function set_up(): void {
		parent::set_up();
		reset_phpmailer_instance();
	}

	public function test_approval_email_has_number_and_sign_in_link_only() {
		$uid = $this->make_member( 'pending', array( 'user_email' => 'new@example.org', 'display_name' => 'Dan New' ) );
		Membership::approve( $uid, 'member', 1 );
		$mail = tests_retrieve_phpmailer_instance()->get_sent();
		$this->assertSame( 'new@example.org', $mail->to[0][0] );
		$this->assertStringContainsString( 'approved', $mail->subject );
		$this->assertStringContainsString( Membership::get_number( $uid ), $mail->body );
		$this->assertStringContainsString( 'https://brothersof1-5-1.org/members', $mail->body );
		$this->assertStringNotContainsString( 'password', strtolower( $mail->body ) );
	}

	public function test_suspension_email_and_switch_off() {
		$uid = $this->make_member( 'active', array( 'user_email' => 'paused@example.org' ) );
		Membership::set_status( $uid, 'suspended', 'dues' );
		$mail = tests_retrieve_phpmailer_instance()->get_sent();
		$this->assertStringContainsString( 'paused', $mail->body );
		$this->assertStringNotContainsString( 'dues', $mail->body, 'internal reason is not emailed' );

		reset_phpmailer_instance();
		Settings::update( array( 'notify_members' => false ) );
		Membership::set_status( $uid, 'active' );
		$this->assertFalse( tests_retrieve_phpmailer_instance()->get_sent() );
	}

	public function test_no_email_for_pending_or_unchanged() {
		$this->assertNull( Notifications::message( 1, 'active', 'pending' ) );
	}

	public function test_roster_cells_cannot_become_formulas() {
		$this->assertSame( "'=HYPERLINK(\"x\")", Roster::cell( '=HYPERLINK("x")' ) );
		$this->assertSame( "'+1", Roster::cell( '+1' ) );
		$this->assertSame( "'-2", Roster::cell( '-2' ) );
		$this->assertSame( "'@SUM(A1)", Roster::cell( '@SUM(A1)' ) );
		$this->assertSame( '151-00001', Roster::cell( '151-00001' ) );
	}

	public function test_roster_rows_and_csv() {
		$uid = $this->make_member( 'pending', array( 'user_email' => 'r@example.org' ) );
		Membership::update_profile( $uid, array( 'display_name' => '=cmd|evil', 'phone' => '555-0100' ) );
		Membership::approve( $uid );
		$this->make_member( 'suspended' );

		$rows = Roster::rows( 'active' );
		$this->assertCount( 1, $rows );
		$this->assertSame( 'r@example.org', $rows[0]['email'] );
		$csv = Roster::csv( $rows );
		$this->assertStringStartsWith( "\xEF\xBB\xBF" . '"Membership #",Name,Email', $csv );
		$this->assertStringContainsString( "'=cmd|evil", $csv );
		$this->assertCount( 2, Roster::rows() );
	}

	public function test_admin_screens_require_capabilities() {
		global $submenu;
		$this->sign_in( $this->make_member(), true );
		$this->expectException( WPDieException::class );
		Admin::roster_page();
	}

	public function test_membership_admin_with_portal_session_cannot_export() {
		$this->sign_in( $this->make_admin( \B151\Members\Roles::ROLE_MEMBERSHIP_ADMIN ), true );
		$this->expectException( WPDieException::class );
		Admin::audit_page();
	}
}
