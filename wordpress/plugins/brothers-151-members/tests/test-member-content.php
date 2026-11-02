<?php
use B151\Members\Content_Types;
use B151\Members\Downloads;
use B151\Members\Member_Content;
use B151\Members\Membership;
use B151\Members\Private_Storage;
use B151\Members\Roles;
use B151\Members\Settings;

class Test_Member_Content extends B151_TestCase {

	private int $chapter_a;
	private int $chapter_b;
	private string $dir;

	public function set_up(): void {
		parent::set_up();
		$this->chapter_a = self::factory()->post->create( array( 'post_type' => 'b151_chapter', 'post_title' => 'Alpha', 'post_status' => 'publish' ) );
		$this->chapter_b = self::factory()->post->create( array( 'post_type' => 'b151_chapter', 'post_title' => 'Beta', 'post_status' => 'publish' ) );
		$this->dir       = sys_get_temp_dir() . '/b151-private-' . wp_generate_password( 8, false );
		add_filter( 'b151_private_dir', fn() => $this->dir );
		add_filter( 'b151_stream_downloads', '__return_false' );
		do_action( 'rest_api_init' );
	}

	private function item( string $type, array $meta = array(), array $post = array() ): int {
		$id = self::factory()->post->create( array_merge( array( 'post_type' => $type, 'post_status' => 'publish', 'post_title' => 'T ' . wp_generate_password( 4, false ), 'post_content' => 'Body' ), $post ) );
		Content_Types::save_meta( $id, $meta );
		return $id;
	}

	private function member_in( int $chapter, string $status = 'active' ): int {
		$uid = $this->make_member( $status );
		update_user_meta( $uid, Membership::META_CHAPTER, $chapter );
		return $uid;
	}

