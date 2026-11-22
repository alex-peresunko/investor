import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import type { MarketAuction, MarketBond } from '@/api/marketHooks';
import '@/i18n/i18n';

import { MarketBondPage } from './MarketBondPage';
import { MarketPage } from './MarketPage';

const quote = {
  day: '2026-11-19',
  deals: 12,
  volume_uah: '34600000',
  volume_free_uah: '18500000',
  price_uah: '1020.79',
  dirty_price: '102.0790',
  clean_price: '99.8812',
  yield_avg: '0.159535',
  yield_min: '0.148997',
  yield_max: '0.167628',
};
const auction: MarketAuction = {
  day: '2026-11-17',
  number: '124',
  isin: 'UA4000207518',
  currency: 'UAH',
  settlement_date: '2026-11-18',
  maturity_date: '2027-05-26',
  bucket: '1y',
  yield_cutoff: '0.151',
  yield_avg: '0.1507',
  yield_min: '0.1499',
  yield_max: '0.152',
  bid: '1342845000',
  sold: '1092845000',
  raised: '1146435120.85',
  limit: '2000000000',
};
const bond: MarketBond = {
  isin: 'UA4000207518',
  name: 'OVDP 15.84% 05/2027',
  currency: 'UAH',
  face_value: '1000',
  coupon_rate: '0.1584',
  coupon_frequency: 2,
  variable_rate: false,
  issue_date: '2019-11-27',
  maturity_date: '2027-05-26',
  outstanding_bonds: 20000000,
  outstanding: '20000000000',
  outstanding_uah: '20000000000.00',
  market_share: '0.0101',
  next_payment_date: '2026-11-25',
  last_trade: quote,
  volume_30d_uah: '120000000',
  last_auction: auction,
  instrument_id: null,
};
const holderSlice = (holder: string, amount: string, share: string) => ({
  holder,
  amount,
  share,
  change_month: '-1000000000',
  change_year: '5000000000',
});
const byHolder = {
  nbu: '654754327439.88',
  banks: '901812718190.74',
  companies: '229132407810.62',
  communities: '155148000',
  individuals: '170897011758.35',
  non_residents: '18123388770.34',
  nominees: '0',
};

const RESPONSES: Record<string, unknown> = {
  '/api/v1/preferences': { language: 'en', deposit_rate: null, demo: false },
  '/api/v1/market/bonds': {
    trades_as_of: '2026-11-19',
    outstanding_uah: '1975956577585.00',
    bonds: [bond, { ...bond, isin: 'UA4000236541', currency: 'USD', last_auction: null }],
  },
  '/api/v1/market/bonds/{isin}': {
    bond,
    schedule: [
      { kind: 'coupon', pay_date: '2027-05-26', amount_per_unit: '79.20' },
      { kind: 'redemption', pay_date: '2027-05-26', amount_per_unit: '1000' },
    ],
    trades: [{ ...quote, day: '2026-11-18', clean_price: '99.8' }, quote],
    auctions: [auction],
  },
  '/api/v1/market/holders': {
    day: '2026-11-20',
    month_base_day: '2026-10-30',
    year_base_day: '2025-12-31',
    groups: [
      {
        group: 'all',
        total: '1974875001969.92',
        change_month: '-8542140657.50',
        change_year: '10408549643.10',
        holders: [
          holderSlice('nbu', '654754327439.88', '0.3315'),
          holderSlice('banks', '901812718190.74', '0.4566'),
          holderSlice('individuals', '170897011758.35', '0.0865'),
        ],
      },
    ],
    history: [
      { day: '2025-12-31', group: 'all', total: '1960000000000', by_holder: byHolder },
      { day: '2026-11-20', group: 'all', total: '1974875001969.92', by_holder: byHolder },
    ],
  },
  '/api/v1/market/repayments': [
    {
      pay_date: '2026-11-25',
      isin: 'UA4000207518',
      name: 'OVDP 15.84% 05/2027',
      currency: 'UAH',
      kind: 'coupon',
      amount: '1584000000',
      amount_uah: '1584000000',
    },
    {
      pay_date: '2027-05-26',
      isin: 'UA4000207518',
      name: 'OVDP 15.84% 05/2027',
      currency: 'UAH',
      kind: 'redemption',
      amount: '20000000000',
      amount_uah: '20000000000',
    },
  ],
  '/api/v1/market/auctions': [auction],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  vi.spyOn(api, 'GET').mockImplementation(
    async (route: string) => ({ data: RESPONSES[route], response: new Response() }) as never,
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/market" element={<MarketPage />} />
            <Route path="/market/:isin" element={<MarketBondPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

it('shows the headline and every tab', async () => {
  renderAt('/market');

  // The headline and the table footer both count the bonds.
  expect(await screen.findAllByText('2 bonds')).toHaveLength(2);
  expect(await screen.findAllByText('UA4000236541')).toHaveLength(1);
  expect(screen.getByText('Yield curve')).toBeTruthy();

  fireEvent.click(screen.getByRole('tab', { name: 'Holders' }));
  expect(await screen.findByText('Holders over time')).toBeTruthy();
  expect(screen.getAllByText('Banks').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('tab', { name: 'Repayments' }));
  expect(await screen.findByText('Coupons and redemptions due')).toBeTruthy();

  fireEvent.click(screen.getByRole('tab', { name: 'Auctions' }));
  expect(await screen.findByText('1 auction in the last year')).toBeTruthy();
});

it('shows a bond with its price, auctions and remaining payments', async () => {
  renderAt('/market/UA4000207518');

  expect(await screen.findByText('OVDP 15.84% 05/2027')).toBeTruthy();
  expect(screen.getByText('Add to my bonds')).toBeTruthy();
  expect(screen.getByText('Primary auctions in the last year')).toBeTruthy();
  expect(screen.getByText('Remaining payments')).toBeTruthy();
  expect(screen.getAllByText('99,88').length).toBeGreaterThan(0);
});
