import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SidbarpostsComponent } from './sidbarposts.component';

describe('SidbarpostsComponent', () => {
  let component: SidbarpostsComponent;
  let fixture: ComponentFixture<SidbarpostsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SidbarpostsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SidbarpostsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
