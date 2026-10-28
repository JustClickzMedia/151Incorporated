import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PagenotfoundComponent } from './pagenotfound.component';

describe('PagenotfoundComponent', () => {
  let component: PagenotfoundComponent;
  let fixture: ComponentFixture<PagenotfoundComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [PagenotfoundComponent],
    providers: [provideRouter([])]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PagenotfoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
