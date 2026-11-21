import { Group, SegmentedControl } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
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
          { value: 'all', label: 'All time' },
          { value: 'ytd', label: 'YTD' },
          { value: '1y', label: '1Y' },
          { value: '3y', label: '3Y' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {preset === 'custom' && (
        <DatePickerInput
          type="range"
          valueFormat="DD.MM.YYYY"
          value={[period.start ?? null, period.end ?? null]}
          onChange={([start, end]) => {
            if (start && end) apply(start, end);
          }}
          w={240}
        />
      )}
    </Group>
  );
}
