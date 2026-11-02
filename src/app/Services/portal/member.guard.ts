import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { PortalApiService } from './portal-api.service';

/**
 * Member pages need a signed-in member; otherwise go to the sign-in page and come back afterwards.
 * Convenience only: the server checks every request. On the server (prerender) nothing is loaded.
 */
export const memberGuard: CanActivateFn = (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) { return true; }
  const api = inject(PortalApiService);
  const router = inject(Router);
  return api.ensureSession().pipe(
    map(ok => ok ? true : router.createUrlTree(['/members/sign-in'], { queryParams: { return: state.url } })),
  );
};

/** The sign-in page sends members who are already signed in straight to the member area. */
export const guestGuard: CanActivateFn = route => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) { return true; }
  const api = inject(PortalApiService);
  const router = inject(Router);
  return api.ensureSession().pipe(
    map(ok => ok ? router.parseUrl(safeReturn(route.queryParamMap.get('return'))) : true),
  );
};

/** Only paths inside the member area are allowed as "come back to" targets. */
export function safeReturn(path: string | null | undefined): string {
  return path && /^\/members(\/[A-Za-z0-9/_\-]*)?$/.test(path) && !path.startsWith('/members/sign-in') ? path : '/members';
}
