import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomemainimageComponent } from './homemainimage.component';

describe('HomemainimageComponent', () => {
  let component: HomemainimageComponent;
  let fixture: ComponentFixture<HomemainimageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomemainimageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HomemainimageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
