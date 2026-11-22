import { useState } from 'react';

import { fetchRate } from '@/lib/fx';

/** Fetches the NBU rate for a date and hands it to `apply`; reports whether a fetch is running. */
export function useNbuRate(apply: (rate: number) => void, currency: 'USD' | 'EUR' = 'USD') {
  const [loading, setLoading] = useState(false);
  const load = async (isoDate: string | null) => {
    if (!isoDate) return;
    setLoading(true);
    const rate = await fetchRate(currency, isoDate);
    setLoading(false);
    if (rate !== null) apply(Number(rate));
  };
  return { loading, load };
}
