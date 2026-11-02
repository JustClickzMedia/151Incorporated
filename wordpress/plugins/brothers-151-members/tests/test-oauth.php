<?php
use B151\Members\Oauth;
use B151\Members\Sessions;
use Firebase\JWT\JWT;

/**
 * OAuth/OIDC with a locally generated RSA key standing in for Google. No network: token and key endpoints are mocked.
 */
class Test_Oauth extends B151_TestCase {

	private static $private_key;
	private static array $jwks;
	private array $claims_override = array();
	private ?string $sign_with     = null;
	private int $token_calls       = 0;

	public static function wpSetUpBeforeClass( $factory ) {
		$key  = openssl_pkey_new( array( 'private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA ) );
		openssl_pkey_export( $key, $pem );
		self::$private_key = $pem;
		$d   = openssl_pkey_get_details( $key );
		$b64 = static fn( $b ) => rtrim( strtr( base64_encode( $b ), '+/', '-_' ), '=' );
		self::$jwks = array(
			'keys' => array(
				array( 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'test-kid', 'n' => $b64( $d['rsa']['n'] ), 'e' => $b64( $d['rsa']['e'] ) ),
			),
		);
	}

	public function set_up(): void {
		parent::set_up();
		do_action( 'rest_api_init' );
		delete_transient( 'b151_jwks_google' );
		$this->claims_override = array();
		$this->sign_with       = null;
		$this->token_calls     = 0;
		add_filter( 'pre_http_request', array( $this, 'mock_http' ), 10, 3 );
	}

	public function mock_http( $pre, $args, $url ) {
		if ( 'https://www.googleapis.com/oauth2/v3/certs' === $url ) {
			return array( 'response' => array( 'code' => 200 ), 'body' => wp_json_encode( self::$jwks ), 'headers' => array(), 'cookies' => array() );
		}
		if ( 'https://oauth2.googleapis.com/token' === $url ) {
			++$this->token_calls;
			$body = $args['body'];
			if ( 'good-code' !== $body['code'] || empty( $body['code_verifier'] ) || 'test-secret' !== $body['client_secret'] ) {
				return array( 'response' => array( 'code' => 400 ), 'body' => '{"error":"invalid_grant"}', 'headers' => array(), 'cookies' => array() );
			}
			$this->last_verifier = $body['code_verifier'];
			return array( 'response' => array( 'code' => 200 ), 'body' => wp_json_encode( array( 'id_token' => $this->id_token() ) ), 'headers' => array(), 'cookies' => array() );
		}
		return new WP_Error( 'blocked', 'No network in tests: ' . $url );
	}

	public $last_verifier = '';
	private string $nonce = '';

	private function id_token(): string {
		$claims = array_merge(
			array(
				'iss'            => 'https://accounts.google.com',
				'aud'            => B151_GOOGLE_CLIENT_ID,
				'sub'            => 'google-sub-123',
				'email'          => 'brother@example.org',
				'email_verified' => true,
				'nonce'          => $this->nonce,
				'iat'            => time(),
				'exp'            => time() + 600,
			),
			$this->claims_override
		);
		$key = self::$private_key;
		if ( 'other' === $this->sign_with ) {
			openssl_pkey_export( openssl_pkey_new( array( 'private_key_bits' => 2048 ) ), $key );
		}
		return JWT::encode( $claims, $key, 'RS256', 'test-kid' );
	}

	/** Run the start step and return [state, location]. */
	private function start( string $return = '/members' ): array {
		$res = $this->rest( 'GET', '/b151/v1/oauth/google/start', array( 'return' => $return ) );
		$this->assertSame( 302, $res->get_status() );
		$loc = $res->get_headers()['Location'];
		parse_str( (string) wp_parse_url( $loc, PHP_URL_QUERY ), $q );
		$this->nonce = $q['nonce'];
		return array( $q, $loc );
	}

	private function oauth_callback( array $params ): string {
		$res = $this->rest( 'GET', '/b151/v1/oauth/google/callback', $params );
		$this->assertSame( 302, $res->get_status() );
		return $res->get_headers()['Location'];
	}

	public function test_start_uses_pkce_state_and_nonce() {
		list( $q, $loc ) = $this->start();
		$this->assertStringStartsWith( 'https://accounts.google.com/o/oauth2/v2/auth?', $loc );
		$this->assertSame( 'S256', $q['code_challenge_method'] );
		$this->assertSame( 'code', $q['response_type'] );
		$this->assertGreaterThanOrEqual( 43, strlen( $q['state'] ) );
		$this->assertGreaterThanOrEqual( 43, strlen( $q['nonce'] ) );
		$this->assertNotEmpty( $q['code_challenge'] );
		$this->assertArrayNotHasKey( 'client_secret', $q );
		$this->assertNotEmpty( $_COOKIE[ Oauth::BIND_COOKIE ] );
	}

	public function test_unconfigured_provider_fails_cleanly() {
		$res = $this->rest( 'GET', '/b151/v1/oauth/microsoft/start' );
		$this->assertStringContainsString( 'error=provider_unavailable', $res->get_headers()['Location'] );
	}

	public function test_successful_sign_in_links_by_verified_email() {
		$uid = $this->make_member( 'active', array( 'user_email' => 'brother@example.org' ) );
		list( $q ) = $this->start( '/members/events' );
		$loc = $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) );

		$this->assertSame( 'https://brothersof1-5-1.org/members/events', $loc );
		$this->assertSame( $uid, get_current_user_id() );
		$this->assertTrue( Sessions::is_portal_session( $uid, wp_get_session_token() ) );
		$this->assertSame( 'google-sub-123', get_user_meta( $uid, 'b151_oauth_google_sub', true ) );
		$this->assertSame( rtrim( strtr( base64_encode( hash( 'sha256', $this->last_verifier, true ) ), '+/', '-_' ), '=' ), $q['code_challenge'], 'PKCE verifier matches challenge' );
	}

