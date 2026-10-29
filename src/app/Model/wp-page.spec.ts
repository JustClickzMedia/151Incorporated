import { excerptFromContent, htmlToText, pageFromGraphql, pageFromRest } from './wp-page';

describe('wp-page mapping', () => {
  it('htmlToText strips tags and collapses whitespace', () => {
    expect(htmlToText('\n<p class="x">Hello <b>big</b>\n world</p>  ')).toBe('Hello big world');
    expect(htmlToText('<p>Founded in <b>1982</b>.</p><p>Next</p>')).toBe('Founded in 1982. Next');
    expect(htmlToText('a<br>b')).toBe('a b');
  });

  it('excerptFromContent keeps the first 55 words and adds [&hellip;] when longer', () => {
    const long = '<p>' + Array.from({ length: 60 }, (_, i) => 'w' + i).join(' ') + '</p>';
    const ex = excerptFromContent(long);
    expect(ex.startsWith('<p>w0 w1')).toBeTrue();
    expect(ex).toContain('w54 [&hellip;]</p>');
    expect(ex).not.toContain('w55');
    expect(excerptFromContent('<p>Short text.</p>')).toBe('<p>Short text.</p>');
    expect(excerptFromContent('')).toBe('');
  });

  it('pageFromRest falls back to the media source_url and builds an excerpt if REST has none', () => {
    const p = pageFromRest({ id: 1, slug: 's', title: { rendered: 'T' }, content: { rendered: '<p>Body</p>' },
      _embedded: { 'wp:featuredmedia': [{ source_url: 'https://x/a.jpg' }] } });
    expect(p.featuredImage).toEqual({ url: 'https://x/a.jpg', alt: '' });
    expect(p.excerptHtml).toBe('<p>Body</p>');
  });

  it('pageFromGraphql handles null title/content/image', () => {
    const p = pageFromGraphql({ databaseId: 2, slug: 's', title: null, date: null, content: null, featuredImage: null });
    expect(p).toEqual({ id: 2, slug: 's', title: '', contentHtml: '', excerptHtml: '', excerptText: '', date: '', featuredImage: undefined });
  });
});
