import { htmlToText } from './wp-page';

/**
 * One WordPress event (custom post type "events", GraphQL `event` / `events`).
 *
 * Event date, end date, time and location come from an optional ACF field group with the GraphQL name
 * `eventDetails` (fields `eventDate`, `eventEndDate`, `startTime`, `location`). Until that group exists,
 * events have no date: they are shown and never expire (see docs/events.md).
 */
export interface WpEvent {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  /** Plain-text summary (first ~40 words of the description). */
  summary: string;
  /** When the event was published in WordPress (ISO, site time). Used to pick the featured event. */
  publishedAt: string;
  /** Event day as YYYY-MM-DD (from ACF), if set. */
  startDate?: string;
  /** Last day as YYYY-MM-DD for multi-day events (from ACF), if set. */
  endDate?: string;
  time?: string;
  location?: string;
  image?: { url: string; alt: string; width?: number; height?: number };
}

interface GqlImage { node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null } | null }

/** GraphQL Event fields requested by the EVENTS / EVENT_BY_SLUG queries (eventDetails only when the ACF group exists). */
export interface GqlEvent {
  databaseId: number;
  slug: string;
  title: string | null;
  date: string | null;
  content: string | null;
  featuredImage: GqlImage | null;
  eventDetails?: { eventDate?: string | null; eventEndDate?: string | null; startTime?: string | null; location?: string | null } | null;
}

const SUMMARY_WORDS = 40;

/**
 * Normalise an ACF date to YYYY-MM-DD. WPGraphQL for ACF returns dates in different shapes depending on its
 * version and the field's return format: "20261115", "2026-11-15", "2026-11-15T00:00:00+00:00", "11/15/2026".
 * The calendar day is kept as written (no time-zone shift).
 */
export function parseEventDate(value: string | null | undefined): string | undefined {
  const v = (value ?? '').trim();
  if (!v) { return undefined; }
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v) ?? /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) { return valid(+m[1], +m[2], +m[3]); }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) { return valid(+m[3], +m[1], +m[2]); }
  const d = new Date(v);   // e.g. "November 15, 2026"
  return isNaN(d.getTime()) ? undefined : valid(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function valid(y: number, mo: number, d: number): string | undefined {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) { return undefined; }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function eventFromGraphql(e: GqlEvent): WpEvent {
  const img = e.featuredImage?.node;
  const words = htmlToText(e.content ?? '').split(' ').filter(Boolean);
  const startDate = parseEventDate(e.eventDetails?.eventDate);
  const endDate = parseEventDate(e.eventDetails?.eventEndDate);
  return {
    id: e.databaseId,
    slug: e.slug,
    title: e.title ?? '',
    contentHtml: e.content ?? '',
    summary: words.slice(0, SUMMARY_WORDS).join(' ') + (words.length > SUMMARY_WORDS ? '…' : ''),
    publishedAt: e.date ?? '',
    startDate,
    endDate: endDate && startDate && endDate > startDate ? endDate : undefined,
    time: e.eventDetails?.startTime?.trim() || undefined,
    location: e.eventDetails?.location?.trim() || undefined,
    image: img?.sourceUrl
      ? { url: img.sourceUrl, alt: img.altText || e.title || '', width: img.mediaDetails?.width ?? undefined, height: img.mediaDetails?.height ?? undefined }
      : undefined,
  };
}

/** YYYY-MM-DD for a local date. */
export function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** An event has expired once its last day (end date, else event date) is over. Events without a date never expire. */
export function isExpired(event: WpEvent, now: Date): boolean {
  const lastDay = event.endDate ?? event.startDate;
  return !!lastDay && lastDay < localDay(now);
}

export interface EventsSelection {
  /** The advertised event: the most recently published event that hasn't expired. */
  featured?: WpEvent;
  /** The other current events, soonest first (events without a date last, newest first). */
  others: WpEvent[];
}

export function selectEvents(events: WpEvent[], now: Date): EventsSelection {
  const active = events.filter(e => !isExpired(e, now));
  if (!active.length) { return { others: [] }; }
  const [featured, ...rest] = [...active].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const others = rest.sort((a, b) => {
    if (a.startDate && b.startDate) { return a.startDate.localeCompare(b.startDate); }
    if (a.startDate || b.startDate) { return a.startDate ? -1 : 1; }
    return b.publishedAt.localeCompare(a.publishedAt);
  });
  return { featured, others };
}

/** "Saturday, November 15, 2026" (or a range "November 15 – 16, 2026") for display; undefined without a date. */
export function formatEventDate(event: WpEvent): string | undefined {
  if (!event.startDate) { return undefined; }
  const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', opts);
  };
  if (!event.endDate) {
    return fmt(event.startDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  return fmt(event.startDate, { month: 'long', day: 'numeric' }) + ' – ' + fmt(event.endDate, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Short date for list badges: { month: "NOV", day: "15" }. */
export function eventBadge(event: WpEvent): { month: string; day: string } | undefined {
  if (!event.startDate) { return undefined; }
  const [y, m, d] = event.startDate.split('-').map(Number);
  return { month: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: String(d) };
}
