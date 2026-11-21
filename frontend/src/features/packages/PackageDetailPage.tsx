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
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { useLotReport } from '@/api/reportHooks';
import type { components } from '@/api/schema';
import { PeriodPicker, usePeriod } from '@/components/PeriodPicker';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { MoneyText, Stat } from '@/components/Stat';
import { SaleFormModal } from '@/features/operations/SaleFormModal';
import { ValueChart } from '@/features/reports/ValueChart';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

type Flow = components['schemas']['FlowOut'] & { key: number };

const FLOW_LABEL = {
  buy: 'kind.purchase',
  sell: 'kind.sale',
  coupon: 'kind.coupon',
  redemption: 'kind.redemption',
  fee: 'kind.fee',
} as const satisfies Record<Flow['kind'], string>;

const sortColumns = (t: TFunction) =>
  ({
    date: (f) => f.day,
    type: (f) => t(FLOW_LABEL[f.kind]),
    uah: (f) => Number(f.amount_uah),
    fx: (f) => Number(f.fx_rate),
    usd: (f) => Number(f.amount_usd),
  }) satisfies SortColumns<Flow, string>;

export function PackageDetailPage() {
  const { t } = useTranslation();
  const lotId = Number(useParams().lotId);
  const period = usePeriod();
  const report = useLotReport(lotId, period);
  const [selling, setSelling] = useState(false);

  const flows = useMemo<Flow[]>(
    () => (report.data?.flows ?? []).map((f, key) => ({ ...f, key })),
    [report.data],
  );
  const columns = useMemo(() => sortColumns(t), [t]);
  const sort = useSortedRows('table:package-flows', flows, columns, 'date');

  if (report.isPending) return <Loader />;
  if (report.isError) return <Alert color="red">{report.error.message}</Alert>;
  const { summary } = report.data;
  const open = Number(summary.open_quantity) > 0;

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} to="/packages">
          {t('packages.title')}
        </Anchor>
        <Text>#{summary.lot_id}</Text>
      </Breadcrumbs>
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <Title order={2}>
              {t('packageDetail.title', { id: summary.lot_id, isin: summary.isin })}
            </Title>
            <Badge variant="light" color={open ? 'blue' : 'gray'}>
              {open ? t('common.open') : t('common.closed')}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t('packageDetail.subtitle', {
              name: summary.name,
              bought: formatDate(summary.trade_date),
              maturity: formatDate(summary.maturity_date),
              held: formatNumber(summary.open_quantity, 0),
              quantity: formatNumber(summary.quantity, 0),
            })}
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
              {t('packageDetail.sell')}
            </Button>
          )}
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
        <Stat label={t('stat.pnl')} amount={summary.pnl.pnl} signed />
        <Stat label={t('stat.currentValue')} amount={summary.pnl.closing_value} />
        <Stat label={t('stat.invested')} amount={summary.pnl.invested} />
        <Stat label={t('stat.received')} amount={summary.pnl.received} />
        <Stat label={t('stat.xirr')}>
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
          {t('packageDetail.flows')}
        </Text>
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <SortTh {...sort.th('date')}>{t('common.date')}</SortTh>
                <SortTh {...sort.th('type')}>{t('common.type')}</SortTh>
                <SortTh ta="right" {...sort.th('uah')}>
                  {t('common.amountUah')}
                </SortTh>
                <SortTh ta="right" {...sort.th('fx')}>
                  {t('common.usdUah')}
                </SortTh>
                <SortTh ta="right" {...sort.th('usd')}>
                  {t('common.amountUsd')}
                </SortTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sort.rows.map((flow) => (
                <Table.Tr key={flow.key}>
                  <Table.Td>{formatDate(flow.day)}</Table.Td>
                  <Table.Td>{t(FLOW_LABEL[flow.kind])}</Table.Td>
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
