import { Injectable, InjectionToken, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GraphqlError, GraphqlErrorItem } from '../graphql.service';
import { PortalErrorBody, SessionMember, SessionResponse } from './portal.models';

export interface PortalConfig { apiUrl: string; graphqlUrl: string }

/** Where the portal lives (environment.portalApiUrl / portalGraphqlUrl). A token so tests can override it. */
export const PORTAL_CONFIG = new InjectionToken<PortalConfig>('PORTAL_CONFIG', {
  providedIn: 'root',
  factory: () => ({ apiUrl: environment.portalApiUrl, graphqlUrl: environment.portalGraphqlUrl }),
});

/** A failed portal request, with the server's code and a message that is safe to show. */
export class PortalError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly signInUrl?: string) {
    super(message);
    this.name = 'PortalError';
  }
}

const GENERIC = 'Something went wrong. Please try again in a moment.';

function toPortalError(err: unknown): PortalError {
  if (err instanceof PortalError) { return err; }
  if (err instanceof HttpErrorResponse) {
    const body = (err.error ?? {}) as PortalErrorBody;
    const message = err.status === 0 ? 'Can\'t reach the member area right now. Check your connection and try again.'
      : body.message || GENERIC;
    return new PortalError(err.status, body.code ?? 'http_' + err.status, message, body.data?.sign_in_url);
  }
  return new PortalError(0, 'unknown', GENERIC);
}

/**
 * The only place that talks to the members portal. The session lives in WordPress's HttpOnly cookies; this service
 * keeps just the short-lived WordPress nonce in memory (never in storage) and sends it as X-WP-Nonce.
 * Nothing here runs during server-side rendering.
 */
@Injectable({ providedIn: 'root' })
export class PortalApiService {
  private http = inject(HttpClient);
  private cfg = inject(PORTAL_CONFIG);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly nonce = signal<string | null>(null);
  readonly member = signal<SessionMember | null>(null);
  readonly signedIn = computed(() => this.member() !== null);
  /** Server's idle limit and when the session ends if nothing happens (ms since epoch). */
  readonly idleLimitSeconds = signal(30 * 60);
  readonly warningSeconds = signal(120);
  readonly idleDeadline = signal<number | null>(null);
  readonly absoluteDeadline = signal<number | null>(null);
  readonly adminSession = signal(false);
  /** True once the first session check has finished (signed in or not). */
  readonly checked = signal(false);

  private pending$: Observable<boolean> | null = null;

  private get rest(): string { return this.cfg.apiUrl.replace(/\/+$/, '') + '/wp-json/b151/v1'; }

  /** Session check, done once per page load (later calls reuse the answer). */
  ensureSession(): Observable<boolean> {
    if (!this.browser) { return of(false); }
    if (this.checked()) { return of(this.signedIn()); }
    if (!this.pending$) {
      this.pending$ = this.refresh(false).pipe(
        map(() => this.signedIn()),
        catchError(() => { this.checked.set(true); return of(false); }),
        finalize(() => { this.pending$ = null; }),
        shareReplay(1),
      );
    }
    return this.pending$;
  }

  /**
   * GET /session. `passive` reads the session without extending it (the idle-warning check);
   * a normal call counts as activity.
   */
  refresh(passive = false): Observable<SessionResponse> {
    const headers = passive ? new HttpHeaders({ 'X-B151-Activity': 'passive' }) : undefined;
    return this.http.get<SessionResponse>(`${this.rest}/session`, { withCredentials: true, headers }).pipe(
      tap(r => this.apply(r)),
      catchError(err => throwError(() => toPortalError(err))),
    );
  }

  signIn(username: string, password: string): Observable<SessionMember> {
    return this.http.post<SessionResponse>(`${this.rest}/session`, { username, password }, { withCredentials: true }).pipe(
      catchError(err => throwError(() => toPortalError(err))),
      tap(r => this.apply(r)),
      map(r => {
        if (!r.authenticated) { throw new PortalError(401, 'b151_invalid_login', GENERIC); }
        return r.member;
      }),
    );
  }

