import { LinkcssPipe } from './linkcss.pipe';

describe('LinkcssPipe', () => {
  const pipe = new LinkcssPipe();

  it('appends a Continue Read More link to the page slug URL', () => {
    expect(pipe.transform('<p>Intro</p>', 'about-1-5-1'))
      .toBe('<p>Intro</p><a  href="/pg/about-1-5-1">Continue Read More...</a>');
  });

  it('URL-encodes the slug', () => {
    expect(pipe.transform('', 'a b/c')).toContain('href="/pg/a%20b%2Fc"');
  });
});
