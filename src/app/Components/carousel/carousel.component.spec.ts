import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CarouselComponent } from './carousel.component';
import { USE_GRAPHQL } from '../../Services/wordpress.service';
import { environment } from '../../../environments/environment';

const img = (file: string, alt = '') => ({ node: { sourceUrl: 'https://cms.test/staging/1848/' + file, altText: alt, mediaDetails: { width: 1024, height: 576 } } });
const item = (id: number, title: string, prefix: string) => ({
  databaseId: id, title, date: '2025-01-25T20:49:02',
  carouselSmallToLarge: {
    desktopLandscapeImage: img(prefix + '-dl.jpg'), desktopportraitImage: img(prefix + '-dp.jpg'),
    tabletlandscapeimage: img(prefix + '-tl.jpg'), tabletportraitimage: img(prefix + '-tp.jpg'),
    mobileLandscapeImage: img(prefix + '-ml.jpg'), mobileportraitimage: img(prefix + '-mp.jpg'),
  },
});

describe('CarouselComponent', () => {
  let fixture: ComponentFixture<CarouselComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const render = async () => { fixture.detectChanges(); await fixture.whenStable(); };
  const carouselRequest = () =>
    http.expectOne(r => r.method === 'POST' && r.url === environment.graphqlUrl && r.body?.query?.includes('homepageCarousels'));

  async function setup(useGraphql: boolean) {
    await TestBed.configureTestingModule({
      imports: [CarouselComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: USE_GRAPHQL, useValue: useGraphql }],
    }).compileComponents();
    fixture = TestBed.createComponent(CarouselComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  describe('GraphQL off (production until promotion)', () => {
    beforeEach(() => setup(false));

    it('makes no request and shows the built-in slides', async () => {
      http.expectNone(() => true);
      await render();
      expect(el().querySelectorAll('.carousel-item').length).toBe(5);
      expect(el().querySelectorAll('.carousel-item.active').length).toBe(1);
    });

    it('has one indicator per built-in slide (was 4 for 5 slides)', async () => {
      await render();
      expect(el().querySelectorAll('.carousel-indicators li').length).toBe(el().querySelectorAll('.carousel-item').length);
    });

    it('links the History slide to the about-1-5-1 page by slug', async () => {
      await render();
      const link = Array.from(el().querySelectorAll('a')).find(a => a.textContent?.includes('Bismarck Hotel'));
      expect(link?.getAttribute('href')).toBe('/pg/about-1-5-1');
    });
  });

  describe('GraphQL on (staging)', () => {
    beforeEach(() => setup(true));

    it('renders one slide per WordPress item, first one active, with indicators', async () => {
      carouselRequest().flush({ data: { homepageCarousels: { nodes: [
        item(107, 'Brothers of 1-5-1', 'bismarck'), item(106, 'Scholarship', '32years'), item(105, 'Membership', 'brotherhood'),
      ] } } });
      await render();
      const items = el().querySelectorAll('.carousel-item');
      expect(items.length).toBe(3);
      expect(items[0].classList).toContain('active');
      expect(items[1].classList).not.toContain('active');
      const indicators = Array.from(el().querySelectorAll('.carousel-indicators li'));
      expect(indicators.map(li => li.getAttribute('data-bs-slide-to'))).toEqual(['0', '1', '2']);
      expect(indicators[0].classList).toContain('active');
      expect(el().textContent).not.toContain('Bismarck Hotel'); // built-in slides are not shown
    });

    it('builds a <picture> with the five smaller sizes as <source>s and desktop landscape as the <img>', async () => {
      carouselRequest().flush({ data: { homepageCarousels: { nodes: [item(107, 'Brothers of 1-5-1', 'bismarck')] } } });
      await render();
      const picture = el().querySelector('.carousel-item picture')!;
      const sources = Array.from(picture.querySelectorAll('source'));
      expect(sources.map(s => s.getAttribute('srcset')!.split('/').pop())).toEqual(
        ['bismarck-mp.jpg', 'bismarck-ml.jpg', 'bismarck-tp.jpg', 'bismarck-tl.jpg', 'bismarck-dp.jpg']);
      expect(sources.every(s => !!s.getAttribute('media'))).toBeTrue();
      const image = picture.querySelector('img')!;
      expect(image.getAttribute('src')).toBe('https://cms.test/staging/1848/bismarck-dl.jpg');
      expect(image.getAttribute('alt')).toBe('Brothers of 1-5-1'); // altText is empty -> title
      expect(image.getAttribute('loading')).toBeNull(); // first slide is not lazy
    });

    it('lazy-loads slides after the first', async () => {
      carouselRequest().flush({ data: { homepageCarousels: { nodes: [item(1, 'A', 'a'), item(2, 'B', 'b')] } } });
      await render();
      const imgs = el().querySelectorAll('.carousel-item img');
      expect(imgs[1].getAttribute('loading')).toBe('lazy');
    });

    it('shows nothing while loading (no built-in images downloaded first)', async () => {
      await render();
      expect(el().querySelectorAll('.carousel-item').length).toBe(0);
      carouselRequest().flush({ data: { homepageCarousels: { nodes: [] } } });
    });

    it('falls back to the built-in slides when WordPress has no items', async () => {
      carouselRequest().flush({ data: { homepageCarousels: { nodes: [] } } });
      await render();
      expect(el().querySelectorAll('.carousel-item').length).toBe(5);
    });

    it('falls back to the built-in slides (and logs) on a GraphQL error', async () => {
      spyOn(console, 'error');
      carouselRequest().flush({ data: null, errors: [{ message: 'Cannot query field "homepageCarousels"' }] });
      await render();
      expect(el().querySelectorAll('.carousel-item').length).toBe(5);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
