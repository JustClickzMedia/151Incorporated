import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { EventsComponent } from '../events/events.component';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink, EventsComponent]
})
export class FooterComponent {
  private router = inject(Router);

  /** Copyright year (was hard-coded 2018). */
  readonly year = new Date().getFullYear();

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
    { initialValue: this.router.url }
  );

  /** Upcoming Events sits under the motto band on the homepage only. */
  readonly isHome = computed(() => this.url().split(/[?#]/)[0] === '/');
}
