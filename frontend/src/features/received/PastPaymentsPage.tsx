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

import { useReceived } from '@/api/reportHooks';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { Stat } from '@/components/Stat';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

export function PastPaymentsPage() {
  const period = usePeriod();
  const received = useReceived(period);
  const [currency, setCurrency] = useState<'usd' | 'uah'>('usd');
  const items = [...(received.data ?? [])].reverse();

  const sum = (kind: 'coupon' | 'redemption') => {
    const ofKind = items.filter((i) => i.kind === kind);
    return {
      uah: String(ofKind.reduce((s, i) => s + Number(i.total_amount_uah), 0)),
      usd: String(ofKind.reduce((s, i) => s + Number(i.amount_usd), 0)),
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
            Coupons and redemptions received. USD at the rate recorded for each payment.
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
            <Stat label="Coupons received" amount={coupons} />
            <Stat label="Redemptions received" amount={redemptions} />
            <Stat
              label="Total received"
              amount={{
                uah: String(Number(coupons.uah) + Number(redemptions.uah)),
                usd: String(Number(coupons.usd) + Number(redemptions.usd)),
              }}
            />
          </SimpleGrid>
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="md">
              <Text fw={600}>By month</Text>
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
            <BarChart
              h={260}
              data={chartData}
              dataKey="month"
              type="stacked"
              withLegend
              valueFormatter={(v) => formatNumber(v, 0)}
              yAxisProps={{ width: 80 }}
              series={[
                { name: 'coupon', label: 'Coupons', color: 'teal.6' },
                { name: 'redemption', label: 'Redemptions', color: 'grape.6' },
              ]}
            />
          </Paper>
          <Paper withBorder radius="md">
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Bond</Table.Th>
                    <Table.Th ta="right">Bonds held</Table.Th>
                    <Table.Th ta="right">Amount, UAH</Table.Th>
                    <Table.Th ta="right">USD/UAH</Table.Th>
                    <Table.Th ta="right">Amount, USD</Table.Th>
                    <Table.Th>Split by package</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item) => (
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
