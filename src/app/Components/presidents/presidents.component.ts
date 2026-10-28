import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { CommonModule } from '@angular/common';
import { LinkcssPipe } from '../../Pipes/linkcss.pipe'
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-presidents',
    templateUrl: './presidents.component.html',
    styleUrls: ['./presidents.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CommonModule, LinkcssPipe, RouterLink]
})
export class PresidentsComponent {
  private wp = inject(WordpressService);

  // TODO(Task 2): page ID 13 doesn't exist; load the homepage by a configurable slug instead.
  readonly page = toSignal(this.wp.getPage(13).pipe(withFallback<any>(undefined)));
  readonly posts = toSignal(this.wp.getPosts().pipe(withFallback<any[]>([])), { initialValue: [] as any[] });
}
