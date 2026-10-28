// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Staging WordPress (docs/graphql-contract.md section 1). Public, anonymous endpoints only: no secrets here.
  graphqlUrl: 'https://tzin.brothersof1-5-1.org/staging/1848/graphql',
  restUrl: 'https://tzin.brothersof1-5-1.org/staging/1848/wp-json/wp/v2/',
  // TODO(homepage): Kenneth hasn't chosen the homepage yet. Set this to the WordPress page slug
  // (e.g. 'about-1-5-1'). Empty = don't request a page; the homepage shows only its static sections.
  homepageSlug: ''
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
