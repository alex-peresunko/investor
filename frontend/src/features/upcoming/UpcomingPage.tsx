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

import { type UpcomingPayment, useUpcoming } from '@/api/reportHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

const SERIES: SeriesDef[] = [
  { name: 'coupon', label: 'Coupons', color: 'teal.6' },
  { name: 'redemption', label: 'Redemptions', color: 'grape.6' },
];

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
  const toggle = useSeriesToggle('chart:upcoming', SERIES);
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
  const sort = useSortedRows(items, COLUMNS, 'date');
  const total = items.reduce((sum, i) => sum + Number(i.expected_uah), 0);
  const totalUsd = items.reduce((sum, i) => sum + Number(i.expected_usd_estimate), 0);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Upcoming payments</Title>
          <Text size="sm" c="dimmed">
            Expected from the bonds you hold today, per the payment schedules. USD at today&apos;s
            NBU rate.
          </Text>
        </div>
        <Select
          value={months}
          onChange={(v) => setMonths(v ?? '12')}
          allowDeselect={false}
          data={[
            { value: '3', label: 'Next 3 months' },
            { value: '6', label: 'Next 6 months' },
            { value: '12', label: 'Next 12 months' },
            { value: '24', label: 'Next 24 months' },
            { value: '60', label: 'Next 5 years' },
          ]}
          w={180}
        />
      </Group>
      {upcoming.isPending ? (
        <Loader />
      ) : upcoming.isError ? (
        <Alert color="red">{upcoming.error.message}</Alert>
      ) : items.length === 0 ? (
        <Text c="dimmed">No payments expected in this window.</Text>
      ) : (
        <>
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600}>By month, UAH</Text>
              <SeriesLegend series={SERIES} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
              <Text fw={600}>
                Total {formatMoney(total, 'UAH')} ≈ {formatMoney(totalUsd, 'USD')}
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
                    <SortTh {...sort.th('date')}>Date</SortTh>
                    <SortTh {...sort.th('type')}>Type</SortTh>
                    <SortTh {...sort.th('bond')}>Bond</SortTh>
                    <SortTh ta="right" {...sort.th('perBond')}>
                      Per bond
                    </SortTh>
                    <SortTh ta="right" {...sort.th('held')}>
                      Bonds held
                    </SortTh>
                    <SortTh ta="right" {...sort.th('uah')}>
                      Expected, UAH
                    </SortTh>
                    <SortTh ta="right" {...sort.th('usd')}>
                      ≈ USD
                    </SortTh>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sort.rows.map((item) => (
                    <Table.Tr key={`${item.instrument_id}-${item.kind}-${item.pay_date}`}>
                      <Table.Td>{formatDate(item.pay_date)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={item.kind === 'coupon' ? 'teal' : 'grape'}>
                          {item.kind === 'coupon' ? 'Coupon' : 'Redemption'}
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
