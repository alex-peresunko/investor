import { LineChart } from '@mantine/charts';
import { Alert, Group, Loader, Paper, SegmentedControl, Text } from '@mantine/core';
import { useState } from 'react';

import { type Period, useTimeseries } from '@/api/reportHooks';
import { formatDate, formatNumber } from '@/lib/format';

interface Props {
  period: Period;
  lotId?: number;
}

export function ValueChart({ period, lotId }: Props) {
  const [currency, setCurrency] = useState<'usd' | 'uah'>('usd');
  const series = useTimeseries(period, lotId);
  const data = (series.data ?? []).map((p) => ({
    day: formatDate(p.day),
    value: Number(p.value[currency]),
    pnl: Number(p.cumulative_pnl[currency]),
  }));

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>Value and cumulative P&L</Text>
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
          withLegend
          curveType="monotone"
          valueFormatter={(v) => formatNumber(v, 0)}
          yAxisProps={{ width: 80 }}
          series={[
            { name: 'value', label: 'Value', color: 'blue.6' },
            { name: 'pnl', label: 'Cumulative P&L', color: 'teal.6' },
          ]}
        />
      )}
    </Paper>
  );
}
