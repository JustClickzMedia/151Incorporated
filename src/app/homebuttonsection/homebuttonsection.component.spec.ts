import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HomebuttonsectionComponent } from './homebuttonsection.component';

describe('HomebuttonsectionComponent', () => {
  let component: HomebuttonsectionComponent;
  let fixture: ComponentFixture<HomebuttonsectionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HomebuttonsectionComponent ]
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
});
