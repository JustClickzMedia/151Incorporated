/** The favicon is the 1-5-1 shield, served from this site (not the old WordPress favicon). */
describe('favicon', () => {
  it('serves the shield favicon files from the site', async () => {
    for (const path of ['/favicon.ico', '/assets/icons/favicon-32.png', '/assets/icons/icon-192.png', '/assets/icons/apple-touch-icon.png']) {
      const res = await fetch(path);
      expect(res.status).withContext(path).toBe(200);
    }
  });
});
