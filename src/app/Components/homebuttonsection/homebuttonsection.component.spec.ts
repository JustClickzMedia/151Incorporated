import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomebuttonsectionComponent } from './homebuttonsection.component';

describe('HomebuttonsectionComponent', () => {
  let component: HomebuttonsectionComponent;
  let fixture: ComponentFixture<HomebuttonsectionComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [HomebuttonsectionComponent],
    providers: [provideRouter([])]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HomebuttonsectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the buttons to page slugs (no page IDs)', () => {
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/pg/membership', '/pg/president', '/pg/scholarship']);
  });
});
