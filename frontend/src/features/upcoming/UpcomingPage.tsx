import { BarChart } from '@mantine/charts';
import {
  Alert,
  Badge,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type UpcomingPayment, useUpcoming } from '@/api/reportHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

const COLUMNS = {
  date: (i) => i.pay_date,
  type: (i) => i.kind,
  bond: (i) => i.isin,
  perBond: (i) => Number(i.amount_per_unit),
  held: (i) => Number(i.quantity),
  uah: (i) => Number(i.expected_uah),
  usd: (i) => Number(i.expected_usd_estimate),
} satisfies SortColumns<UpcomingPayment, string>;

export function UpcomingPage() {
  const { t } = useTranslation();
  const series: SeriesDef[] = [
    { name: 'coupon', label: t('series.coupons'), color: 'teal.6' },
    { name: 'redemption', label: t('series.redemptions'), color: 'grape.6' },
  ];
  const toggle = useSeriesToggle('chart:upcoming', series);
  const [months, setMonths] = useState('12');
  const upcoming = useUpcoming(Number(months));
  const items = upcoming.data ?? [];
  const byMonth = new Map<string, { coupon: number; redemption: number }>();
  for (const item of items) {
    const month = dayjs(item.pay_date).format('MM.YYYY');
    const bucket = byMonth.get(month) ?? { coupon: 0, redemption: 0 };
    bucket[item.kind] += Number(item.expected_uah);
    byMonth.set(month, bucket);
  }
  const chartData = [...byMonth.entries()].map(([month, v]) => ({ month, ...v }));
  const sort = useSortedRows('table:upcoming', items, COLUMNS, 'date');
  const total = items.reduce((sum, i) => sum + Number(i.expected_uah), 0);
  const totalUsd = items.reduce((sum, i) => sum + Number(i.expected_usd_estimate), 0);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{t('upcoming.title')}</Title>
          <Text size="sm" c="dimmed">
            {t('upcoming.subtitle')}
          </Text>
        </div>
        <Select
          value={months}
          onChange={(v) => setMonths(v ?? '12')}
          allowDeselect={false}
          data={(['3', '6', '12', '24', '60'] as const).map((value) => ({
            value,
            label: t(`upcoming.next${value}`),
          }))}
          w={180}
        />
      </Group>
      {upcoming.isPending ? (
        <Loader />
      ) : upcoming.isError ? (
        <Alert color="red">{upcoming.error.message}</Alert>
      ) : items.length === 0 ? (
        <Text c="dimmed">{t('upcoming.empty')}</Text>
      ) : (
        <>
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600}>{t('upcoming.byMonthUah')}</Text>
              <SeriesLegend series={series} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
              <Text fw={600}>
                {t('upcoming.total', {
                  uah: formatMoney(total, 'UAH'),
                  usd: formatMoney(totalUsd, 'USD'),
                })}
              </Text>
            </Group>
            <BarChart
              h={260}
              data={chartData}
              dataKey="month"
              type="stacked"
              valueFormatter={(v) => formatNumber(v, 0)}
              yAxisProps={{ width: 80 }}
              series={toggle.visible}
            />
          </Paper>
          <Paper withBorder radius="md">
            <Table.ScrollContainer minWidth={800}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <SortTh {...sort.th('date')}>{t('common.date')}</SortTh>
                    <SortTh {...sort.th('type')}>{t('common.type')}</SortTh>
                    <SortTh {...sort.th('bond')}>{t('common.bond')}</SortTh>
                    <SortTh ta="right" {...sort.th('perBond')}>
                      {t('upcoming.perBond')}
                    </SortTh>
                    <SortTh ta="right" {...sort.th('held')}>
                      {t('common.bondsHeld')}
                    </SortTh>
                    <SortTh ta="right" {...sort.th('uah')}>
                      {t('upcoming.expectedUah')}
                    </SortTh>
                    <SortTh ta="right" {...sort.th('usd')}>
                      {t('upcoming.approxUsd')}
                    </SortTh>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sort.rows.map((item) => (
                    <Table.Tr key={`${item.instrument_id}-${item.kind}-${item.pay_date}`}>
                      <Table.Td>{formatDate(item.pay_date)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={item.kind === 'coupon' ? 'teal' : 'grape'}>
                          {t(`kind.${item.kind}`)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {item.isin}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.name}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(item.amount_per_unit, 'UAH')}</Table.Td>
                      <Table.Td ta="right">{formatNumber(item.quantity, 0)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {formatMoney(item.expected_uah, 'UAH')}
                      </Table.Td>
                      <Table.Td ta="right">
                        {formatMoney(item.expected_usd_estimate, 'USD')}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </>
      )}
    </Stack>
  );
}
