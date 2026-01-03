import { TestBed } from '@angular/core/testing';

import { StorageSync } from './storage-sync';

describe('StorageSync', () => {
  let service: StorageSync;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageSync);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