  signOut(): Observable<void> {
    const done = () => this.clear();
    return this.http.delete(`${this.rest}/session`, { withCredentials: true, headers: this.nonceHeaders() }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)), // signed out locally either way
      tap(done),
    );
  }

  /** Forget the session in this tab (after an idle timeout or a "not signed in" answer). */
  clear(): void {
    this.nonce.set(null);
    this.member.set(null);
    this.idleDeadline.set(null);
    this.absoluteDeadline.set(null);
    this.adminSession.set(false);
    this.checked.set(true);
  }

  requestPasswordReset(email: string): Observable<string> {
    return this.http.post<{ message: string }>(`${this.rest}/session/password-reset`, { email }, { withCredentials: true }).pipe(
      map(r => r.message),
      catchError(err => throwError(() => toPortalError(err))),
    );
  }

  confirmPasswordReset(login: string, key: string, password: string): Observable<string> {
    return this.http.post<{ message: string }>(`${this.rest}/session/password-reset/confirm`, { login, key, password }, { withCredentials: true }).pipe(
      map(r => r.message),
      catchError(err => throwError(() => toPortalError(err))),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.withNonceRetry(() => this.http.post<SessionResponse>(`${this.rest}/session/password`,
      { current_password: currentPassword, new_password: newPassword }, { withCredentials: true, headers: this.nonceHeaders() })).pipe(
      tap(r => this.apply(r)), // other devices are signed out; this browser gets a fresh session + nonce
      map(() => undefined),
    );
  }

  providers(): Observable<{ id: string; label: string }[]> {
    if (!this.browser) { return of([]); }
    return this.http.get<{ providers: { id: string; label: string }[] }>(`${this.rest}/oauth/providers`).pipe(
      map(r => r.providers ?? []),
      catchError(() => of([])),
    );
  }

  /** Full-page address that starts "Sign in with Google/Microsoft" (or links it when `link` is true). */
  oauthStartUrl(provider: string, returnPath = '/members', link = false): string {
    const params = new URLSearchParams({ return: returnPath });
    if (link) { params.set('mode', 'link'); }
    return `${this.rest}/oauth/${encodeURIComponent(provider)}/start?${params.toString()}`;
  }

  /** Member GraphQL: cookies + X-WP-Nonce. Errors in the response become a GraphqlError. */
  graphql<T>(query: string, variables: Record<string, unknown> = {}): Observable<T> {
    if (!this.browser) { return throwError(() => new PortalError(0, 'server', GENERIC)); }
    return this.withNonceRetry(() => this.http.post<{ data?: T | null; errors?: GraphqlErrorItem[] }>(
      this.cfg.graphqlUrl, { query, variables }, { withCredentials: true, headers: this.nonceHeaders() })).pipe(
      tap(() => this.touch()),
      map(res => {
        if (res?.errors?.length) { throw new GraphqlError(res.errors); }
        if (res?.data == null) { throw new GraphqlError([{ message: 'Response has no data' }]); }
        return res.data;
      }),
    );
  }

  /**
   * An expired nonce (403) gets one retry after fetching a fresh one. If the session itself is gone, the member is
   * signed out locally and the error is passed on.
   */
  private withNonceRetry<T>(send: () => Observable<T>): Observable<T> {
    return send().pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 403 && this.nonce()) {
          return this.refresh(false).pipe(
            switchMap(r => r.authenticated ? send() : throwError(() => new PortalError(401, 'b151_not_signed_in', 'Please sign in again.'))),
          );
        }
        return throwError(() => err);
      }),
      catchError((err: unknown) => {
        const e = err instanceof GraphqlError ? err : toPortalError(err);
        if (e instanceof PortalError && e.status === 401) { this.clear(); }
        return throwError(() => e);
      }),
    );
  }

  private nonceHeaders(): HttpHeaders {
    const n = this.nonce();
    return n ? new HttpHeaders({ 'X-WP-Nonce': n }) : new HttpHeaders();
  }

  /** A successful normal request counts as activity on the server: move the idle deadline. */
  private touch(): void {
    if (this.signedIn()) { this.idleDeadline.set(Date.now() + this.idleLimitSeconds() * 1000); }
  }

  private apply(r: SessionResponse): void {
    this.checked.set(true);
    if (!r.authenticated) { this.clear(); return; }
    this.nonce.set(r.nonce);
    this.member.set(r.member);
    this.idleLimitSeconds.set(r.idle_limit_seconds || 30 * 60);
    this.warningSeconds.set(r.warning_seconds || 120);
    this.idleDeadline.set(Date.now() + (r.idle_seconds_remaining ?? r.idle_limit_seconds) * 1000);
    this.absoluteDeadline.set(r.expires_at ? Date.parse(r.expires_at) : null);
    this.adminSession.set(!!r.admin_session);
  }
}
