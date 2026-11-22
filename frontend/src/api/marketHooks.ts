import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from './client';
import type { components } from './schema';

type Schemas = components['schemas'];
export type MarketBond = Schemas['MarketBond'];
export type MarketBonds = Schemas['MarketBonds'];
export type MarketQuote = Schemas['MarketQuote'];
export type MarketBondDetail = Schemas['MarketBondDetail'];
export type MarketAuction = Schemas['AuctionOut'];
export type HoldersReport = Schemas['HoldersReport'];
export type HolderGroup = Schemas['HolderGroupOut']['group'];
export type Holder = Schemas['HolderSlice']['holder'];
export type Repayment = Schemas['Repayment'];

// NBU publishes these once a day; the backend caches them for hours.
const STALE = 30 * 60 * 1000;

export function useMarketBonds() {
  return useQuery({
    queryKey: ['market', 'bonds'],
    staleTime: STALE,
    queryFn: async () => unwrap(await api.GET('/api/v1/market/bonds')),
  });
}

export function useMarketBond(isin: string) {
  return useQuery({
    queryKey: ['market', 'bond', isin],
    staleTime: STALE,
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/market/bonds/{isin}', { params: { path: { isin } } })),
  });
}

export function useMarketHolders() {
  return useQuery({
    queryKey: ['market', 'holders'],
    staleTime: STALE,
    queryFn: async () => unwrap(await api.GET('/api/v1/market/holders')),
  });
}

export function useMarketAuctions() {
  return useQuery({
    queryKey: ['market', 'auctions'],
    staleTime: STALE,
    queryFn: async () => unwrap(await api.GET('/api/v1/market/auctions')),
  });
}

export function useMarketRepayments() {
  return useQuery({
    queryKey: ['market', 'repayments'],
    staleTime: STALE,
    queryFn: async () => unwrap(await api.GET('/api/v1/market/repayments')),
  });
}
