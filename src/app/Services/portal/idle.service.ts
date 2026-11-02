import { DestroyRef, Injectable, NgZone, PLATFORM_ID, inject, signal, DOCUMENT } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { PortalApiService } from './portal-api.service';
import { NOW } from '../../Model/now';

/** How often the countdown is checked, and the most often a "still here" ping is sent while the member is active. */
export const IDLE_TICK_MS = 15_000;
export const KEEPALIVE_MS = 5 * 60_000;

/**
 * Idle sign-out (ARCHITECTURE.md §4.3; server limits: 30 min members, 15 min admin accounts, 12 h maximum).
 * - Real activity in the page (click, key, touch, scroll) is noted; while the member is active a normal session
 *   request is sent at most every 5 minutes, which extends the session on the server.
 * - The countdown uses the deadline the server gives. Two minutes before it, a warning appears; the server is asked
 *   with a *passive* request (doesn't extend anything) in case another tab kept the session alive.
 * - At zero the member is signed out here and sent to the sign-in page.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
  private api = inject(PortalApiService);
  private router = inject(Router);
  private zone = inject(NgZone);
  private doc = inject(DOCUMENT);
  private now = inject(NOW);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Seconds left before sign-out while the warning is showing; null when no warning. */
  readonly warningSecondsLeft = signal<number | null>(null);

  private lastActivity = 0;
  private lastKeepalive = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private checking = false;
  private readonly onActivity = () => { this.lastActivity = this.now().getTime(); };
  private static readonly EVENTS = ['click', 'keydown', 'touchstart', 'scroll', 'mousedown'];

  start(destroyRef?: DestroyRef): void {
    if (!this.browser || this.timer) { return; }
    const t = this.now().getTime();
    this.lastActivity = t;
    this.lastKeepalive = t;
    this.zone.runOutsideAngular(() => {
      for (const e of IdleService.EVENTS) { this.doc.addEventListener(e, this.onActivity, { passive: true, capture: true }); }
      this.timer = setInterval(() => this.zone.run(() => this.tick()), IDLE_TICK_MS);
    });
    destroyRef?.onDestroy(() => this.stop());
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    for (const e of IdleService.EVENTS) { this.doc.removeEventListener(e, this.onActivity, { capture: true }); }
    this.warningSecondsLeft.set(null);
  }

  /** "Stay signed in" on the warning: a normal request extends the session. */
  stayActive(): void {
    this.lastActivity = this.now().getTime();
    this.lastKeepalive = this.lastActivity;
    this.warningSecondsLeft.set(null);
    this.api.refresh(false).subscribe({ next: r => { if (!r.authenticated) { this.expire(); } }, error: () => {} });
  }

  /** One check of the countdown (runs every IDLE_TICK_MS; public for tests). */
  tick(): void {
    if (!this.api.signedIn()) { this.warningSecondsLeft.set(null); return; }
    const now = this.now().getTime();
    const deadline = Math.min(this.api.idleDeadline() ?? Infinity, this.api.absoluteDeadline() ?? Infinity);
    const left = Math.floor((deadline - now) / 1000);

    if (left <= 0) { this.expire(); return; }

    // Active since the last ping and it's been a while: tell the server (extends the idle deadline).
    if (this.lastActivity > this.lastKeepalive && now - this.lastKeepalive >= KEEPALIVE_MS && left > this.api.warningSeconds()) {
      this.lastKeepalive = now;
      this.api.refresh(false).subscribe({ next: r => { if (!r.authenticated) { this.expire(); } }, error: () => {} });
      return;
    }

    if (left <= this.api.warningSeconds()) {
      this.warningSecondsLeft.set(left);
      if (!this.checking) {
        // Another tab may have kept the session alive: ask without extending it.
        this.checking = true;
        this.api.refresh(true).subscribe({
          next: r => {
            this.checking = false;
            if (!r.authenticated) { this.expire(); return; }
            const fresh = Math.floor(((this.api.idleDeadline() ?? 0) - this.now().getTime()) / 1000);
            if (fresh > this.api.warningSeconds()) { this.warningSecondsLeft.set(null); }
          },
          error: () => { this.checking = false; },
        });
      }
    } else {
      this.warningSecondsLeft.set(null);
    }
  }

  private expire(): void {
    this.stop();
    this.api.clear();
    this.router.navigate(['/members/sign-in'], { queryParams: { reason: 'idle' } });
  }
}
