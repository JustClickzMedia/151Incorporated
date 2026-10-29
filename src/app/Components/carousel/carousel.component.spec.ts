import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CarouselComponent } from './carousel.component';

describe('CarouselComponent', () => {
  let component: CarouselComponent;
  let fixture: ComponentFixture<CarouselComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [CarouselComponent],
    providers: [provideRouter([])]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CarouselComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the History slide to the about-1-5-1 page by slug', () => {
    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'))
      .find(a => a.textContent?.includes('Bismarck Hotel'));
    expect(link?.getAttribute('href')).toBe('/pg/about-1-5-1');
  });
});
