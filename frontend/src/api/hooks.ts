import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api, unwrap } from './client';
import type {
  InstrumentCreate,
  InstrumentInput,
  LotInput,
  PaymentInput,
  SaleInput,
  ScheduledPaymentInput,
} from './types';

export const queryKeys = {
  instruments: ['instruments'] as const,
  schedule: (instrumentId: number) => ['schedule', instrumentId] as const,
  lots: ['lots'] as const,
  sales: ['sales'] as const,
  payments: ['payments'] as const,
};

export function useInstruments() {
  return useQuery({
    queryKey: queryKeys.instruments,
    queryFn: async () => unwrap(await api.GET('/api/v1/instruments')),
  });
}

export function useSchedule(instrumentId: number | null) {
  return useQuery({
    queryKey: queryKeys.schedule(instrumentId ?? 0),
    enabled: instrumentId !== null,
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/instruments/{instrument_id}/schedule', {
          params: { path: { instrument_id: instrumentId ?? 0 } },
        }),
      ),
  });
}

export function useLots() {
  return useQuery({
    queryKey: queryKeys.lots,
    queryFn: async () => unwrap(await api.GET('/api/v1/lots')),
  });
}

export function useSales() {
  return useQuery({
    queryKey: queryKeys.sales,
    queryFn: async () => unwrap(await api.GET('/api/v1/sales')),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments,
    queryFn: async () => unwrap(await api.GET('/api/v1/payments')),
  });
}

/**
 * Every write can change any derived number (P&L, holdings, reports), so a successful mutation
 * invalidates all cached queries.
 */
function useWrite<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  successMessage: ParseKeys,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      notifications.show({ color: 'teal', message: t(successMessage) });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) =>
      notifications.show({ color: 'red', title: t('notify.error'), message: error.message }),
  });
}

export function useSaveInstrument() {
  return useWrite(
    async ({
      id,
      body,
      schedule,
    }: {
      id?: number;
      body: InstrumentInput;
      /** For a new bond only: saved instead of a schedule generated from the terms. */
      schedule?: InstrumentCreate['schedule'];
    }) => {
      if (id === undefined)
        return unwrap(await api.POST('/api/v1/instruments', { body: { ...body, schedule } }));
      return unwrap(
        await api.PUT('/api/v1/instruments/{instrument_id}', {
          params: { path: { instrument_id: id } },
          body,
        }),
      );
    },
    'notify.bondSaved',
  );
}

/** Bond terms and payment schedule from the NBU depository list; throws a translated error. */
export async function lookupSecurity(isin: string) {
  return unwrap(await api.GET('/api/v1/securities/{isin}', { params: { path: { isin } } }));
}

export function useDeleteInstrument() {
  return useWrite(async (id: number) => {
    const result = await api.DELETE('/api/v1/instruments/{instrument_id}', {
      params: { path: { instrument_id: id } },
    });
    if (result.error !== undefined) unwrap(result);
  }, 'notify.bondDeleted');
}

export function useReplaceSchedule() {
  return useWrite(
    async ({ id, items }: { id: number; items: ScheduledPaymentInput[] }) =>
      unwrap(
        await api.PUT('/api/v1/instruments/{instrument_id}/schedule', {
          params: { path: { instrument_id: id } },
          body: items,
        }),
      ),
    'notify.scheduleSaved',
  );
}

export function useRegenerateSchedule() {
  return useWrite(
    async (id: number) =>
      unwrap(
        await api.POST('/api/v1/instruments/{instrument_id}/schedule/generate', {
          params: { path: { instrument_id: id } },
        }),
      ),
    'notify.scheduleGenerated',
  );
}

export function useSaveLot() {
  return useWrite(async ({ id, body }: { id?: number; body: LotInput }) => {
    if (id === undefined) return unwrap(await api.POST('/api/v1/lots', { body }));
    return unwrap(
      await api.PUT('/api/v1/lots/{lot_id}', { params: { path: { lot_id: id } }, body }),
    );
  }, 'notify.purchaseSaved');
}

export function useDeleteLot() {
  return useWrite(async (id: number) => {
    const result = await api.DELETE('/api/v1/lots/{lot_id}', {
      params: { path: { lot_id: id } },
    });
    if (result.error !== undefined) unwrap(result);
  }, 'notify.purchaseDeleted');
}

export function useSaveSale() {
  return useWrite(async ({ id, body }: { id?: number; body: SaleInput }) => {
    if (id === undefined) return unwrap(await api.POST('/api/v1/sales', { body }));
    return unwrap(
      await api.PUT('/api/v1/sales/{sale_id}', { params: { path: { sale_id: id } }, body }),
    );
  }, 'notify.saleSaved');
}

export function useDeleteSale() {
  return useWrite(async (id: number) => {
    const result = await api.DELETE('/api/v1/sales/{sale_id}', {
      params: { path: { sale_id: id } },
    });
    if (result.error !== undefined) unwrap(result);
  }, 'notify.saleDeleted');
}

export function useSavePayment() {
  return useWrite(async ({ id, body }: { id?: number; body: PaymentInput }) => {
    if (id === undefined) return unwrap(await api.POST('/api/v1/payments', { body }));
    return unwrap(
      await api.PUT('/api/v1/payments/{payment_id}', {
        params: { path: { payment_id: id } },
        body,
      }),
    );
  }, 'notify.paymentSaved');
}

export function useDeletePayment() {
  return useWrite(async (id: number) => {
    const result = await api.DELETE('/api/v1/payments/{payment_id}', {
      params: { path: { payment_id: id } },
    });
    if (result.error !== undefined) unwrap(result);
  }, 'notify.paymentDeleted');
}
