import { Group, SegmentedControl } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import type { Period } from '@/api/reportHooks';

type Preset = 'all' | 'ytd' | '1y' | '3y' | 'custom';

/** The selected period lives in the URL (?start=&end=), so it survives reloads and navigation. */
export function usePeriod(): Period {
  const [params] = useSearchParams();
  return { start: params.get('start') ?? undefined, end: params.get('end') ?? undefined };
}

function presetFor(period: Period): Preset {
  if (!period.start && !period.end) return 'all';
  if (period.end) return 'custom';
  const today = dayjs();
  if (period.start === today.startOf('year').format('YYYY-MM-DD')) return 'ytd';
  if (period.start === today.subtract(1, 'year').format('YYYY-MM-DD')) return '1y';
  if (period.start === today.subtract(3, 'year').format('YYYY-MM-DD')) return '3y';
  return 'custom';
}

export function PeriodPicker() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const period = usePeriod();
  const preset = presetFor(period);

  const apply = (start?: string, end?: string) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of [
      ['start', start],
      ['end', end],
    ] as const) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const choose = (value: string) => {
    const today = dayjs();
    switch (value as Preset) {
      case 'all':
        return apply();
      case 'ytd':
        return apply(today.startOf('year').format('YYYY-MM-DD'));
      case '1y':
        return apply(today.subtract(1, 'year').format('YYYY-MM-DD'));
      case '3y':
        return apply(today.subtract(3, 'year').format('YYYY-MM-DD'));
      case 'custom':
        return apply(
          period.start ?? today.startOf('year').format('YYYY-MM-DD'),
          today.format('YYYY-MM-DD'),
        );
    }
  };

  return (
    <Group gap="sm">
      <SegmentedControl
        value={preset}
        onChange={choose}
        data={[
          { value: 'all', label: t('period.all') },
          { value: 'ytd', label: t('period.ytd') },
          { value: '1y', label: t('period.1y') },
          { value: '3y', label: t('period.3y') },
          { value: 'custom', label: t('period.custom') },
        ]}
      />
      {preset === 'custom' && <CustomRange period={period} onApply={apply} />}
    </Group>
  );
}

/**
 * The first click of a range yields [start, null]; it must be kept locally (not in the URL) or
 * the picker resets and the second click never comes.
 */
function CustomRange({
  period,
  onApply,
}: {
  period: Period;
  onApply: (start: string, end: string) => void;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<[string | null, string | null]>([
    period.start ?? null,
    period.end ?? null,
  ]);
  return (
    <DatePickerInput
      type="range"
      valueFormat="DD.MM.YYYY"
      placeholder={t('period.pickRange')}
      value={range}
      onChange={([start, end]) => {
        setRange([start, end]);
        if (start && end) onApply(start, end);
      }}
      w={240}
    />
  );
}
