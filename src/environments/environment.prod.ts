export const environment = {
  production: true,
  // Production WordPress (docs/graphql-contract.md section 1). Public, anonymous endpoints only: no secrets here.
  // Do NOT call graphqlUrl until the backend confirms staging -> production promotion
  // (production still exposes the old type names allEvents / allHomepageCarousel).
  graphqlUrl: 'https://tzin.brothersof1-5-1.org/graphql',
  restUrl: 'https://tzin.brothersof1-5-1.org/wp-json/wp/v2/'
};
