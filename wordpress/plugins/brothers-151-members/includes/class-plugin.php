<?php
namespace B151\Members;

/**
 * Wires the modules together. Each module registers its own hooks in `register()`.
 */
final class Plugin {

	private static bool $booted = false;

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;

		Installer::maybe_upgrade();

		Chapters::register();
		Membership::register();
		Sessions::register();
		Backend_Gate::register();
		Two_Factor_Enforcement::register();
		Cors::register();
		Cache_Headers::register();
		Session_Api::register();
		Oauth::register();
		Graphql::register();
		Admin::register();
	}
}
