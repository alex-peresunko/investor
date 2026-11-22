import { Alert, Group, Loader, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Holder } from '@/api/marketHooks';
import { formatCompact, formatDate } from '@/lib/format';

export const HOLDERS: Holder[] = [
  'nbu',
  'banks',
  'companies',
  'individuals',
  'non_residents',
  'communities',
  'nominees',
];

export const HOLDER_COLORS: Record<Holder, string> = {
  nbu: 'indigo.6',
  banks: 'blue.4',
  companies: 'teal.5',
  individuals: 'orange.5',
  non_residents: 'grape.5',
  communities: 'lime.6',
  nominees: 'gray.5',
};

export const CURRENCY_COLORS = {
  UAH: 'blue.6',
  USD: 'teal.6',
  EUR: 'violet.6',
} as const satisfies Record<string, string>;

export const currencyColor = (currency: string): string =>
  (CURRENCY_COLORS as Record<string, string>)[currency] ?? 'gray.6';

export type CurrencyFilter = 'all' | 'UAH' | 'USD' | 'EUR';

export function CurrencyPicker({
  value,
  onChange,
}: {
  value: CurrencyFilter;
  onChange: (value: CurrencyFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      size="xs"
      value={value}
      onChange={(v) => onChange(v === 'UAH' || v === 'USD' || v === 'EUR' ? v : 'all')}
      data={[
        { value: 'all', label: t('common.all') },
        { value: 'UAH', label: 'UAH' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
      ]}
    />
  );
}

/** Formats large amounts in the UI language: "1,98 трлн ₴". */
export function useCompact() {
  const { i18n } = useTranslation();
  return (value: number | string, currency: string) =>
    formatCompact(value, currency, i18n.language);
}

export function useSignedCompact() {
  const compact = useCompact();
  return (value: number | string | null | undefined, currency: string) => {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    return n > 0 ? `+${compact(n, currency)}` : compact(n, currency);
  };
}

/** Where a block's numbers come from and the day they describe. */
export function SourceNote({ source, day }: { source: string; day?: string | null }) {
  const { t } = useTranslation();
  return (
    <Group gap={4} wrap="nowrap">
      <IconDatabase size={12} color="var(--mantine-color-dimmed)" />
      <Text size="xs" c="dimmed">
        {day ? t('market.sourceOn', { source, date: formatDate(day) }) : source}
      </Text>
    </Group>
  );
}

/** Loader with a note on the slow first load, an error, or the content. */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isPending)
    return (
      <Stack align="center" p="xl" gap="xs">
        <Loader />
        <Text size="sm" c="dimmed">
          {t('market.loading')}
        </Text>
      </Stack>
    );
  if (query.isError) return <Alert color="red">{query.error.message}</Alert>;
  return <>{children(query.data)}</>;
}

export const yearsBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / (365.25 * 24 * 3600 * 1000);
