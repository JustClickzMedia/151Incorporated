/**
 * Caption button for each WordPress carousel item, keyed by the item's WordPress ID (databaseId).
 * The "Homepage Carousel" type has no link/button field yet, so the links live here for now.
 * TODO(backend): add ACF fields (button label + page slug) to the carousel type, then read them from GraphQL
 * and delete this map.
 * Labels match the live site (the unmerged Nav-changes design); links use page slugs.
 */
export const CAROUSEL_LINKS: Record<number, { label: string; slug: string }> = {
  107: { label: 'Learn About 1-5-1', slug: 'about-1-5-1' },          // "Brothers of 1-5-1" (Bismarck Hotel)
  106: { label: 'Learn About Our Scholarship', slug: 'scholarship' }, // "The Michael J. Bryant Memorial Scholarship"
  105: { label: 'Learn About Membership', slug: 'membership' },       // "Membership Requirements"
};
