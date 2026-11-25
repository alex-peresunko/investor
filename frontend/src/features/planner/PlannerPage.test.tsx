import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import type { PurchasePlan } from '@/api/reportHooks';
import '@/i18n/i18n';

import { PlannerPage } from './PlannerPage';

const PLAN: PurchasePlan = {
  currency: 'UAH',
  period: 'year',
  start: '2026-12-01',
  end: '2029-11-30',
  coupons: [{ start: '2026-12-01', current: '800.00', with_plan: '1200.00' }],
  redemptions: [{ start: '2026-12-01', current: '0.00', with_plan: '8000.00' }],
  purchases: [
    {
      buy_date: '2026-11-25',
      isin: 'UA4000207518',
      name: 'OVDP 15.84% 05/2027',
      maturity_date: '2027-05-26',
      quantity: 8,
      price: '1050.00',
      cost: '8400.00',
      yield_rate: '0.1595',
      price_estimated: true,
      variable_rate: false,
      instrument_id: null,
    },
  ],
  invested: '8400.00',
  cash_left: '1600.00',
  candidates: 3,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows the purchases and asks again when the currency changes', async () => {
  const get = vi
    .spyOn(api, 'GET')
    .mockImplementation(async () => ({ data: PLAN, response: new Response() }) as never);
  render(
    <MantineProvider>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <PlannerPage />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );

  expect(await screen.findByText('UA4000207518')).toBeTruthy();
  expect(screen.getByText('chosen from 3 bonds')).toBeTruthy();
  expect(screen.getByText('no recent trade, at face value')).toBeTruthy();

  fireEvent.click(screen.getByText('USD'));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/v1/reports/plan', {
      params: { query: expect.objectContaining({ currency: 'USD', years: 3 }) },
    }),
  );
});
