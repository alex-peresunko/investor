import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import '@/i18n/i18n';

import { MissedPaymentsTable } from './MissedPayments';

const MISSED = {
  pay_date: '2026-09-01',
  instrument_id: 7,
  isin: 'UA4000227045',
  name: 'OVDP 09/2027',
  kind: 'coupon',
  amount_per_unit: '82.500000',
  quantity: '100.000000',
  currency: 'UAH',
  expected: '8250.00',
};

const INSTRUMENT = {
  id: 7,
  kind: 'bond',
  isin: MISSED.isin,
  name: MISSED.name,
  currency: 'UAH',
  face_value: '1000.00',
  coupon_rate: '0.165000',
  coupon_frequency: 2,
  issue_date: '2025-03-05',
  maturity_date: '2027-09-01',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('opens a payment form prefilled from the missed payment', async () => {
  vi.spyOn(api, 'GET').mockImplementation(async (path: string) => {
    const data =
      path === '/api/v1/reports/missed'
        ? [MISSED]
        : path === '/api/v1/instruments'
          ? [INSTRUMENT]
          : [];
    return { data, response: new Response() } as never;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ rate: '41.2345' }), { status: 200 })),
  );
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <MissedPaymentsTable />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Record' }));

  expect(await screen.findByDisplayValue('UA4000227045 · OVDP 09/2027')).toBeTruthy();
  expect(screen.getByDisplayValue('01.09.2026')).toBeTruthy();
  expect(screen.getByDisplayValue('8 250')).toBeTruthy();
  expect(await screen.findByDisplayValue('41,2345')).toBeTruthy();
  expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/v1/fx/usd/2026-09-01');
});
