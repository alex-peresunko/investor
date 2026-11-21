import { BarChart } from '@mantine/charts';
import {
  Alert,
  Badge,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import dayjs from 'dayjs';
import { useState } from 'react';

import { type ReceivedPayment, useReceived } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { MoneyText, Stat } from '@/components/Stat';
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
  held: (i) => Number(i.quantity),
  uah: (i) => Number(i.total_amount_uah),
  fx: (i) => Number(i.fx_rate),
  usd: (i) => Number(i.amount_usd),
  net: (i) => Number(i.net_income_usd),
} satisfies SortColumns<ReceivedPayment, string>;

export function PastPaymentsPage() {
  const toggle = useSeriesToggle('chart:past-payments', SERIES);
  const period = usePeriod();
  const received = useReceived(period);
  const [currency, setCurrency] = useState<'usd' | 'uah'>('usd');
  const items = received.data ?? [];
  const sort = useSortedRows('table:past-payments', items, COLUMNS, 'date');

  const sum = (kind: 'coupon' | 'redemption') => {
    const ofKind = items.filter((i) => i.kind === kind);
    return {
      uah: String(ofKind.reduce((s, i) => s + Number(i.total_amount_uah), 0)),
      usd: String(ofKind.reduce((s, i) => s + Number(i.amount_usd), 0)),
      netUah: ofKind.reduce((s, i) => s + Number(i.net_income_uah), 0),
      netUsd: ofKind.reduce((s, i) => s + Number(i.net_income_usd), 0),
    };
  };
  const coupons = sum('coupon');
  const redemptions = sum('redemption');

  const byMonth = new Map<string, { coupon: number; redemption: number }>();
  for (const item of received.data ?? []) {
    const month = dayjs(item.pay_date).format('MM.YYYY');
    const bucket = byMonth.get(month) ?? { coupon: 0, redemption: 0 };
    bucket[item.kind] += Number(currency === 'usd' ? item.amount_usd : item.total_amount_uah);
    byMonth.set(month, bucket);
  }
  const chartData = [...byMonth.entries()].map(([month, v]) => ({ month, ...v }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Past payments</Title>
          <Text size="sm" c="dimmed">
            Cash received; net income deducts what you paid for the bonds.
          </Text>
        </div>
        <PeriodPicker />
      </Group>
      {received.isPending ? (
        <Loader />
      ) : received.isError ? (
        <Alert color="red">{received.error.message}</Alert>
      ) : items.length === 0 ? (
        <Text c="dimmed">No payments received in this period.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <Stat label="Coupons received" amount={coupons}>
              <NetIncome usd={coupons.netUsd} uah={coupons.netUah} />
            </Stat>
            <Stat label="Redemptions received" amount={redemptions}>
              <NetIncome usd={redemptions.netUsd} uah={redemptions.netUah} />
            </Stat>
            <Stat
              label="Total received"
              amount={{
                uah: String(Number(coupons.uah) + Number(redemptions.uah)),
                usd: String(Number(coupons.usd) + Number(redemptions.usd)),
              }}
            >
              <NetIncome
                usd={coupons.netUsd + redemptions.netUsd}
                uah={coupons.netUah + redemptions.netUah}
              />
            </Stat>
          </SimpleGrid>
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600}>By month</Text>
              <Group gap="lg">
                <SeriesLegend
                  series={SERIES}
                  isVisible={toggle.isVisible}
                  onToggle={toggle.toggle}
                />
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
            <Table.ScrollContainer minWidth={1050}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <SortTh {...sort.th('date')}>Date</SortTh>
                    <SortTh {...sort.th('type')}>Type</SortTh>
                    <SortTh {...sort.th('bond')}>Bond</SortTh>
                    <SortTh ta="right" {...sort.th('held')}>
                      Bonds held
                    </SortTh>
                    <SortTh ta="right" {...sort.th('uah')}>
                      Amount, UAH
                    </SortTh>
                    <SortTh ta="right" {...sort.th('fx')}>
                      USD/UAH
                    </SortTh>
                    <SortTh ta="right" {...sort.th('usd')}>
                      Amount, USD
                    </SortTh>
                    <SortTh ta="right" {...sort.th('net')}>
                      Net income
                    </SortTh>
                    <Table.Th>Split by package</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sort.rows.map((item) => (
                    <Table.Tr key={item.payment_id}>
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
                      <Table.Td ta="right">{formatNumber(item.quantity, 0)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {formatMoney(item.total_amount_uah, 'UAH')}
                      </Table.Td>
                      <Table.Td ta="right">{formatNumber(item.fx_rate, 4)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {formatMoney(item.amount_usd, 'USD')}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={600}>
                          <MoneyText value={item.net_income_usd} currency="USD" signed />
                        </Text>
                        <Text size="xs" c="dimmed">
                          <MoneyText value={item.net_income_uah} currency="UAH" signed />
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {item.allocations
                            .map((a) => `#${a.lot_id}: ${formatMoney(a.amount_uah, 'UAH')}`)
                            .join(' · ')}
                        </Text>
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

function NetIncome({ usd, uah }: { usd: number; uah: number }) {
  return (
    <Group
      justify="space-between"
      mt="xs"
      pt="xs"
      gap="xs"
      wrap="nowrap"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Text size="xs" c="dimmed">
        Net income
      </Text>
      <Text size="sm" fw={500}>
        <MoneyText value={usd} currency="USD" signed />{' '}
        <Text span size="xs" c="dimmed">
          <MoneyText value={uah} currency="UAH" signed />
        </Text>
      </Text>
    </Group>
  );
}
