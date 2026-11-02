/** GraphQL operations of the members portal (docs/members-portal/ANGULAR-INTEGRATION.md §4). */

const CHAPTER = 'chapter { id name }';
const MEMBER_FULL = `id displayName email membershipNumber status classification ${CHAPTER}
  joinedYear phone address1 address2 city state postalCode bio line isActive`;

export const MY_PROFILE = `query MyProfile { currentMember { ${MEMBER_FULL} } myMemberVisibility { field audience } }`;

export const SAVE_PROFILE = `mutation SaveProfile($input: UpdateMyMemberProfileInput!) {
  updateMyMemberProfile(input: $input) { member { ${MEMBER_FULL} } } }`;

export const DIRECTORY = `query Directory($first: Int, $offset: Int, $search: String) {
  memberDirectory(first: $first, offset: $offset, search: $search) {
    total nodes { id displayName ${CHAPTER} joinedYear isActive email phone city state } } }`;

export const BROTHER = `query Brother($id: Int!) { memberProfile(id: $id) {
  id displayName ${CHAPTER} joinedYear isActive email phone address1 address2 city state postalCode bio line classification } }`;

const EVENT_FIELDS = `id title contentHtml startsAt endsAt location isVirtual virtualUrl meetingId passcode imageUrl audience ${CHAPTER}`;
export const EVENTS = `query Events($first: Int, $offset: Int, $includePast: Boolean) {
  memberEvents(first: $first, offset: $offset, includePast: $includePast) { total nodes { ${EVENT_FIELDS} } } }`;
export const EVENT = `query Event($id: Int!) { memberEvent(id: $id) { ${EVENT_FIELDS} } }`;

const ANNOUNCEMENT_FIELDS = `id title contentHtml date expiresOn pinned audience ${CHAPTER}`;
export const ANNOUNCEMENTS = `query Announcements($first: Int, $offset: Int) {
  memberAnnouncements(first: $first, offset: $offset) { total nodes { ${ANNOUNCEMENT_FIELDS} } } }`;

export const RESOURCES = `query Resources($first: Int, $offset: Int, $category: String) {
  memberResources(first: $first, offset: $offset, category: $category) {
    total nodes { id title descriptionHtml category fileName fileSize mimeType downloadUrl updatedAt } } }`;

/** Dashboard: everything in one request. */
export const DASHBOARD = `query Dashboard {
  memberAnnouncements(first: 3) { total nodes { ${ANNOUNCEMENT_FIELDS} } }
  memberEvents(first: 3) { total nodes { ${EVENT_FIELDS} } } }`;
