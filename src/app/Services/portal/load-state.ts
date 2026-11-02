import { Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { GraphqlError } from '../graphql.service';
import { PortalError } from './portal-api.service';

/** loading → ready | error, for templates. */
export type Load<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** Plain accessors for templates: data / error message / loading. */
export function readyData<T>(s: Load<T>): T | null { return s.status === 'ready' ? s.data : null; }
export function errorOf<T>(s: Load<T>): string | null { return s.status === 'error' ? s.message : null; }

export function messageOf(err: unknown): string {
  if (err instanceof PortalError) { return err.message; }
  if (err instanceof GraphqlError) {
    // Server messages for member actions are written for people ("Type at least 2 letters to search.").
    const m = err.errors[0]?.message ?? '';
    return m && !/internal|syntax|cannot query/i.test(m) ? m : 'Something went wrong. Please try again in a moment.';
  }
  return 'Something went wrong. Please try again in a moment.';
}

export function loadState<T>(source: Observable<T>): Observable<Load<T>> {
  return source.pipe(
    map(data => ({ status: 'ready', data }) as Load<T>),
    catchError(err => of({ status: 'error', message: messageOf(err) } as Load<T>)),
    startWith({ status: 'loading' } as Load<T>),
  );
}

/** "Saturday, November 21, 2026 · 6:00 PM" in the visitor's time zone. */
export function formatWhen(startIso: string | null, endIso?: string | null): string {
  if (!startIso) { return ''; }
  const start = new Date(startIso);
  if (isNaN(start.getTime())) { return ''; }
  const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let out = `${day} · ${time(start)}`;
  if (endIso) {
    const end = new Date(endIso);
    if (!isNaN(end.getTime())) {
      out += end.toDateString() === start.toDateString() ? `–${time(end)}`
        : ` to ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} ${time(end)}`;
    }
  }
  return out;
}

export function formatSize(bytes: number | null): string {
  if (!bytes) { return ''; }
  if (bytes < 1024 * 1024) { return Math.max(1, Math.round(bytes / 1024)) + ' KB'; }
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
