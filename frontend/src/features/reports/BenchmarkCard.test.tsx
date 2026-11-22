import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import '@/i18n/i18n';

import { BenchmarkCard, toFraction } from './BenchmarkCard';

const row = (pnlUsd: string, pnlUah: string, xirr: string) => ({
  closing_value: { uah: '0.00', usd: '0.00' },
  pnl: { uah: pnlUah, usd: pnlUsd },
  xirr_uah: xirr,
  xirr_usd: xirr,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('converts a typed percent to the fraction the backend takes', () => {
  expect(toFraction(14.3)).toBe('0.1430');
  expect(toFraction('15.5')).toBe('0.1550');
  expect(toFraction('')).toBeNull();
  expect(toFraction(101)).toBeNull();
});

it('shows each alternative and recalculates when the rate changes', async () => {
  const get = vi.spyOn(api, 'GET').mockImplementation(async (path: string, init?: unknown) => {
    if (path === '/api/v1/preferences')
      return {
        data: { language: 'en', deposit_rate: '0.12', demo: false },
        response: new Response(),
      } as never;
    const rate = (init as { params: { query: { deposit_rate: string } } }).params.query
      .deposit_rate;
    return {
      data: {
        start: '2025-01-01',
        end: '2026-01-31',
        deposit_rate: rate,
        bonds: row('62.41', '5000.00', '0.05'),
        usd_cash: row('0.00', '2683.53', '0'),
        uah_deposit: row('-20.00', '12000.00', rate),
      },
      response: new Response(),
    } as never;
  });
  const patch = vi.spyOn(api, 'PATCH').mockImplementation(
    async () =>
      ({
        data: { language: 'en', deposit_rate: '0.1500', demo: false },
        response: new Response(),
      }) as never,
  );
  render(
    <MantineProvider env="test">
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BenchmarkCard period={{}} />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );

  expect(await screen.findByText('UAH deposit at 12,00 %')).toBeTruthy();
  expect(screen.getByText('US dollars in cash')).toBeTruthy();
  // Bonds ahead of the deposit: 62.41 - (-20.00) USD.
  expect(screen.getByText('+82,41 $')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('UAH deposit rate'), { target: { value: '15' } });

  expect(await screen.findByText('UAH deposit at 15,00 %')).toBeTruthy();
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith('/api/v1/preferences', {
      body: { deposit_rate: '0.1500' },
    }),
  );
  expect(get).toHaveBeenCalledWith('/api/v1/reports/benchmark', {
    params: { query: { deposit_rate: '0.1500' } },
  });
});
