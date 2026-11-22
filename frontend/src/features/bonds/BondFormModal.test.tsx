import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '@/api/client';
import '@/i18n/i18n';

import { BondFormModal } from './BondFormModal';

const SECURITY = {
  isin: 'UA4000236541',
  name: 'OVDP USD 4.17% 02/2027',
  currency: 'USD',
  face_value: '1000',
  coupon_rate: '0.041700',
  coupon_frequency: 2,
  issue_date: '2025-07-29',
  maturity_date: '2027-02-04',
  schedule: [
    { kind: 'coupon', pay_date: '2027-02-04', amount_per_unit: '20.85' },
    { kind: 'redemption', pay_date: '2027-02-04', amount_per_unit: '1000' },
  ],
  variable_rate: false,
};

const SUMMARY = {
  isin: SECURITY.isin,
  name: SECURITY.name,
  currency: 'USD',
  maturity_date: SECURITY.maturity_date,
  variable_rate: false,
};
const OTHER = { ...SUMMARY, isin: 'UA4000234567', name: 'OVDP 15.20% 05/2028', currency: 'UAH' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const isinField = () => screen.getByPlaceholderText('Search by ISIN or name');

function mockNbu() {
  return vi.spyOn(api, 'GET').mockImplementation(
    async (path: string) =>
      ({
        data: path === '/api/v1/securities' ? [SUMMARY, OTHER] : SECURITY,
        response: new Response(),
      }) as never,
  );
}

function renderForm() {
  render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={new QueryClient()}>
        <BondFormModal opened instrument={null} onClose={() => {}} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

it('fills a new bond from NBU and saves it with the NBU schedule', async () => {
  const get = mockNbu();
  const post = vi
    .spyOn(api, 'POST')
    .mockImplementation(async () => ({ data: {}, response: new Response() }) as never);
  renderForm();

  fireEvent.change(isinField(), { target: { value: 'ua4000236541' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fill in from the NBU bond list' }));

  expect(await screen.findByDisplayValue('OVDP USD 4.17% 02/2027')).toBeTruthy();
  expect(screen.getByText(/schedule of 2 payments/)).toBeTruthy();
  expect(get).toHaveBeenCalledWith('/api/v1/securities/{isin}', {
    params: { path: { isin: 'UA4000236541' } },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(post).toHaveBeenCalled());
  const [, options] = post.mock.calls[0] as unknown as [string, { body: object }];
  expect(options.body).toMatchObject({
    currency: 'USD',
    coupon_rate: '0.041700',
    coupon_frequency: 2,
    schedule: SECURITY.schedule,
  });
});

it('shows why the lookup failed on the ISIN field', async () => {
  vi.spyOn(api, 'GET').mockImplementation(async (path: string) =>
    path === '/api/v1/securities'
      ? ({ data: [], response: new Response() } as never)
      : ({
          error: { code: 'security_not_found', params: { isin: 'UA4000000000' } },
          response: new Response(null, { status: 404 }),
        } as never),
  );
  renderForm();

  fireEvent.change(isinField(), { target: { value: 'UA4000000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fill in from the NBU bond list' }));

  expect(await screen.findByText('NBU lists no bond UA4000000000')).toBeTruthy();
});

it('asks for the ISIN when the lookup is clicked on an empty field', async () => {
  const get = mockNbu();
  renderForm();

  fireEvent.click(screen.getByRole('button', { name: 'Fill in from the NBU bond list' }));

  expect(await screen.findByText('Type the ISIN first, then fill in from NBU')).toBeTruthy();
  expect(get).not.toHaveBeenCalledWith('/api/v1/securities/{isin}', expect.anything());
});

it('suggests NBU bonds by name and fills the picked one', async () => {
  const get = mockNbu();
  renderForm();
  await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/securities'));

  fireEvent.focus(isinField());
  fireEvent.change(isinField(), { target: { value: 'usd 4.17' } });
  const option = await screen.findByText('UA4000236541');
  expect(screen.queryByText('UA4000234567')).toBeNull();
  fireEvent.click(option);

  expect(await screen.findByDisplayValue('OVDP USD 4.17% 02/2027')).toBeTruthy();
  expect(get).toHaveBeenCalledWith('/api/v1/securities/{isin}', {
    params: { path: { isin: 'UA4000236541' } },
  });
});
