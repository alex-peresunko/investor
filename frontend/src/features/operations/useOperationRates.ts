import type { Currency } from '@/api/types';

import { useNbuRate } from './useNbuRate';

/** EUR bonds store a EUR/UAH rate on every operation; UAH and USD bonds convert via fx_rate. */
export const needsCurrencyRate = (currency: Currency | undefined): currency is 'EUR' =>
  currency === 'EUR';

/** NBU rates an operation form fills in: USD/UAH always, EUR/UAH for EUR bonds. */
export function useOperationRates(
  currency: Currency | undefined,
  apply: { fx: (rate: number) => void; currency: (rate: number) => void },
) {
  const usd = useNbuRate(apply.fx);
  const eur = useNbuRate(apply.currency, 'EUR');
  const loadCurrency = async (isoDate: string | null, bondCurrency = currency) => {
    if (needsCurrencyRate(bondCurrency)) await eur.load(isoDate);
  };
  return {
    usd,
    eur,
    loadCurrency,
    load: async (isoDate: string | null, bondCurrency = currency) => {
      await Promise.all([usd.load(isoDate), loadCurrency(isoDate, bondCurrency)]);
    },
  };
}
