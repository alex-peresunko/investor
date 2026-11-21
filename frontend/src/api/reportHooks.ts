import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from './client';
import type { components } from './schema';

export type PortfolioReport = components['schemas']['PortfolioReport'];
export type LotReport = components['schemas']['LotReport'];
export type LotSummary = components['schemas']['LotSummary'];
export type PnlOut = components['schemas']['PnlOut'];
export type TimeseriesPoint = components['schemas']['TimeseriesPoint'];
export type UpcomingPayment = components['schemas']['UpcomingPayment'];

/** Empty fields mean "backend default": first purchase for start, today for end. */
export interface Period {
  start?: string;
  end?: string;
}

export function usePortfolioReport(period: Period) {
  return useQuery({
    queryKey: ['report', 'portfolio', period],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/reports/portfolio', { params: { query: period } })),
  });
}

export function useLotReport(lotId: number, period: Period) {
  return useQuery({
    queryKey: ['report', 'lot', lotId, period],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/reports/lots/{lot_id}', {
          params: { path: { lot_id: lotId }, query: period },
        }),
      ),
  });
}

export function useTimeseries(period: Period, lotId?: number) {
  return useQuery({
    queryKey: ['report', 'timeseries', period, lotId ?? null],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/reports/timeseries', {
          params: { query: { ...period, lot_id: lotId } },
        }),
      ),
  });
}

export function useUpcoming(months: number) {
  return useQuery({
    queryKey: ['report', 'upcoming', months],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/reports/upcoming', { params: { query: { months } } })),
  });
}

export type ReceivedPayment = components['schemas']['ReceivedPayment'];

export function useReceived(period: Period) {
  return useQuery({
    queryKey: ['report', 'received', period],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/reports/received', { params: { query: period } })),
  });
}
