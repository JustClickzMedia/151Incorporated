import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { WordpressService } from '../../Services/wordpress.service';
import { withFallback } from '../../Services/rx-fallback';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-sidbarposts',
    templateUrl: './sidbarposts.component.html',
    styleUrls: ['./sidbarposts.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterLink, CommonModule]
})
export class SidbarpostsComponent {
  private wpService = inject(WordpressService);

  readonly posts = toSignal(this.wpService.getPosts().pipe(withFallback<any[]>([])), { initialValue: [] as any[] });
}
