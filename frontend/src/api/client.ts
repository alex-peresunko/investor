import createClient from 'openapi-fetch';

import { i18n } from '@/i18n/i18n';

import type { paths } from './schema';

export const api = createClient<paths>({ baseUrl: '/' });

/** Error body returned by the backend for every domain error (RFC 7807 style). */
export interface Problem {
  title: string;
  status: number;
  detail: string;
  /** Stable error identifier; the UI shows its `errors.<code>` translation. */
  code?: string;
  params?: Record<string, string>;
}

function problemMessage(problem: Partial<Problem> | undefined, status: number): string {
  const key = `errors.${problem?.code ?? ''}`;
  if (problem?.code && i18n.exists(key))
    return i18n.t(key as 'errors.request_failed', problem.params);
  if (typeof problem?.detail === 'string') return problem.detail;
  return i18n.t('errors.request_failed', { status });
}

/** Unwraps an openapi-fetch result: returns data, or throws an Error with the translated problem. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new Error(
      problemMessage(result.error as Partial<Problem> | undefined, result.response.status),
    );
  }
  return result.data;
}
