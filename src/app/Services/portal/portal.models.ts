/** Shapes returned by the members-portal plugin (wordpress/plugins/brothers-151-members). */

export interface PortalChapter { id: number; name: string }

/** The signed-in member, as returned by GET /wp-json/b151/v1/session. */
export interface SessionMember {
  id: number;
  display_name: string;
  email: string;
  membership_number: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  classification: 'member' | 'life_member' | 'honorary';
  chapter: PortalChapter | null;
  is_active: boolean;
  is_backend: boolean;
  /** For showing/hiding UI only — the server re-checks every action. */
  capabilities: string[];
}

export type SessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      nonce: string;
      member: SessionMember;
      idle_seconds_remaining: number;
      idle_limit_seconds: number;
      warning_seconds: number;
      expires_at: string | null;
      admin_session: boolean;
    };

/** A brother as seen by the viewer (GraphQL PortalMember). Fields the viewer may not see are null. */
export interface PortalMember {
  id: number | null;
  displayName: string | null;
  chapter: PortalChapter | null;
  joinedYear: string | null;
  isActive: boolean | null;
  membershipNumber?: string | null;
  status?: string | null;
  classification?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  bio?: string | null;
  line?: string | null;
}

export interface PortalList<T> { total: number; nodes: T[] }

export interface MemberEvent {
  id: number;
  title: string;
  contentHtml: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  isVirtual: boolean;
  virtualUrl: string | null;
  meetingId: string | null;
  passcode: string | null;
  imageUrl: string | null;
  audience: 'ALL' | 'CHAPTER';
  chapter: PortalChapter | null;
}

export interface Announcement {
  id: number;
  title: string;
  contentHtml: string;
  date: string;
  expiresOn: string | null;
  pinned: boolean;
  audience: 'ALL' | 'CHAPTER';
  chapter: PortalChapter | null;
}

export interface MemberResource {
  id: number;
  title: string;
  descriptionHtml: string;
  category: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  downloadUrl: string | null;
  updatedAt: string;
}

export interface Visibility { field: string; audience: 'members' | 'admins' }

/** Error from the portal REST API: `{ code, message, data: { status } }`. */
export interface PortalErrorBody { code?: string; message?: string; data?: { status?: number; sign_in_url?: string } }

/** Friendly messages for the `?error=` codes the Google/Microsoft sign-in can come back with. */
export const OAUTH_ERRORS: Record<string, string> = {
  provider_unavailable: 'That sign-in option isn\'t available right now. Please use your email and password.',
  too_many_attempts: 'Too many attempts. Please wait a few minutes and try again.',
  invalid_request: 'That sign-in link expired or was already used. Please try again.',
  cancelled: 'Sign-in was cancelled.',
  provider_error: 'We couldn\'t complete the sign-in with that account. Please try again or use your email and password.',
  no_account: 'No member account uses that address. Contact info@brothersof1-5-1.org for help.',
  not_active: 'Your membership isn\'t active yet. Contact info@brothersof1-5-1.org for help.',
  already_linked: 'That account is already linked to a different member.',
  sign_in_first: 'Please sign in first, then link your account from My profile.',
};

/** Fields a brother may choose to share with other members (default: admins only). */
export const SHAREABLE_FIELDS: { field: string; label: string }[] = [
  { field: 'email', label: 'email address' },
  { field: 'phone', label: 'phone number' },
  { field: 'address', label: 'mailing address' },
  { field: 'bio', label: '"About me" text' },
  { field: 'line', label: 'line' },
  { field: 'classification', label: 'membership classification' },
];
