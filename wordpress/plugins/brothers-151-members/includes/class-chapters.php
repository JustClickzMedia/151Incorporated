<?php
namespace B151\Members;

/**
 * Chapters (private post type). Every member belongs to exactly one chapter (user meta b151_chapter_id).
 */
final class Chapters {

	public const POST_TYPE = 'b151_chapter';

	public static function register(): void {
		add_action( 'init', array( self::class, 'register_post_type' ) );
	}

	public static function register_post_type(): void {
		register_post_type(
			self::POST_TYPE,
			array(
				'labels'              => array(
					'name'          => 'Chapters',
					'singular_name' => 'Chapter',
					'add_new_item'  => 'Add Chapter',
					'edit_item'     => 'Edit Chapter',
				),
				'public'              => false,
				'publicly_queryable'  => false,
				'exclude_from_search' => true,
				'show_ui'             => true,
				'show_in_menu'        => 'users.php',
				'show_in_rest'        => false,
				'show_in_graphql'     => false,
				'has_archive'         => false,
				'rewrite'             => false,
				'query_var'           => false,
				'supports'            => array( 'title' ),
				'capability_type'     => 'post',
				'capabilities'        => array(
					'edit_posts'         => Roles::MANAGE_MEMBERS,
					'edit_others_posts'  => Roles::MANAGE_MEMBERS,
					'publish_posts'      => Roles::MANAGE_MEMBERS,
					'read_private_posts' => Roles::MANAGE_MEMBERS,
					'delete_posts'       => Roles::MANAGE_MEMBERS,
					'create_posts'       => Roles::MANAGE_MEMBERS,
				),
				'map_meta_cap'        => true,
			)
		);
	}

	public static function exists( int $chapter_id ): bool {
		$post = get_post( $chapter_id );
		return $post && self::POST_TYPE === $post->post_type && 'trash' !== $post->post_status;
	}

	/** @return array{id:int,name:string}|null */
	public static function summary( int $chapter_id ): ?array {
		if ( ! $chapter_id || ! self::exists( $chapter_id ) ) {
			return null;
		}
		return array(
			'id'   => $chapter_id,
			'name' => get_the_title( $chapter_id ),
		);
	}
}
