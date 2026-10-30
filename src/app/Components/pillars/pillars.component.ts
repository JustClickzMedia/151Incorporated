import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faHandHoldingHeart, faUserGraduate, faUsers } from '@fortawesome/free-solid-svg-icons';

export interface Pillar {
  icon: IconDefinition;
  title: string;
  text: string;
  slug: string;
  linkLabel: string;
}

/**
 * Three icon columns under the homepage carousel (the layout of the richmondsigmas.org homepage, with
 * 1-5-1's own content, drawn from the History, Scholarship and Foundation pages in WordPress).
 * Three across from 768px up, stacked on phones.
 */
export const PILLARS: Pillar[] = [
  {
    icon: faUsers,
    title: 'Brotherhood',
    text: 'The Brothers of 1-5-1, Incorporated is a fraternity of men whose common bond is rooted in music, founded on March 6, 1982 at the Bismarck Hotel in Chicago by members of the Hampton University Concert Choir.',
    slug: 'about-1-5-1',
    linkLabel: 'Our History',
  },
  {
    icon: faUserGraduate,
    title: 'Scholarship',
    text: 'The Michael J. Bryant Memorial Scholarship honors our late brother by advancing higher education for musically inclined African-American young men in the Hampton Roads area of Virginia.',
    slug: 'scholarship',
    linkLabel: 'The Scholarship',
  },
  {
    icon: faHandHoldingHeart,
    title: 'Service',
    text: 'The Help Them We Will Foundation, our 501(c)(3) charitable arm established in 2017, supports the philanthropic and community service efforts of the Brotherhood.',
    slug: 'foundation',
    linkLabel: 'The Foundation',
  },
];

@Component({
  selector: 'app-pillars',
  templateUrl: './pillars.component.html',
  styleUrls: ['./pillars.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FontAwesomeModule],
})
export class PillarsComponent {
  readonly pillars = PILLARS;
}
