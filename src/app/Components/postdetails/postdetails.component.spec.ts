import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PostdetailsComponent } from './postdetails.component';

describe('PostdetailsComponent', () => {
  let component: PostdetailsComponent;
  let fixture: ComponentFixture<PostdetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [PostdetailsComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PostdetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
