import { LineChart } from '@mantine/charts';
import { Alert, Group, Loader, Paper, SegmentedControl, Text } from '@mantine/core';
import { useState } from 'react';

import { type Period, useTimeseries } from '@/api/reportHooks';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { formatDate, formatNumber } from '@/lib/format';

const SERIES: SeriesDef[] = [
  { name: 'value', label: 'Value', color: 'blue.6' },
  { name: 'pnl', label: 'Cumulative P&L', color: 'teal.6' },
];

interface Props {
  period: Period;
  lotId?: number;
}

export function ValueChart({ period, lotId }: Props) {
  const [currency, setCurrency] = useState<'usd' | 'uah'>('usd');
  const series = useTimeseries(period, lotId);
  const toggle = useSeriesToggle('chart:value', SERIES);
  // Two axes only when both series are shown; a lone series gets the left axis.
  const dualAxis = toggle.visible.length === 2;
  const data = (series.data ?? []).map((p) => ({
    day: formatDate(p.day),
    value: Number(p.value[currency]),
    pnl: Number(p.cumulative_pnl[currency]),
  }));

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>Value and cumulative P&L</Text>
        <Group gap="lg">
          <SeriesLegend series={SERIES} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
          <SegmentedControl
            size="xs"
            value={currency}
            onChange={(v) => setCurrency(v === 'uah' ? 'uah' : 'usd')}
            data={[
              { value: 'usd', label: 'USD' },
              { value: 'uah', label: 'UAH' },
            ]}
          />
        </Group>
      </Group>
      {series.isPending ? (
        <Loader />
      ) : series.isError ? (
        <Alert color="red">{series.error.message}</Alert>
      ) : data.length < 2 ? (
        <Text c="dimmed" size="sm">
          Not enough data for a chart yet.
        </Text>
      ) : (
        <LineChart
          h={300}
          data={data}
          dataKey="day"
          curveType="monotone"
          valueFormatter={(v) => formatNumber(v, 0)}
          yAxisProps={{ width: 80 }}
          withRightYAxis={dualAxis}
          yAxisLabel={dualAxis ? 'Value' : undefined}
          rightYAxisLabel={dualAxis ? 'Cumulative P&L' : undefined}
          rightYAxisProps={{ width: 80 }}
          series={toggle.visible.map((s) => ({
            ...s,
            yAxisId: dualAxis && s.name === 'pnl' ? 'right' : undefined,
          }))}
        />
      )}
    </Paper>
  );
}
