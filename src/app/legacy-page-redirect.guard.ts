import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WordpressService } from './Services/wordpress.service';

/**
 * Old page links were /pg/<id>/<title> (e.g. /pg/19/1-5-1 History). Pages are now addressed by slug,
 * so this looks the ID up once and redirects to /pg/<slug>, replacing the old URL in history.
 * Unknown IDs (such as page 13) show the 404 view while keeping the requested URL in the address bar.
 */
export const legacyPageRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const wp = inject(WordpressService);
  const notFound = new RedirectCommand(router.parseUrl('/404'), { skipLocationChange: true });

  const id = Number(route.paramMap.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return notFound;
  }

  return wp.getPageSlugById(id).pipe(
    map(slug => slug
      ? new RedirectCommand(router.createUrlTree(['/pg', slug]), { replaceUrl: true })
      : notFound),
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse && err.status === 404)) {
        console.error(err);
      }
      return of(notFound);
    })
  );
};
