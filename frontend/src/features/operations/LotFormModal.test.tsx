import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import type { Lot } from '@/api/types';
import '@/i18n/i18n';

import { LotFormModal } from './LotFormModal';

const EUR_BOND = {
  id: 3,
  kind: 'bond',
  isin: 'UA4000236723',
  name: 'OVDP EUR 3.10% 2027',
  currency: 'EUR',
  face_value: '1000.00',
  coupon_rate: '0.031000',
  coupon_frequency: 2,
  issue_date: '2025-06-01',
  maturity_date: '2027-06-01',
};

const LOT: Lot = {
  id: 9,
  instrument_id: 3,
  trade_date: '2026-01-10',
  quantity: '5.000000',
  price_per_unit: '1000.000000',
  total_cost: '5000.00',
  accrued_paid: '0.00',
  fee: '0.00',
  fx_rate: '42.100000',
  currency_rate: '48.900000',
  note: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows amounts in the bond currency and saves the EUR/UAH rate', async () => {
  vi.spyOn(api, 'GET').mockImplementation(async (path: string) => {
    const data = path === '/api/v1/instruments' ? [EUR_BOND] : [];
    return { data, response: new Response() } as never;
  });
  const put = vi
    .spyOn(api, 'PUT')
    .mockImplementation(async () => ({ data: LOT, response: new Response() }) as never);
  render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={new QueryClient()}>
        <LotFormModal lot={LOT} onClose={() => {}} />
      </QueryClientProvider>
    </MantineProvider>,
  );

  expect(await screen.findByText('Total cost, EUR')).toBeTruthy();
  expect(screen.getByText('EUR/UAH rate')).toBeTruthy();
  expect(screen.getByDisplayValue('48,9')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(put).toHaveBeenCalled());
  const [, options] = put.mock.calls[0] as unknown as [string, { body: object }];
  const body = options.body;
  expect(body).toMatchObject({ total_cost: '5000', currency_rate: '48.9', fx_rate: '42.1' });
});
