import createClient from 'openapi-fetch';

import type { paths } from './schema';

export const api = createClient<paths>({ baseUrl: '/' });

/** Error body returned by the backend for every domain error (RFC 7807 style). */
export interface Problem {
  title: string;
  status: number;
  detail: string;
}

/** Unwraps an openapi-fetch result: returns data, or throws an Error carrying the problem detail. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const problem = result.error as Partial<Problem> | undefined;
    throw new Error(problem?.detail ?? `Request failed (${result.response.status})`);
  }
  return result.data;
}
