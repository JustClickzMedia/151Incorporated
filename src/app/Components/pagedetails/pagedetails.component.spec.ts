import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PagedetailsComponent } from './pagedetails.component';

describe('PagedetailsComponent', () => {
  let component: PagedetailsComponent;
  let fixture: ComponentFixture<PagedetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [PagedetailsComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PagedetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