	private function pdf_file( string $body = '' ): string {
		$f = wp_tempnam( 'x.pdf' );
		file_put_contents( $f, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n" . $body );
		return $f;
	}

	/* ---------- privacy of the content types ---------- */

	public function test_member_content_types_are_private() {
		foreach ( array( Content_Types::EVENT, Content_Types::ANNOUNCEMENT, Content_Types::RESOURCE ) as $type ) {
			$obj = get_post_type_object( $type );
			$this->assertFalse( $obj->public, $type );
			$this->assertFalse( $obj->publicly_queryable, $type );
			$this->assertFalse( $obj->show_in_rest, $type );
			$this->assertFalse( (bool) $obj->show_in_graphql, $type );
		}
	}

	public function test_only_content_admins_can_edit_member_content() {
		$event  = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-01 10:00' ) );
		$member = $this->make_member();
		$ma     = self::factory()->user->create( array( 'role' => Roles::ROLE_MEMBERSHIP_ADMIN ) );
		$ca     = self::factory()->user->create( array( 'role' => Roles::ROLE_CONTENT_ADMIN ) );
		$this->assertFalse( user_can( $member, 'edit_post', $event ) );
		$this->assertFalse( user_can( $ma, 'edit_post', $event ) );
		$this->assertTrue( user_can( $ca, 'edit_post', $event ) );
		$this->assertTrue( user_can( $ca, 'delete_post', $event ) );
	}

	public function test_meta_is_sanitized() {
		$id = $this->item( Content_Types::EVENT, array( 'audience' => 'chapter', 'chapter_id' => 999999, 'starts_at' => '2030-13-45 10:00', 'virtual_url' => 'javascript:alert(1)' ) );
		$this->assertSame( 'all', get_post_meta( $id, Content_Types::META_AUDIENCE, true ), 'unknown chapter falls back to all members' );
		$this->assertSame( '', get_post_meta( $id, Content_Types::META_STARTS, true ) );
		$this->assertSame( '', get_post_meta( $id, Content_Types::META_VURL, true ) );
		$id2 = $this->item( Content_Types::EVENT, array( 'virtual_url' => 'http://zoom.example/j/1' ) );
		$this->assertSame( '', get_post_meta( $id2, Content_Types::META_VURL, true ), 'only https meeting links' );
		$id3 = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-02-03T18:30', 'virtual_url' => 'https://zoom.us/j/123' ) );
		$this->assertSame( '2030-02-03 18:30', get_post_meta( $id3, Content_Types::META_STARTS, true ) );
		$this->assertSame( 'https://zoom.us/j/123', get_post_meta( $id3, Content_Types::META_VURL, true ) );
	}

	/* ---------- visibility ---------- */

	public function test_chapter_scope_and_status() {
		$all   = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-01 10:00' ) );
		$alpha = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-02 10:00', 'audience' => 'chapter', 'chapter_id' => $this->chapter_a ) );
		$draft = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-03 10:00' ), array( 'post_status' => 'draft' ) );

		$a = $this->member_in( $this->chapter_a );
		$b = $this->member_in( $this->chapter_b );
		$p = $this->member_in( $this->chapter_a, 'pending' );

		$this->sign_in( $a, true );
		$this->assertTrue( Member_Content::can_view( $all ) );
		$this->assertTrue( Member_Content::can_view( $alpha ) );
		$this->assertFalse( Member_Content::can_view( $draft ) );
		$this->assertSame( array( $all, $alpha ), wp_list_pluck( Member_Content::events()['posts'], 'ID' ) );

		$this->sign_in( $b, true );
		$this->assertFalse( Member_Content::can_view( $alpha ), 'other chapter' );
		$this->assertSame( array( $all ), wp_list_pluck( Member_Content::events()['posts'], 'ID' ) );

		$this->sign_in( $p, true );
		$this->assertFalse( Member_Content::can_view( $all ), 'pending' );
		$this->assertSame( 0, Member_Content::events()['total'] );

		wp_set_current_user( 0 );
		$this->assertSame( 0, Member_Content::events()['total'], 'guest' );
	}

	public function test_content_admin_sees_every_chapter_only_with_admin_session() {
		$alpha = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-02 10:00', 'audience' => 'chapter', 'chapter_id' => $this->chapter_a ) );
		$ca    = $this->make_admin( Roles::ROLE_CONTENT_ADMIN );
		update_user_meta( $ca, Membership::META_CHAPTER, $this->chapter_b );
		$this->sign_in( $ca, true );
		$this->assertFalse( Member_Content::can_view( $alpha ), 'member-area session: chapter rules apply' );
		$this->sign_in( $ca );
		$this->assertTrue( Member_Content::can_view( $alpha ) );
	}

	public function test_past_events_hidden_unless_asked() {
		$past = $this->item( Content_Types::EVENT, array( 'starts_at' => '2001-01-01 10:00', 'ends_at' => '2001-01-01 12:00' ) );
		$soon = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-01 10:00' ) );
		$this->sign_in( $this->make_member(), true );
		$this->assertSame( array( $soon ), wp_list_pluck( Member_Content::events()['posts'], 'ID' ) );
		$this->assertSame( array( $past, $soon ), wp_list_pluck( Member_Content::events( array( 'includePast' => true ) )['posts'], 'ID' ) );
	}

	public function test_announcements_pinned_first_and_expired_hidden() {
		$old     = $this->item( Content_Types::ANNOUNCEMENT, array(), array( 'post_date' => '2026-01-01 10:00:00' ) );
		$pinned  = $this->item( Content_Types::ANNOUNCEMENT, array( 'pinned' => 1 ), array( 'post_date' => '2025-01-01 10:00:00' ) );
		$newer   = $this->item( Content_Types::ANNOUNCEMENT, array(), array( 'post_date' => '2026-06-01 10:00:00' ) );
		$expired = $this->item( Content_Types::ANNOUNCEMENT, array( 'expires_on' => '2001-01-01' ) );
		$this->sign_in( $this->make_member(), true );
		$this->assertSame( array( $pinned, $newer, $old ), wp_list_pluck( Member_Content::announcements()['posts'], 'ID' ) );
		$this->assertFalse( Member_Content::can_view( $expired ) );
	}

	/* ---------- GraphQL ---------- */

	public function test_graphql_event_details_only_for_allowed_members() {
		$alpha = $this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-02 18:00', 'audience' => 'chapter', 'chapter_id' => $this->chapter_a, 'virtual_url' => 'https://zoom.us/j/999', 'virtual_passcode' => '151' ) );
		$q     = 'query($id:Int!){ memberEvent(id:$id){ title virtualUrl passcode audience chapter { name } } memberEvents { total nodes { id } } }';

		$this->sign_in( $this->member_in( $this->chapter_a ), true );
		$r = $this->gql( $q, array( 'id' => $alpha ) );
		$this->assertSame( 'https://zoom.us/j/999', $r['data']['memberEvent']['virtualUrl'] );
		$this->assertSame( 'Alpha', $r['data']['memberEvent']['chapter']['name'] );
		$this->assertSame( 1, $r['data']['memberEvents']['total'] );

		$this->sign_in( $this->member_in( $this->chapter_b ), true );
		$r = $this->gql( $q, array( 'id' => $alpha ) );
		$this->assertNull( $r['data']['memberEvent'] );
		$this->assertSame( 0, $r['data']['memberEvents']['total'] );

		wp_set_current_user( 0 );
		$r = $this->gql( $q, array( 'id' => $alpha ) );
		$this->assertNull( $r['data']['memberEvent'] );
		$this->assertStringNotContainsString( 'zoom', wp_json_encode( $r ) );
	}

	public function test_content_is_not_in_public_graphql_or_rest() {
		$this->item( Content_Types::EVENT, array( 'starts_at' => '2030-01-02 18:00', 'virtual_url' => 'https://zoom.us/j/777' ) );
		$r = $this->gql( '{ contentNodes(first: 50) { nodes { __typename } } }' );
		$this->assertStringNotContainsString( 'zoom', wp_json_encode( $r ) );
		$this->assertStringNotContainsString( 'b151', strtolower( wp_json_encode( $r ) ) );
		$this->assertArrayNotHasKey( '/wp/v2/' . Content_Types::EVENT, rest_get_server()->get_routes() );
	}

	/* ---------- directory + verify ---------- */

	public function test_directory_lists_active_brothers_with_shared_fields_only() {
		$a = $this->member_in( $this->chapter_a );
		Membership::update_profile( $a, array( 'display_name' => 'Aaron Able', 'phone' => '555-0001' ) );
		$b = $this->member_in( $this->chapter_b );
		Membership::update_profile( $b, array( 'display_name' => 'Bob Baker', 'phone' => '555-0002', 'visibility' => array( 'phone' => 'members' ) ) );
		$this->member_in( $this->chapter_a, 'suspended' );
		$this->member_in( $this->chapter_a, 'pending' );

		$this->sign_in( $a, true );
		$r = $this->gql( '{ memberDirectory { total nodes { displayName phone email chapter { name } isActive } } }' );
		$this->assertSame( 2, $r['data']['memberDirectory']['total'] );
		$byName = array_column( $r['data']['memberDirectory']['nodes'], null, 'displayName' );
		$this->assertSame( '555-0001', $byName['Aaron Able']['phone'], 'own phone visible to himself' );
		$this->assertSame( '555-0002', $byName['Bob Baker']['phone'], 'shared' );
		$this->assertNull( $byName['Bob Baker']['email'], 'not shared' );
		$this->assertSame( 'Beta', $byName['Bob Baker']['chapter']['name'] );

		$s = $this->gql( '{ memberDirectory(search:"bak") { total nodes { displayName } } }' );
		$this->assertSame( array( 'Bob Baker' ), array_column( $s['data']['memberDirectory']['nodes'], 'displayName' ) );
		$c = $this->gql( '{ memberDirectory(chapterId:' . $this->chapter_a . ') { total } }' );
		$this->assertSame( 1, $c['data']['memberDirectory']['total'] );
		$short = $this->gql( '{ memberDirectory(search:"b") { total } }' );
		$this->assertStringContainsString( '2 letters', wp_json_encode( $short['errors'] ) );
	}

	public function test_directory_closed_to_pending_and_guests_and_rate_limited() {
		$this->member_in( $this->chapter_a );
		$this->sign_in( $this->member_in( $this->chapter_a, 'pending' ), true );
		$this->assertSame( 0, $this->gql( '{ memberDirectory { total } }' )['data']['memberDirectory']['total'] );
		wp_set_current_user( 0 );
		$this->assertSame( 0, $this->gql( '{ memberDirectory { total } }' )['data']['memberDirectory']['total'] );

		Settings::update( array( 'directory_per_minute' => 2 ) );
		$this->sign_in( $this->member_in( $this->chapter_a ), true );
		$this->gql( '{ memberDirectory { total } }' );
		$this->gql( '{ memberDirectory { total } }' );
		$this->assertStringContainsString( 'Too many', wp_json_encode( $this->gql( '{ memberDirectory { total } }' )['errors'] ) );
	}

	public function test_member_profile_hides_inactive_brothers() {
		$inactive = $this->member_in( $this->chapter_a, 'inactive' );
		$this->sign_in( $this->member_in( $this->chapter_a ), true );
		$r = $this->gql( 'query($id:Int!){ memberProfile(id:$id){ displayName } }', array( 'id' => $inactive ) );
		$this->assertNull( $r['data']['memberProfile'] );
	}

	public function test_verify_member_for_zoom_check_in() {
		$bro = $this->member_in( $this->chapter_a, 'pending' );
		Membership::update_profile( $bro, array( 'display_name' => 'Carl Check' ) );
		Membership::approve( $bro );
		$number = Membership::get_number( $bro );
		$q      = 'query($n:String!){ verifyMember(membershipNumber:$n){ found displayName isActive chapter { name } } }';

		$this->sign_in( $this->make_member(), true );
		$this->assertStringContainsString( 'permission', wp_json_encode( $this->gql( $q, array( 'n' => $number ) )['errors'] ) );

		$ma = $this->make_admin( Roles::ROLE_MEMBERSHIP_ADMIN );
		$this->sign_in( $ma, true );
		$this->assertArrayHasKey( 'errors', $this->gql( $q, array( 'n' => $number ) ), 'member-area session is not enough' );

		$this->sign_in( $ma );
		$r = $this->gql( $q, array( 'n' => $number ) )['data']['verifyMember'];
		$this->assertTrue( $r['found'] );
		$this->assertSame( 'Carl Check', $r['displayName'] );
		$this->assertTrue( $r['isActive'] );
		$this->assertSame( 'Alpha', $r['chapter']['name'] );
		$this->assertFalse( $this->gql( $q, array( 'n' => '151-99999' ) )['data']['verifyMember']['found'] );
		$this->assertSame( 'member_verified', \B151\Members\Audit_Log::recent( 1 )[0]->action );
	}

	/* ---------- private storage ---------- */

	public function test_storage_refuses_missing_or_public_folder() {
		remove_all_filters( 'b151_private_dir' );
		$this->assertWPError( Private_Storage::dir() );
		add_filter( 'b151_private_dir', fn() => ABSPATH . 'wp-content/uploads/b151-private-test' );
		$this->assertSame( 'b151_storage_public', Private_Storage::dir()->get_error_code() );
	}

	public function test_store_validates_type_content_and_size() {
		$ok = Private_Storage::store( $this->pdf_file(), 'Bylaws 2026.pdf' );
		$this->assertIsArray( $ok );
		$this->assertMatchesRegularExpression( '/^[a-f0-9]{32}\.pdf$/', $ok['stored'] );
		$this->assertSame( 'application/pdf', $ok['mime'] );
		$this->assertFileExists( $this->dir . '/' . $ok['stored'] );
		$this->assertFileExists( $this->dir . '/.htaccess' );

		$fake = wp_tempnam( 'x' );
		file_put_contents( $fake, '<?php echo "hi";' );
		$this->assertWPError( Private_Storage::store( $fake, 'evil.pdf' ), 'content must match the type' );
		$this->assertWPError( Private_Storage::store( $this->pdf_file(), 'evil.php' ), 'type not allowed' );

		Settings::update( array( 'max_upload_mb' => 1 ) );
		$this->assertSame( 'b151_upload_size', Private_Storage::store( $this->pdf_file( str_repeat( 'x', MB_IN_BYTES + 10 ) ), 'big.pdf' )->get_error_code() );

		$this->assertNull( Private_Storage::path( '../wp-config.php' ) );
		$this->assertNull( Private_Storage::path( 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf' ) );
	}

	private function resource_with_file( array $meta = array() ): int {
		$id   = $this->item( Content_Types::RESOURCE, $meta );
		$file = Private_Storage::store( $this->pdf_file( str_repeat( 'A', 1000 ) ), 'Minutes.pdf' );
		Private_Storage::attach( $id, $file );
		return $id;
	}

	/* ---------- downloads ---------- */

	public function test_download_requires_sign_in_and_access() {
		$id  = $this->resource_with_file( array( 'audience' => 'chapter', 'chapter_id' => $this->chapter_a ) );
		$get = fn( $origin = null ) => $this->rest( 'GET', '/b151/v1/resources/' . $id . '/download', array(), $origin );

		$this->assertSame( 401, $get()->get_status() );
		$this->sign_in( $this->member_in( $this->chapter_b ), true );
		$this->assertSame( 404, $get()->get_status(), 'other chapter: same answer as missing' );
		$this->sign_in( $this->member_in( $this->chapter_a, 'suspended' ), true );
		$this->assertSame( 404, $get()->get_status() );

		$this->sign_in( $this->member_in( $this->chapter_a ), true );
		$this->assertSame( 403, $get( 'https://evil.example' )->get_status() );
		$res = $get();
		$this->assertSame( 200, $res->get_status() );
		$h = $res->get_headers();
		$this->assertSame( 'application/pdf', $h['Content-Type'] );
		$this->assertSame( 'nosniff', $h['X-Content-Type-Options'] );
		$this->assertSame( 'no-store, private, max-age=0', $h['Cache-Control'] );
		$this->assertStringStartsWith( 'inline; filename="Minutes.pdf"', $h['Content-Disposition'] );
		$this->assertSame( 'resource_downloaded', \B151\Members\Audit_Log::recent( 1 )[0]->action );
	}

	public function test_download_supports_ranges() {
		$id = $this->resource_with_file();
		$this->sign_in( $this->make_member(), true );
		$req = new WP_REST_Request( 'GET', '/b151/v1/resources/' . $id . '/download' );
		$req->set_header( 'Range', 'bytes=10-19' );
		$res = rest_get_server()->dispatch( $req );
		$this->assertSame( 206, $res->get_status() );
		$this->assertSame( '10', $res->get_headers()['Content-Length'] );
		$this->assertMatchesRegularExpression( '#^bytes 10-19/\d+$#', $res->get_headers()['Content-Range'] );

		$req->set_header( 'Range', 'bytes=999999-' );
		$this->assertSame( 416, rest_get_server()->dispatch( $req )->get_status() );
	}

	public function test_parse_range() {
		$this->assertNull( Downloads::parse_range( null, 100 ) );
		$this->assertSame( array( 0, 99 ), Downloads::parse_range( 'bytes=0-', 100 ) );
		$this->assertSame( array( 90, 99 ), Downloads::parse_range( 'bytes=-10', 100 ) );
		$this->assertSame( array( 50, 99 ), Downloads::parse_range( 'bytes=50-500', 100 ) );
		$this->assertFalse( Downloads::parse_range( 'bytes=100-', 100 ) );
		$this->assertNull( Downloads::parse_range( 'bytes=0-1,5-6', 100 ), 'multi-range: whole file' );
		$this->assertNull( Downloads::parse_range( 'items=0-1', 100 ) );
	}

	public function test_graphql_resource_gives_signed_download_link_not_a_path() {
		$id = $this->resource_with_file();
		$this->sign_in( $this->make_member(), true );
		$r = $this->gql( 'query($id:Int!){ memberResource(id:$id){ fileName fileSize downloadUrl } }', array( 'id' => $id ) )['data']['memberResource'];
		$this->assertSame( 'Minutes.pdf', $r['fileName'] );
		$this->assertStringContainsString( '/b151/v1/resources/' . $id . '/download', urldecode( $r['downloadUrl'] ) );
		$this->assertStringContainsString( '_wpnonce=', $r['downloadUrl'] );
		$this->assertStringNotContainsString( $this->dir, wp_json_encode( $r ) );
	}

	public function test_deleting_a_resource_deletes_its_file() {
		$id     = $this->resource_with_file();
		$stored = get_post_meta( $id, Content_Types::META_FILE, true )['stored'];
		$this->assertFileExists( $this->dir . '/' . $stored );
		wp_delete_post( $id, true );
		$this->assertFileDoesNotExist( $this->dir . '/' . $stored );
	}
}
