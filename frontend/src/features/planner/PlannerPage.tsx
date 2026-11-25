import { BarChart } from '@mantine/charts';
import {
  Alert,
  Anchor,
  Badge,
  Group,
  Loader,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconCash, IconListCheck, IconPigMoney } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type PlanQuery, type PlannedPurchase, usePurchasePlan } from '@/api/reportHooks';
import { HelpLink } from '@/components/HelpLink';
import { MoneyInput } from '@/components/MoneyInput';
import { PageTitle } from '@/components/PageTitle';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { Stat } from '@/components/Stat';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format';

type Currency = NonNullable<PlanQuery['currency']>;
type LadderPeriod = NonNullable<PlanQuery['period']>;

const YEARS = ['1', '2', '3', '5', '7', '10'] as const;
const PERIOD_MONTHS: Record<LadderPeriod, number> = { quarter: 3, year: 12 };

const COLUMNS = {
  date: (p) => p.buy_date,
  bond: (p) => p.isin,
  maturity: (p) => p.maturity_date,
  yield: (p) => (p.yield_rate === null ? null : Number(p.yield_rate)),
  quantity: (p) => p.quantity,
  price: (p) => Number(p.price),
  cost: (p) => Number(p.cost),
} satisfies SortColumns<PlannedPurchase, string>;

/** Amount as typed to the API's decimal string; empty or invalid counts as zero. */
function amount(value: string | number): string {
  const n = Number(value);
  return value === '' || !Number.isFinite(n) || n < 0 ? '0' : String(n);
}

