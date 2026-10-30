import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * "Our History" band under the homepage carousel: the 1-5-1 shield beside a short history, over a faded
 * black-and-white brotherhood photo with maroon accent rules (layout inspired by a fraternity history banner
 * Kenneth shared; text summarised from the WordPress "1-5-1 History" page, which the link opens in full).
 * Shield left / text right from 768px; stacked and centred on phones.
 */
@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class HistoryComponent {}
