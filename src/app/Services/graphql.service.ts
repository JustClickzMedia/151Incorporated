import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/** GraphQL endpoint (environment.graphqlUrl). A token so tests can override it. */
export const GRAPHQL_URL = new InjectionToken<string>('GRAPHQL_URL', {
  providedIn: 'root',
  factory: () => environment.graphqlUrl,
});

export interface GraphqlErrorItem { message: string; path?: (string | number)[] }
interface GraphqlResponse<T> { data?: T | null; errors?: GraphqlErrorItem[] }

/** A response with an `errors` array (or no `data`). Per the contract, any errors[] is a failure. */
export class GraphqlError extends Error {
  constructor(readonly errors: GraphqlErrorItem[]) {
    super('GraphQL error: ' + errors.map(e => e.message).join('; '));
    this.name = 'GraphqlError';
  }
}

/**
 * Thin GraphQL client: POST { query, variables } as JSON to the WPGraphQL endpoint.
 * Public, anonymous queries only — no Authorization header, no cookies (docs/graphql-contract.md section 6).
 */
@Injectable({ providedIn: 'root' })
export class GraphqlService {
  private http = inject(HttpClient);
  private url = inject(GRAPHQL_URL);

  query<T>(query: string, variables: Record<string, unknown> = {}): Observable<T> {
    return this.http.post<GraphqlResponse<T>>(this.url, { query, variables }, { withCredentials: false }).pipe(
      catchError((err: unknown) => {
        // HTTP 500 with a GraphQL errors body (e.g. a syntax error): surface it as a GraphqlError.
        const body = err instanceof HttpErrorResponse ? err.error : undefined;
        return throwError(() => (Array.isArray(body?.errors) && body.errors.length ? new GraphqlError(body.errors) : err));
      }),
      map(res => {
        if (res?.errors?.length) { throw new GraphqlError(res.errors); }
        if (res?.data == null) { throw new GraphqlError([{ message: 'Response has no data' }]); }
        return res.data;
      })
    );
  }
}
