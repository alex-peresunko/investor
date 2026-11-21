import { AreaChart } from '@mantine/charts';
import { Alert, Group, Loader, Paper, SegmentedControl, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Period, useTimeseries } from '@/api/reportHooks';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { formatDate, formatNumber } from '@/lib/format';

interface Props {
  period: Period;
  lotId?: number;
}

export function ValueChart({ period, lotId }: Props) {
  const { t } = useTranslation();
  const series: SeriesDef[] = [
    { name: 'value', label: t('series.value'), color: 'brand.5' },
    { name: 'pnl', label: t('series.cumulativePnl'), color: 'teal.5' },
  ];
  const [currency, setCurrency] = useState<'usd' | 'uah'>('usd');
  const timeseries = useTimeseries(period, lotId);
  const toggle = useSeriesToggle('chart:value', series);
  // Two axes only when both series are shown; a lone series gets the left axis.
  const dualAxis = toggle.visible.length === 2;
  const data = (timeseries.data ?? []).map((p) => ({
    day: formatDate(p.day),
    value: Number(p.value[currency]),
    pnl: Number(p.cumulative_pnl[currency]),
  }));

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>{t('chart.valueTitle')}</Text>
        <Group gap="lg">
          <SeriesLegend series={series} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
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
      {timeseries.isPending ? (
        <Loader />
      ) : timeseries.isError ? (
        <Alert color="red">{timeseries.error.message}</Alert>
      ) : data.length < 2 ? (
        <Text c="dimmed" size="sm">
          {t('common.noData')}
        </Text>
      ) : (
        <AreaChart
          h={300}
          data={data}
          dataKey="day"
          curveType="monotone"
          withGradient
          fillOpacity={0.35}
          strokeWidth={2.5}
          valueFormatter={(v) => formatNumber(v, 0)}
          yAxisProps={{ width: 80 }}
          withRightYAxis={dualAxis}
          yAxisLabel={dualAxis ? t('series.value') : undefined}
          rightYAxisLabel={dualAxis ? t('series.cumulativePnl') : undefined}
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
