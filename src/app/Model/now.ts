import { InjectionToken } from '@angular/core';

/** The current time, as a token so tests can fix "today" (used to hide expired events). */
export const NOW = new InjectionToken<() => Date>('NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
