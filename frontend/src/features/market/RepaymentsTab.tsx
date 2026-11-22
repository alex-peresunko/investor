import { BarChart } from '@mantine/charts';
import {
  Anchor,
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconCalendarDue, IconCash, IconCoins } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { Repayment } from '@/api/marketHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { Stat } from '@/components/Stat';
import { formatDate } from '@/lib/format';

import {
  currencyColor,
  type CurrencyFilter,
  CurrencyPicker,
  SourceNote,
  useCompact,
} from './common';

type Horizon = '12m' | '36m' | 'all';

const columns = (t: TFunction) =>
  ({
    date: (r) => r.pay_date,
    isin: (r) => r.isin,
    kind: (r) => t(`kind.${r.kind}`),
    amount: (r) => Number(r.amount),
    uah: (r) => Number(r.amount_uah),
  }) satisfies SortColumns<Repayment, string>;

/** Month key ("2027-03") within three years, year key ("2031") for the whole horizon. */
const periodOf = (day: string, horizon: Horizon) =>
  horizon === 'all' ? day.slice(0, 4) : day.slice(0, 7);

export function RepaymentsTab({ data }: { data: Repayment[] }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const [currency, setCurrency] = useState<CurrencyFilter>('all');
  const [horizon, setHorizon] = useState<Horizon>('12m');
  const [picked, setPicked] = useState<string | null>(null);
  // One currency is shown in its own units; all together in UAH at today's NBU rates.
  const unit = currency === 'all' ? 'UAH' : currency;

  const today = dayjs().format('YYYY-MM-DD');
  const end =
    horizon === 'all'
      ? null
      : dayjs()
          .add(horizon === '12m' ? 12 : 36, 'month')
          .format('YYYY-MM-DD');
  const rows = useMemo(
    () =>
      data.filter(
        (r) =>
          (currency === 'all' || r.currency === currency) && (end === null || r.pay_date < end),
      ),
    [data, currency, end],
  );

  const periods = useMemo(() => {
    const value = (r: Repayment) => Number(currency === 'all' ? r.amount_uah : r.amount);
    const byPeriod = new Map<string, { period: string; coupon: number; redemption: number }>();
    for (const r of rows) {
      const key = periodOf(r.pay_date, horizon);
      const entry = byPeriod.get(key) ?? { period: key, coupon: 0, redemption: 0 };
      entry[r.kind] += value(r);
      byPeriod.set(key, entry);
    }
    return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  }, [rows, horizon, currency]);
  const label = (period: string) =>
    period.length === 4 ? period : dayjs(`${period}-01`).format('MM.YYYY');
  const selected =
    picked && periods.some((p) => p.period === picked) ? picked : (periods[0]?.period ?? null);
  const detail = rows.filter((r) => selected && periodOf(r.pay_date, horizon) === selected);
  const sortColumns = useMemo(() => columns(t), [t]);
  const sort = useSortedRows('table:market-repayments', detail, sortColumns, 'date');

  const sum = (list: Repayment[]) =>
    list.reduce((s, r) => s + Number(currency === 'all' ? r.amount_uah : r.amount), 0);
  const in30 = dayjs().add(30, 'day').format('YYYY-MM-DD');
  const in12m = dayjs().add(12, 'month').format('YYYY-MM-DD');
  const scoped = data.filter((r) => currency === 'all' || r.currency === currency);
  const next30 = scoped.filter((r) => r.pay_date >= today && r.pay_date < in30);
  const next12 = scoped.filter((r) => r.pay_date >= today && r.pay_date < in12m);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <CurrencyPicker value={currency} onChange={setCurrency} />
          <SegmentedControl
            size="xs"
            value={horizon}
            onChange={(v) => setHorizon(v === '36m' || v === 'all' ? v : '12m')}
            data={[
              { value: '12m', label: t('market.repayments.next12') },
              { value: '36m', label: t('market.repayments.next36') },
              { value: 'all', label: t('market.repayments.byYear') },
            ]}
          />
        </Group>
        <Text size="xs" c="dimmed">
          {currency === 'all'
            ? t('market.repayments.inUah')
            : t('market.repayments.inCurrency', { currency })}
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Stat icon={IconCalendarDue} color="orange" label={t('market.repayments.due30')}>
          <Text fz={22} fw={800}>
            {compact(sum(next30), unit)}
          </Text>
        </Stat>
        <Stat icon={IconCash} color="red" label={t('market.repayments.redemptions12')}>
          <Text fz={22} fw={800}>
            {compact(sum(next12.filter((r) => r.kind === 'redemption')), unit)}
          </Text>
        </Stat>
        <Stat icon={IconCoins} color="teal" label={t('market.repayments.coupons12')}>
          <Text fz={22} fw={800}>
            {compact(sum(next12.filter((r) => r.kind === 'coupon')), unit)}
          </Text>
        </Stat>
      </SimpleGrid>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={600}>{t('market.repayments.title')}</Text>
            <Text size="xs" c="dimmed">
              {t('market.repayments.clickHint')}
            </Text>
          </div>
          <SourceNote source={t('market.source.securities')} />
        </Group>
        <BarChart
          h={300}
          data={periods.map((p) => ({ ...p, label: label(p.period) }))}
          dataKey="label"
          type="stacked"
          withLegend
          valueFormatter={(v) => compact(v, unit)}
          yAxisProps={{ width: 80 }}
          series={[
            { name: 'redemption', label: t('kind.redemption'), color: 'red.5' },
            { name: 'coupon', label: t('kind.coupon'), color: 'teal.5' },
          ]}
          barProps={{
            cursor: 'pointer',
            onClick: (bar: { payload?: { period?: string } }) =>
              setPicked(bar.payload?.period ?? null),
          }}
        />
        <Text size="xs" c="dimmed" mt="xs">
          {t('market.repayments.assumption')}
        </Text>
      </Paper>
      <Paper withBorder>
        <Group justify="space-between" p="md" pb="xs">
          <Group gap="xs">
            <Text fw={600}>{t('market.repayments.detail')}</Text>
            <Select
              size="xs"
              w={130}
              value={selected}
              onChange={setPicked}
              allowDeselect={false}
              data={periods.map((p) => ({ value: p.period, label: label(p.period) }))}
              aria-label={t('market.repayments.period')}
            />
          </Group>
          <Text size="sm" fw={600}>
            {compact(sum(detail), unit)}
          </Text>
        </Group>
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="xs" striped>
            <Table.Thead>
              <Table.Tr>
                <SortTh {...sort.th('date')}>{t('common.date')}</SortTh>
                <SortTh {...sort.th('isin')}>{t('common.bond')}</SortTh>
                <SortTh {...sort.th('kind')}>{t('common.type')}</SortTh>
                <SortTh ta="right" {...sort.th('amount')}>
                  {t('common.amount')}
                </SortTh>
                <SortTh ta="right" {...sort.th('uah')}>
                  {t('market.repayments.uahToday')}
                </SortTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sort.rows.map((r) => (
                <Table.Tr key={`${r.isin}-${r.pay_date}-${r.kind}`}>
                  <Table.Td>{formatDate(r.pay_date)}</Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/market/${r.isin}`} size="sm" ff="monospace">
                      {r.isin}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {r.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={r.kind === 'coupon' ? 'teal' : 'red'} size="sm">
                      {t(`kind.${r.kind}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text span size="sm" c={currencyColor(r.currency)}>
                      {compact(r.amount, r.currency)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{compact(r.amount_uah, 'UAH')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
