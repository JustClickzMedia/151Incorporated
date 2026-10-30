import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PillarsComponent } from './pillars.component';

describe('PillarsComponent', () => {
  let fixture: ComponentFixture<PillarsComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PillarsComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(PillarsComponent);
    fixture.detectChanges();
  });

  it('shows Brotherhood, Scholarship and Service, each with an icon, text and a link to its page', () => {
    const cols = Array.from(el().querySelectorAll('.pillars .col-12'));
    expect(cols.map(c => c.querySelector('h3')?.textContent?.trim())).toEqual(['Brotherhood', 'Scholarship', 'Service']);
    cols.forEach(c => {
      expect(c.querySelector('.pillar-icon svg')).not.toBeNull();
      expect(c.querySelector('p')?.textContent?.length).toBeGreaterThan(50);
    });
    expect(cols.map(c => c.querySelector('a')?.getAttribute('href'))).toEqual(['/pg/about-1-5-1', '/pg/scholarship', '/pg/foundation']);
  });

  it('is three across from 768px (col-md-4) and stacked on phones (col-12)', () => {
    Array.from(el().querySelectorAll('.pillars .row > div')).forEach(c => expect(c.className).toContain('col-12 col-md-4'));
  });
});
