import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NavbarComponent } from './navbar.component';
import { environment } from '../../../environments/environment';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(NavbarComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders a menu item per WordPress page', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed'))
      .flush([{ id: 2, slug: 'membership', title: { rendered: 'Membership' } },
              { id: 3, slug: 'moto', title: { rendered: 'Moto' } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.navbar-nav.mr-auto a'));
    expect(links.map(a => a.textContent?.trim())).toEqual(['MEMBERSHIP', 'MOTO']);
  });

  it('toggles the collapsed menu', async () => {
    http.expectOne(r => r.url.startsWith(environment.restUrl + 'pages?_embed')).flush([]);
    const collapse = () => (fixture.nativeElement as HTMLElement).querySelector('.navbar-collapse')!;
    fixture.detectChanges();
    expect(collapse().classList).not.toContain('show');
    fixture.componentInstance.toggleNavbar();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(collapse().classList).toContain('show');
  });
});
