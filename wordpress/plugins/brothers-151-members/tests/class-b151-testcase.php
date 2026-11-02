<?php
use B151\Members\Membership;
use B151\Members\Roles;
use B151\Members\Sessions;
use B151\Members\Rate_Limiter;

abstract class B151_TestCase extends WP_UnitTestCase {

	/** @var int[] users that "have" two-step sign-in set up */
	protected static array $two_factor_users = array();

	public function set_up(): void {
		parent::set_up();
		self::$two_factor_users = array();
		add_filter( 'two_factor_is_required_for_user', array( $this, 'fake_two_factor' ), 10, 2 );
		$_COOKIE  = array();
		$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
		unset( $_SERVER['HTTP_X_B151_ACTIVITY'], $_SERVER['HTTP_ORIGIN'] );
		Sessions::reset_cache();
		wp_set_current_user( 0 );
		if ( class_exists( 'WPGraphQL' ) ) {
			\WPGraphQL::clear_schema();
		}
	}

	public function tear_down(): void {
		$_COOKIE = array();
		Sessions::reset_cache();
		parent::tear_down();
	}

	public function fake_two_factor( $required, $user ) {
		return in_array( (int) $user->ID, self::$two_factor_users, true );
	}

	protected function enable_two_factor( int $uid ): void {
		self::$two_factor_users[] = $uid;
	}

	protected function make_member( string $status = 'active', array $args = array() ): int {
		$uid = self::factory()->user->create(
			array_merge(
				array(
					'role'      => Roles::ROLE_MEMBER,
					'user_pass' => 'correct horse battery',
				),
				$args
			)
		);
		if ( 'pending' !== $status ) {
			update_user_meta( $uid, Membership::META_STATUS, $status );
		}
		return $uid;
	}

	protected function make_admin( string $role = 'administrator', bool $two_factor = true ): int {
		$uid = self::factory()->user->create( array( 'role' => $role, 'user_pass' => 'admin password 123' ) );
		if ( $two_factor ) {
			$this->enable_two_factor( $uid );
		}
		return $uid;
	}

	/** Create a real WordPress session + logged_in cookie for $uid. */
	protected function sign_in( int $uid, bool $portal = false ): string {
		if ( $portal ) {
			Sessions::mark_next_as_portal();
		}
		$exp   = time() + 12 * HOUR_IN_SECONDS;
		$token = WP_Session_Tokens::get_instance( $uid )->create( $exp );
		$_COOKIE[ LOGGED_IN_COOKIE ] = wp_generate_auth_cookie( $uid, $exp, 'logged_in', $token );
		wp_set_current_user( $uid );
		Sessions::reset_cache();
		return $token;
	}

	/** Move a session's clock back. */
	protected function age_session( int $uid, string $token, int $idle_seconds, int $since_login = 0 ): void {
		$m = WP_Session_Tokens::get_instance( $uid );
		$s = $m->get( $token );
		$s[ Sessions::KEY_LAST_ACTIVITY ] = time() - $idle_seconds;
		if ( $since_login ) {
			$s['login'] = time() - $since_login;
		}
		$m->update( $token, $s );
		Sessions::reset_cache();
	}

	protected function rest( string $method, string $route, array $params = array(), ?string $origin = null ): WP_REST_Response {
		$req = new WP_REST_Request( $method, $route );
		foreach ( $params as $k => $v ) {
			$req->set_param( $k, $v );
		}
		if ( $origin ) {
			$req->set_header( 'Origin', $origin );
		}
		return rest_get_server()->dispatch( $req );
	}

	protected function gql( string $query, array $variables = array() ): array {
		return graphql( array( 'query' => $query, 'variables' => $variables ) );
	}
}
