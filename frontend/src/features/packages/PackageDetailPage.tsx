import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconTrendingDown } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useLotReport } from '@/api/reportHooks';
import type { components } from '@/api/schema';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { MoneyText, Stat } from '@/components/Stat';
import { SaleFormModal } from '@/features/operations/SaleFormModal';
import { ValueChart } from '@/features/reports/ValueChart';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

const FLOW_LABEL: Record<string, string> = {
  buy: 'Purchase',
  sell: 'Sale',
  coupon: 'Coupon',
  redemption: 'Redemption',
  fee: 'Fee',
};

type Flow = components['schemas']['FlowOut'] & { key: number };

const COLUMNS = {
  date: (f) => f.day,
  type: (f) => FLOW_LABEL[f.kind],
  uah: (f) => Number(f.amount_uah),
  fx: (f) => Number(f.fx_rate),
  usd: (f) => Number(f.amount_usd),
} satisfies SortColumns<Flow, string>;

export function PackageDetailPage() {
  const lotId = Number(useParams().lotId);
  const period = usePeriod();
  const report = useLotReport(lotId, period);
  const [selling, setSelling] = useState(false);

  const flows = useMemo<Flow[]>(
    () => (report.data?.flows ?? []).map((f, key) => ({ ...f, key })),
    [report.data],
  );
  const sort = useSortedRows('table:package-flows', flows, COLUMNS, 'date');

  if (report.isPending) return <Loader />;
  if (report.isError) return <Alert color="red">{report.error.message}</Alert>;
  const { summary } = report.data;
  const open = Number(summary.open_quantity) > 0;

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} to="/packages">
          Packages
        </Anchor>
        <Text>#{summary.lot_id}</Text>
      </Breadcrumbs>
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <Title order={2}>
              Package #{summary.lot_id} · {summary.isin}
            </Title>
            <Badge variant="light" color={open ? 'blue' : 'gray'}>
              {open ? 'open' : 'closed'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {summary.name} · bought {formatDate(summary.trade_date)} · matures{' '}
            {formatDate(summary.maturity_date)} · {formatNumber(summary.open_quantity, 0)} of{' '}
            {formatNumber(summary.quantity, 0)} held
          </Text>
        </div>
        <Group>
          <PeriodPicker />
          {open && (
            <Button
              variant="light"
              leftSection={<IconTrendingDown size={16} />}
              onClick={() => setSelling(true)}
            >
              Sell
            </Button>
          )}
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
        <Stat label="Profit / loss" amount={summary.pnl.pnl} signed />
        <Stat label="Current value" amount={summary.pnl.closing_value} />
        <Stat label="Invested" amount={summary.pnl.invested} />
        <Stat label="Received" amount={summary.pnl.received} />
        <Stat label="Annual return (XIRR)">
          <Text fz={22} fw={700} mt={4}>
            {formatPercent(summary.xirr_usd)}{' '}
            <Text span size="sm" c="dimmed">
              USD
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            {formatPercent(summary.xirr_uah)} UAH
          </Text>
        </Stat>
      </SimpleGrid>
      <ValueChart period={period} lotId={lotId} />
      <Paper withBorder radius="md">
        <Text fw={600} p="md" pb={0}>
          Cash flows in the period
        </Text>
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <SortTh {...sort.th('date')}>Date</SortTh>
                <SortTh {...sort.th('type')}>Type</SortTh>
                <SortTh ta="right" {...sort.th('uah')}>
                  Amount, UAH
                </SortTh>
                <SortTh ta="right" {...sort.th('fx')}>
                  USD/UAH
                </SortTh>
                <SortTh ta="right" {...sort.th('usd')}>
                  Amount, USD
                </SortTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sort.rows.map((flow) => (
                <Table.Tr key={flow.key}>
                  <Table.Td>{formatDate(flow.day)}</Table.Td>
                  <Table.Td>{FLOW_LABEL[flow.kind]}</Table.Td>
                  <Table.Td ta="right">
                    <MoneyText value={flow.amount_uah} currency="UAH" signed />
                  </Table.Td>
                  <Table.Td ta="right">{formatNumber(flow.fx_rate, 4)}</Table.Td>
                  <Table.Td ta="right">
                    <MoneyText value={flow.amount_usd} currency="USD" signed />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
      {selling && <SaleFormModal sale={null} lotId={lotId} onClose={() => setSelling(false)} />}
    </Stack>
  );
}
