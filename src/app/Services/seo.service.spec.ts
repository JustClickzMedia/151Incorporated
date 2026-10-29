import { TestBed, inject } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';

import { META_TAGS_TO_REMOVE, SeoService } from './seo.service';

describe('SeoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeoService]
    });
  });

  it('should be created', inject([SeoService], (service: SeoService) => {
    expect(service).toBeTruthy();
  }));

  it('removeMetaTags() removes what addMetaTags()/setTitle() added, so navigations do not duplicate tags', () => {
    const seo = TestBed.inject(SeoService);
    const meta = TestBed.inject(Meta);
    const count = (sel: string) => meta.getTags(sel).length;
    for (let i = 0; i < 3; i++) {
      seo.removeMetaTags();
      seo.addMetaTags();
      seo.setTitle('Page ' + i);
    }
    expect(count('name="author"')).toBe(1);
    expect(count('name="date"')).toBe(1);
    expect(count('http-equiv="Content-Type"')).toBe(1);
    expect(count('property="og:type"')).toBe(1);
    expect(count('property="og:title"')).toBe(1);
    expect(meta.getTag('property="og:title"')?.content).toBe('Page 2');
  });

  it('uses selectors without spaces around "=" (the SSR DOM throws on them)', () => {
    for (const selector of META_TAGS_TO_REMOVE) {
      expect(selector).not.toMatch(/\s=|=\s/);
    }
    expect(() => TestBed.inject(DOCUMENT).querySelector('meta[' + META_TAGS_TO_REMOVE[2] + ']')).not.toThrow();
  });
});
