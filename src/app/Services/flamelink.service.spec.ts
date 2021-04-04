import { TestBed } from '@angular/core/testing';

import { FlamelinkService } from './flamelink.service';

describe('FlamelinkService', () => {
  let service: FlamelinkService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlamelinkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