export function PlannerPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<Currency>('UAH');
  const [years, setYears] = useState('3');
  const [period, setPeriod] = useState<LadderPeriod>('year');
  const [extraNow, setExtraNow] = useState<string | number>('');
  const [extraMonthly, setExtraMonthly] = useState<string | number>('');
  const [minYield, setMinYield] = useState<string | number>('');
  const [minPurchase, setMinPurchase] = useState<string | number>('');
  const [debounced] = useDebouncedValue({ extraNow, extraMonthly, minYield, minPurchase }, 400);
  const plan = usePurchasePlan({
    currency,
    years: Number(years),
    period,
    extra_now: amount(debounced.extraNow),
    extra_monthly: amount(debounced.extraMonthly),
    min_yield: debounced.minYield === '' ? null : (Number(debounced.minYield) / 100).toFixed(4),
    min_purchase: amount(debounced.minPurchase),
  });
  const data = plan.data;
  const [showAll, setShowAll] = useState(false);
  const soon = dayjs().add(3, 'month').format('YYYY-MM-DD');
  const shown = (data?.purchases ?? []).filter((p) => showAll || p.buy_date <= soon);
  const sort = useSortedRows('table:planner', shown, COLUMNS, 'date');
  const unit = t(`currencyUnit.${currency}`);

  const coupons = (data?.coupons ?? []).map((m) => ({
    label: dayjs(m.start).format('MM.YYYY'),
    current: Number(m.current),
    withPlan: Number(m.with_plan),
  }));
  const redemptions = (data?.redemptions ?? []).map((p) => ({
    label: `${dayjs(p.start).format('MM.YYYY')}–${dayjs(p.start)
      .add(PERIOD_MONTHS[data?.period ?? 'year'] - 1, 'month')
      .format('MM.YYYY')}`,
    current: Number(p.current),
    withPlan: Number(p.with_plan),
  }));
  const series = [
    { name: 'current', label: t('planner.current'), color: 'gray.5' },
    { name: 'withPlan', label: t('planner.withPlan'), color: 'teal.6' },
  ];

  return (
    <Stack gap="lg">
      <div>
        <PageTitle page="planner">{t('planner.title')}</PageTitle>
        <Text size="sm" c="dimmed">
          {t('planner.subtitle')}
        </Text>
      </div>
      <Paper withBorder p="md">
        <Group align="flex-end" gap="md">
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('planner.currency')}
            </Text>
            <SegmentedControl
              value={currency}
              onChange={(v) => setCurrency(v as Currency)}
              data={['UAH', 'USD', 'EUR']}
            />
          </Stack>
          <Select
            label={t('planner.horizon')}
            value={years}
            onChange={(v) => setYears(v ?? '3')}
            allowDeselect={false}
            data={YEARS.map((value) => ({
              value,
              label: t('planner.years', { count: Number(value) }),
            }))}
            w={130}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('planner.ladder')}
            </Text>
            <SegmentedControl
              value={period}
              onChange={(v) => setPeriod(v as LadderPeriod)}
              data={[
                { value: 'year', label: t('planner.byYear') },
                { value: 'quarter', label: t('planner.byQuarter') },
              ]}
            />
          </Stack>
          <MoneyInput
            label={t('planner.extraNow')}
            value={extraNow}
            onChange={setExtraNow}
            suffix={` ${unit}`}
            w={160}
          />
          <MoneyInput
            label={t('planner.extraMonthly')}
            value={extraMonthly}
            onChange={setExtraMonthly}
            suffix={` ${unit}`}
            w={160}
          />
          <NumberInput
            label={t('planner.minYield')}
            value={minYield}
            onChange={setMinYield}
            min={0}
            max={100}
            decimalScale={2}
            decimalSeparator=","
            suffix=" %"
            hideControls
            w={130}
          />
          <MoneyInput
            label={t('planner.minPurchase')}
            value={minPurchase}
            onChange={setMinPurchase}
            suffix={` ${unit}`}
            w={170}
          />
          {plan.isFetching && <Loader size="sm" mb={8} />}
        </Group>
      </Paper>
      {plan.isPending ? (
        <Loader />
      ) : plan.isError ? (
        <Alert color="red">{plan.error.message}</Alert>
      ) : data ? (
        <>
          <Text size="sm" c="dimmed">
            {t('planner.range', { start: formatDate(data.start), end: formatDate(data.end) })}
          </Text>
          {data.candidates === 0 ? (
            <Alert color="yellow">{t('planner.noCandidates', { currency: data.currency })}</Alert>
          ) : data.purchases.length === 0 ? (
            <Alert color="yellow">{t('planner.noCash', { currency: data.currency })}</Alert>
          ) : null}
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <Stat icon={IconPigMoney} color="blue" label={t('planner.invested')} help="planner">
              <Text fz={24} fw={800} lh={1.2}>
                {formatMoney(data.invested, data.currency)}
              </Text>
            </Stat>
            <Stat icon={IconListCheck} color="lime" label={t('planner.purchases')} help="planner">
              <Text fz={24} fw={800} lh={1.2}>
                {data.purchases.length}
              </Text>
              <Text size="sm" c="dimmed">
                {t('planner.candidates', { count: data.candidates })}
              </Text>
            </Stat>
            <Stat icon={IconCash} color="teal" label={t('planner.cashLeft')} help="planner">
              <Text fz={24} fw={800} lh={1.2}>
                {formatMoney(data.cash_left, data.currency)}
              </Text>
            </Stat>
          </SimpleGrid>
          <PlanChart
            title={t('planner.couponsByMonth', { currency: data.currency })}
            data={coupons}
            series={series}
          />
          <PlanChart
            title={t(
              data.period === 'year' ? 'planner.redemptionsByYear' : 'planner.redemptionsByQuarter',
              { currency: data.currency },
            )}
            data={redemptions}
            series={series}
          />
          {data.purchases.length > 0 && (
            <Paper withBorder>
              <Group justify="space-between" p="md" pb={0}>
                <Group gap={4}>
                  <Text fw={600}>{t('planner.toBuy')}</Text>
                  <HelpLink to="planner" size="xs" />
                </Group>
                <SegmentedControl
                  size="xs"
                  value={showAll ? 'all' : 'soon'}
                  onChange={(v) => setShowAll(v === 'all')}
                  data={[
                    { value: 'soon', label: t('planner.next3Months') },
                    { value: 'all', label: t('planner.all', { count: data.purchases.length }) },
                  ]}
                />
              </Group>
              <Table.ScrollContainer minWidth={860}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <SortTh {...sort.th('date')}>{t('planner.buyOn')}</SortTh>
                      <SortTh {...sort.th('bond')}>{t('common.bond')}</SortTh>
                      <SortTh {...sort.th('maturity')}>{t('planner.matures')}</SortTh>
                      <SortTh ta="right" {...sort.th('yield')}>
                        {t('planner.yield')}
                      </SortTh>
                      <SortTh ta="right" {...sort.th('quantity')}>
                        {t('planner.quantity')}
                      </SortTh>
                      <SortTh ta="right" {...sort.th('price')}>
                        {t('planner.price')}
                      </SortTh>
                      <SortTh ta="right" {...sort.th('cost')}>
                        {t('planner.cost')}
                      </SortTh>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sort.rows.map((p) => (
                      <Table.Tr key={`${p.buy_date}-${p.isin}`}>
                        <Table.Td>{formatDate(p.buy_date)}</Table.Td>
                        <Table.Td>
                          <Anchor
                            component={Link}
                            to={`/market/${p.isin}`}
                            size="sm"
                            ff="monospace"
                          >
                            {p.isin}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {p.name}
                          </Text>
                          <Group gap={4} mt={2}>
                            {p.instrument_id !== null && (
                              <Badge size="xs" variant="light" color="violet">
                                {t('planner.held')}
                              </Badge>
                            )}
                            {p.variable_rate && (
                              <Badge size="xs" variant="light" color="orange">
                                {t('planner.variable')}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>{formatDate(p.maturity_date)}</Table.Td>
                        <Table.Td ta="right">
                          {p.yield_rate === null ? '—' : formatPercent(p.yield_rate)}
                        </Table.Td>
                        <Table.Td ta="right">{formatNumber(p.quantity, 0)}</Table.Td>
                        <Table.Td ta="right">
                          {formatMoney(p.price, data.currency)}
                          {p.price_estimated && (
                            <Text size="xs" c="dimmed">
                              {t('planner.priceEstimated')}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>
                          {formatMoney(p.cost, data.currency)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          )}
          <Text size="xs" c="dimmed">
            {t('planner.assumptions')}
          </Text>
        </>
      ) : null}
    </Stack>
  );
}

function PlanChart({
  title,
  data,
  series,
}: {
  title: string;
  data: { label: string; current: number; withPlan: number }[];
  series: { name: string; label: string; color: string }[];
}) {
  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="md">
        {title}
      </Text>
      <BarChart
        h={240}
        data={data}
        dataKey="label"
        series={series}
        withLegend
        maxBarWidth={28}
        barProps={{ radius: [4, 4, 0, 0] }}
        valueFormatter={(v) => formatNumber(v, 0)}
        yAxisProps={{ width: 80 }}
      />
    </Paper>
  );
}
