import { BarChart } from '@mantine/charts';
import { Alert, Badge, Group, Loader, Paper, Select, Stack, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HelpLink } from '@/components/HelpLink';

import { PageTitle } from '@/components/PageTitle';
import { type UpcomingPayment, useUpcoming } from '@/api/reportHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

import { MissedPaymentsTable } from './MissedPayments';

const COLUMNS = {
  date: (i) => i.pay_date,
  type: (i) => i.kind,
  bond: (i) => i.isin,
  perBond: (i) => Number(i.amount_per_unit),
  held: (i) => Number(i.quantity),
  expected: (i) => Number(i.expected_uah),
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
          <PageTitle page="upcoming">{t('upcoming.title')}</PageTitle>
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
      <MissedPaymentsTable />
      {upcoming.isPending ? (
        <Loader />
      ) : upcoming.isError ? (
        <Alert color="red">{upcoming.error.message}</Alert>
      ) : items.length === 0 ? (
        <Text c="dimmed">{t('upcoming.empty')}</Text>
      ) : (
        <>
          <Paper withBorder p="md">
            <Group justify="space-between" mb="md">
              <Group gap={4}>
                <Text fw={600}>{t('upcoming.byMonthUah')}</Text>
                <HelpLink to="upcoming" size="xs" />
              </Group>
              <SeriesLegend series={series} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
              <Stack gap={0} align="flex-end">
                <Text fw={600}>{t('upcoming.total', { uah: formatMoney(total, 'UAH') })}</Text>
                <Text size="xs" c="dimmed">
                  {t('upcoming.totalUsd', { usd: formatMoney(totalUsd, 'USD') })}
                </Text>
              </Stack>
            </Group>
            <BarChart
              maxBarWidth={56}
              barProps={{ radius: [6, 6, 0, 0] }}
              h={260}
              data={chartData}
              dataKey="month"
              type="stacked"
              valueFormatter={(v) => formatNumber(v, 0)}
              yAxisProps={{ width: 80 }}
              series={toggle.visible}
            />
          </Paper>
          <Paper withBorder>
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
                    <SortTh ta="right" {...sort.th('expected')}>
                      {t('upcoming.expected')}
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
                      <Table.Td ta="right">
                        {formatMoney(item.amount_per_unit, item.currency)}
                      </Table.Td>
                      <Table.Td ta="right">{formatNumber(item.quantity, 0)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {formatMoney(item.expected, item.currency)}
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(item.expected_uah, 'UAH')}</Table.Td>
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
