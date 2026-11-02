export const environment = {
  production: true,
  // Production WordPress (docs/graphql-contract.md section 1). Public, anonymous endpoints only: no secrets here.
  // Production GraphQL now uses the same names as staging (homepageCarousels, events); checked 2026-10-30.
  graphqlUrl: 'https://tzin.brothersof1-5-1.org/graphql',
  restUrl: 'https://tzin.brothersof1-5-1.org/wp-json/wp/v2/',
  // TODO(homepage): Kenneth hasn't chosen the homepage yet. Set this to the WordPress page slug
  // (e.g. 'about-1-5-1'). Empty = don't request a page; the homepage shows only its static sections.
  homepageSlug: '',
  // Read pages, the menu and the homepage carousel through GraphQL, as on staging (REST stays as the fallback path).
  useGraphql: true,
  // Members area: the portal plugin on the production WordPress (cookie session; see ANGULAR-INTEGRATION.md).
  portalApiUrl: 'https://tzin.brothersof1-5-1.org',
  portalGraphqlUrl: 'https://tzin.brothersof1-5-1.org/graphql',
  // Members area live on production (portal plugin installed). Google sign-in shows only once
  // B151_GOOGLE_CLIENT_* are in production's wp-config.php; the button comes from the server's provider list.
  membersEnabled: true
};
