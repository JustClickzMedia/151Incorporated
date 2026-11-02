<?php
use B151\Members\Hardening;

class Test_Hardening extends B151_TestCase {

	public function test_xmlrpc_is_off() {
		$this->assertFalse( apply_filters( 'xmlrpc_enabled', true ) );
		$this->assertSame( array(), apply_filters( 'xmlrpc_methods', array( 'wp.getUsersBlogs' => 'x' ) ) );
	}

	public function test_jwt_password_endpoint_removed_others_kept() {
		$routes = Hardening::drop_jwt_password_route(
			array(
				'/simple-jwt-login/v1/auth'         => array(),
				'/simple-jwt-login/v1/auth/refresh' => array(),
				'/wp/v2/posts'                      => array(),
			)
		);
		$this->assertSame( array( '/wp/v2/posts' ), array_keys( $routes ) );
	}

	public function test_prospects_and_brothers_types_are_not_public() {
		register_post_type( 'new-prospects', array( 'public' => true, 'show_in_rest' => true, 'show_in_graphql' => true, 'graphql_single_name' => 'prospect', 'graphql_plural_name' => 'prospects' ) );
		register_post_type( 'brothers', array( 'public' => true, 'show_in_rest' => true ) );
		foreach ( array( 'new-prospects', 'brothers' ) as $type ) {
			$o = get_post_type_object( $type );
			$this->assertFalse( $o->show_in_rest, $type );
			$this->assertFalse( (bool) $o->show_in_graphql, $type );
			$this->assertFalse( $o->publicly_queryable, $type );
		}
		$this->assertTrue( get_post_type_object( 'post' )->show_in_rest, 'normal posts untouched' );
		unregister_post_type( 'new-prospects' );
		unregister_post_type( 'brothers' );
	}

	public function test_users_sitemap_and_core_sitemaps_off() {
		$this->assertFalse( Hardening::drop_users_sitemap( new stdClass(), 'users' ) );
		$this->assertInstanceOf( stdClass::class, Hardening::drop_users_sitemap( new stdClass(), 'posts' ) );
		$this->assertFalse( apply_filters( 'wp_sitemaps_enabled', true ) );
	}

	public function test_author_scan_gets_404() {
		$uid = self::factory()->user->create( array( 'role' => 'author' ) );
		$this->go_to( '/?author=' . $uid );
		$_GET['author'] = (string) $uid;
		Hardening::block_author_scan();
		$this->assertTrue( is_404() );
	}

	public function test_graphql_depth_capped_at_10_and_no_batching() {
		$this->assertSame( 10, Hardening::graphql_depth( 15 ) );
		$this->assertSame( 10, Hardening::graphql_depth( 0 ) );
		$this->assertSame( 8, Hardening::graphql_depth( 8 ) );
		$this->assertFalse( apply_filters( 'graphql_is_batch_queries_enabled', true, array() ) );
		$deep = '{ ' . str_repeat( 'posts { nodes { categories { nodes { ', 4 ) . 'id' . str_repeat( ' } } } }', 4 ) . ' }';
		$r    = $this->gql( $deep );
		$this->assertStringContainsString( 'depth', strtolower( wp_json_encode( $r['errors'] ?? array() ) ) );
	}

	public function test_the_public_site_queries_still_work() {
		self::factory()->post->create( array( 'post_title' => 'Hello brothers' ) );
		$r = $this->gql( '{ posts(first: 5) { nodes { title featuredImage { node { sourceUrl mediaDetails { width height } } } categories { nodes { name } } } } }' );
		$this->assertArrayNotHasKey( 'errors', $r );
		$this->assertSame( 'Hello brothers', $r['data']['posts']['nodes'][0]['title'] );
	}
}