	public function test_state_is_single_use() {
		$this->make_member( 'active', array( 'user_email' => 'brother@example.org' ) );
		list( $q ) = $this->start();
		$bind = $_COOKIE[ Oauth::BIND_COOKIE ];
		$this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) );
		wp_set_current_user( 0 );
		$_COOKIE[ Oauth::BIND_COOKIE ] = $bind;
		$this->assertStringContainsString( 'error=invalid_request', $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) ) );
	}

	public function test_missing_browser_binding_is_rejected() {
		$this->make_member( 'active', array( 'user_email' => 'brother@example.org' ) );
		list( $q ) = $this->start();
		unset( $_COOKIE[ Oauth::BIND_COOKIE ] ); // e.g. a link sent to someone else's browser
		$this->assertStringContainsString( 'error=invalid_request', $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) ) );
		$this->assertSame( 0, $this->token_calls );
		$this->assertSame( 0, get_current_user_id() );
	}

	/** @dataProvider bad_tokens */
	public function test_invalid_id_tokens_are_rejected( array $override, ?string $sign_with ) {
		$this->make_member( 'active', array( 'user_email' => 'brother@example.org' ) );
		list( $q ) = $this->start();
		$this->claims_override = $override;
		$this->sign_with       = $sign_with;
		$loc = $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) );
		$this->assertStringContainsString( 'error=', $loc );
		$this->assertSame( 0, get_current_user_id() );
	}

	public function bad_tokens(): array {
		return array(
			'wrong audience'       => array( array( 'aud' => 'someone-else' ), null ),
			'wrong issuer'         => array( array( 'iss' => 'https://evil.example' ), null ),
			'expired'              => array( array( 'exp' => time() - 3600, 'iat' => time() - 7200 ), null ),
			'wrong nonce'          => array( array( 'nonce' => 'replayed' ), null ),
			'signed by other key'  => array( array(), 'other' ),
			'email not verified'   => array( array( 'email_verified' => false ), null ),
		);
	}

	public function test_bad_code_is_rejected() {
		list( $q ) = $this->start();
		$this->assertStringContainsString( 'error=provider_error', $this->oauth_callback( array( 'code' => 'stolen', 'state' => $q['state'] ) ) );
	}

	public function test_no_account_is_never_created() {
		$before = count_users()['total_users'];
		list( $q ) = $this->start();
		$this->assertStringContainsString( 'error=no_account', $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) ) );
		$this->assertSame( $before, count_users()['total_users'] );
	}

	public function test_pending_member_cannot_sign_in_with_google() {
		$this->make_member( 'pending', array( 'user_email' => 'brother@example.org' ) );
		list( $q ) = $this->start();
		$this->assertStringContainsString( 'error=not_active', $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) ) );
		$this->assertSame( 0, get_current_user_id() );
	}

	public function test_account_linked_to_other_google_identity_is_not_repointed() {
		$uid = $this->make_member( 'active', array( 'user_email' => 'brother@example.org' ) );
		update_user_meta( $uid, 'b151_oauth_google_sub', 'a-different-sub' );
		list( $q ) = $this->start();
		$this->assertStringContainsString( 'error=already_linked', $this->oauth_callback( array( 'code' => 'good-code', 'state' => $q['state'] ) ) );
		$this->assertSame( 'a-different-sub', get_user_meta( $uid, 'b151_oauth_google_sub', true ) );
	}

	public function test_return_path_cannot_leave_the_site() {
		foreach ( array( '//evil.example', 'https://evil.example', '/members?x=https://evil', 'javascript:alert(1)', '' ) as $bad ) {
			$this->assertSame( '/members', Oauth::safe_return_path( $bad ), $bad );
		}
		$this->assertSame( '/members/events', Oauth::safe_return_path( '/members/events' ) );
	}

	public function test_microsoft_work_accounts_need_explicit_linking() {
		$this->make_member( 'active', array( 'user_email' => 'brother@contoso.example' ) );
		$work     = (object) array( 'tid' => '11111111-2222-3333-4444-555555555555', 'email' => 'brother@contoso.example' );
		$consumer = (object) array( 'tid' => Oauth::MS_CONSUMER_TENANT, 'email' => 'brother@contoso.example' );
		$this->assertSame( 0, Oauth::match_by_verified_email( 'microsoft', $work ) );
		$this->assertGreaterThan( 0, Oauth::match_by_verified_email( 'microsoft', $consumer ) );
	}
}
