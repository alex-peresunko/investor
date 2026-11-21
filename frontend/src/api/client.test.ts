import { afterEach, expect, it } from 'vitest';

import { i18n } from '@/i18n/i18n';

import { unwrap } from './client';

const failed =
  (error: unknown, status = 422) =>
  () =>
    unwrap({ error, response: new Response(null, { status }) });

afterEach(() => i18n.changeLanguage('en'));

it('translates a problem by its code and params', async () => {
  await i18n.changeLanguage('uk');
  const problem = {
    detail: 'Only 60 units are available in this package',
    code: 'sale_exceeds_available',
    params: { available: '60' },
  };
  expect(failed(problem)).toThrow('У цьому пакеті доступно лише 60 шт.');
});

it('falls back to the detail, then to the status', () => {
  expect(failed({ detail: 'Something new', code: 'unknown_code' })).toThrow('Something new');
  expect(failed({ detail: [{ msg: 'bad' }] }, 500)).toThrow('Request failed (500)');
});
