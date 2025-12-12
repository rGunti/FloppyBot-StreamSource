import { TestBed } from '@angular/core/testing';

import { StreamSourceService } from './stream-source.service';

describe('StreamSourceService', () => {
  let service: StreamSourceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StreamSourceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
