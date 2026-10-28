import { InjectionToken } from '@angular/core';
import { environment } from '../environments/environment';

/**
 * WordPress page slug shown in the homepage box. Defaults to environment.homepageSlug.
 * Empty string = no request (the homepage shows only its static sections).
 * TODO(homepage): set environment.homepageSlug once the homepage page is chosen.
 */
export const HOMEPAGE_SLUG = new InjectionToken<string>('HOMEPAGE_SLUG', {
  providedIn: 'root',
  factory: () => environment.homepageSlug,
});
