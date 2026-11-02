<?php
namespace B151\Members;

/**
 * Plain-text emails to members when their membership changes (sent through FluentSMTP / wp_mail).
 * They never include passwords, links with secrets, or other members' data.
 */
final class Notifications {

	public static function register(): void {
		add_action( 'b151_status_changed', array( self::class, 'status_changed' ), 20, 3 );
	}

	public static function status_changed( int $user_id, string $old, string $new ): void {
		if ( ! Settings::get( 'notify_members' ) || $old === $new ) {
			return;
		}
		$user = get_userdata( $user_id );
		if ( ! $user || ! is_email( $user->user_email ) ) {
			return;
		}
		$message = self::message( $user_id, $old, $new );
		if ( ! $message ) {
			return;
		}
		$sent = wp_mail( $user->user_email, $message[0], $message[1] );
		Audit_Log::record( 'member_notified', 'user', $user_id, array( 'status' => $new, 'sent' => (bool) $sent ) );
	}

	/** @return array{0:string,1:string}|null subject and body */
	public static function message( int $user_id, string $old, string $new ): ?array {
		$name    = Membership::get_profile_value( $user_id, 'display_name' );
		$hello   = 'Brother ' . $name . ",\r\n\r\n";
		$sign_in = Settings::frontend_url( '/members' );
		$sig     = "\r\n\r\nIn brotherhood,\r\nThe Brothers of 1-5-1, Incorporated\r\n";

		if ( Membership::STATUS_ACTIVE === $new && Membership::STATUS_PENDING === $old ) {
			$number = Membership::get_number( $user_id );
			return array(
				'Your 1-5-1 member account is approved',
				$hello . "Your member account has been approved. You can now sign in to the member area:\r\n\r\n" . $sign_in
					. ( $number ? "\r\n\r\nYour membership number is " . $number . '. Keep it handy: it is used to check you in to virtual meetings.' : '' )
					. $sig,
			);
		}
		if ( Membership::STATUS_ACTIVE === $new ) {
			return array( 'Your 1-5-1 member access is active again', $hello . "Your member access has been restored. Sign in here:\r\n\r\n" . $sign_in . $sig );
		}
		if ( Membership::STATUS_SUSPENDED === $new || Membership::STATUS_INACTIVE === $new ) {
			return array(
				'Your 1-5-1 member access has changed',
				$hello . "Your access to the member area is currently paused. If you believe this is a mistake, please contact us at "
					. 'info@brothersof1-5-1.org.' . $sig,
			);
		}
		return null;
	}
}
