import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Log an HTTP/stream error and continue with a fallback value.
 * Signals created with toSignal() re-throw stream errors when read, which would break
 * rendering; this keeps the previous async-pipe behaviour (error logged, section stays empty).
 */
export function withFallback<T>(fallback: T) {
  return (source: Observable<T>): Observable<T> =>
    source.pipe(catchError((err) => { console.error(err); return of(fallback); }));
}
