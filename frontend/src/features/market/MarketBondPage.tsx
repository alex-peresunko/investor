import { BarChart, LineChart } from '@mantine/charts';
import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  IconCalendarDue,
  IconChartLine,
  IconCirclePlus,
  IconPercentage,
  IconReceipt2,
  IconWallet,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { lookupSecurity } from '@/api/hooks';
import { type MarketBondDetail, useMarketBond } from '@/api/marketHooks';
import type { Security } from '@/api/types';
import { PageTitle } from '@/components/PageTitle';
import { type SeriesDef, SeriesLegend, useSeriesToggle } from '@/components/SeriesLegend';
import { Stat } from '@/components/Stat';
import { BondFormModal } from '@/features/bonds/BondFormModal';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format';

import { AuctionsTable } from './AuctionsTab';
import { currencyColor, QueryState, SourceNote, useCompact } from './common';

type Range = '3m' | '1y' | 'all';
const RANGE_MONTHS: Record<Range, number | null> = { '3m': 3, '1y': 12, all: null };

function PriceCharts({ detail }: { detail: MarketBondDetail }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const [range, setRange] = useState<Range>('1y');
  const series: SeriesDef[] = [
    { name: 'price', label: t('market.bond.cleanPrice'), color: 'brand.5' },
    { name: 'yield', label: t('market.bond.yield'), color: 'orange.5' },
  ];
  const toggle = useSeriesToggle('chart:market-price', series);
  const dualAxis = toggle.visible.length === 2;
  const months = RANGE_MONTHS[range];
  const from = months === null ? null : dayjs().subtract(months, 'month').format('YYYY-MM-DD');
  const trades = detail.trades.filter((q) => from === null || q.day >= from);
  const priced = trades
    .filter((q) => q.clean_price !== null || q.yield_avg !== null)
    .map((q) => ({
      day: formatDate(q.day),
      price: q.clean_price === null ? null : Number(q.clean_price),
      yield: q.yield_avg === null ? null : Math.round(Number(q.yield_avg) * 10000) / 100,
    }));
  const volumes = trades.map((q) => ({
    day: formatDate(q.day),
    dvp: Number(q.volume_uah ?? 0),
    free: Number(q.volume_free_uah ?? 0),
  }));

  return (
    <>
      <Paper withBorder p="md">
        <Group justify="space-between" mb="md">
          <Text fw={600}>{t('market.bond.priceTitle')}</Text>
          <Group gap="lg">
            <SeriesLegend series={series} isVisible={toggle.isVisible} onToggle={toggle.toggle} />
            <SegmentedControl
              size="xs"
              value={range}
              onChange={(v) => setRange(v === '3m' || v === 'all' ? v : '1y')}
              data={[
                { value: '3m', label: t('market.range.3m') },
                { value: '1y', label: t('market.range.1y') },
                { value: 'all', label: t('market.range.all') },
              ]}
            />
          </Group>
        </Group>
        {priced.length < 2 ? (
          <Text size="sm" c="dimmed">
            {t('market.bond.noTrades')}
          </Text>
        ) : (
          <LineChart
            h={300}
            data={priced}
            dataKey="day"
            connectNulls
            curveType="linear"
            withDots={priced.length < 40}
            strokeWidth={2}
            yAxisProps={{ width: 60, domain: ['auto', 'auto'] }}
            rightYAxisProps={{ width: 60, domain: ['auto', 'auto'] }}
            withRightYAxis={dualAxis}
            yAxisLabel={dualAxis ? t('market.bond.cleanPriceAxis') : undefined}
            rightYAxisLabel={dualAxis ? t('market.bond.yieldAxis') : undefined}
            valueFormatter={(v) => formatNumber(v)}
            series={toggle.visible.map((s) => ({
              ...s,
              yAxisId: dualAxis && s.name === 'yield' ? 'right' : undefined,
            }))}
          />
        )}
        <Group justify="space-between" mt="xs">
          <Text size="xs" c="dimmed">
            {t('market.priceNote')}
          </Text>
          <SourceNote source={t('market.source.trades')} />
        </Group>
      </Paper>
      {volumes.length > 0 && (
        <Paper withBorder p="md">
          <Text fw={600} mb="md">
            {t('market.bond.volumeTitle')}
          </Text>
          <BarChart
            h={200}
            data={volumes}
            dataKey="day"
            type="stacked"
            withLegend
            valueFormatter={(v) => compact(v, 'UAH')}
            yAxisProps={{ width: 80 }}
            series={[
              { name: 'dvp', label: t('market.bond.volumeDvp'), color: 'teal.5' },
              { name: 'free', label: t('market.bond.volumeFree'), color: 'gray.4' },
            ]}
          />
          <Text size="xs" c="dimmed" mt="xs">
            {t('market.bond.volumeHint')}
          </Text>
        </Paper>
      )}
    </>
  );
}

function Schedule({ detail }: { detail: MarketBondDetail }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const { bond } = detail;
  const today = dayjs().format('YYYY-MM-DD');
  const upcoming = detail.schedule.filter((s) => s.pay_date >= today);
  return (
    <Paper withBorder>
      <Group justify="space-between" p="md" pb={0}>
        <Text fw={600}>{t('market.bond.schedule')}</Text>
        <Text size="xs" c="dimmed">
          {t('market.bond.scheduleHint', { bonds: formatNumber(bond.outstanding_bonds, 0) })}
        </Text>
      </Group>
      <Table.ScrollContainer minWidth={500}>
        <Table verticalSpacing="xs" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.date')}</Table.Th>
              <Table.Th>{t('common.type')}</Table.Th>
              <Table.Th ta="right">{t('market.bond.perBond')}</Table.Th>
              <Table.Th ta="right">{t('market.bond.onOutstanding')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {upcoming.map((s) => (
              <Table.Tr key={`${s.pay_date}-${s.kind}`}>
                <Table.Td>{formatDate(s.pay_date)}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm" color={s.kind === 'coupon' ? 'teal' : 'red'}>
                    {t(`kind.${s.kind}`)}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">{formatMoney(s.amount_per_unit, bond.currency)}</Table.Td>
                <Table.Td ta="right">
                  {compact(Number(s.amount_per_unit) * bond.outstanding_bonds, bond.currency)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function BondView({ detail }: { detail: MarketBondDetail }) {
  const { t } = useTranslation();
  const compact = useCompact();
  const { bond } = detail;
  const quote = bond.last_trade;
  const [adding, setAdding] = useState<Security | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const startAdding = async () => {
    setAddError(null);
    try {
      setAdding(await lookupSecurity(bond.isin));
    } catch (error) {
      setAddError((error as Error).message);
    }
  };

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        <Anchor component={Link} to="/market">
          {t('market.title')}
        </Anchor>
        <Text>{bond.isin}</Text>
      </Breadcrumbs>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="xs">
            <PageTitle page="market">{bond.name}</PageTitle>
            <Badge variant="light" color={currencyColor(bond.currency)}>
              {bond.currency}
            </Badge>
            {bond.variable_rate && (
              <Badge variant="light" color="orange">
                {t('market.bond.variable')}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {t('market.bond.subtitle', {
              isin: bond.isin,
              issued: formatDate(bond.issue_date),
              maturity: formatDate(bond.maturity_date),
              face: formatMoney(bond.face_value, bond.currency),
            })}
          </Text>
        </div>
        {bond.instrument_id !== null ? (
          <Button component={Link} to="/bonds" variant="light" color="violet">
            {t('market.bond.inMyBonds')}
          </Button>
        ) : (
          <Button
            variant="light"
            leftSection={<IconCirclePlus size={16} />}
            onClick={() => void startAdding()}
          >
            {t('market.bond.add')}
          </Button>
        )}
      </Group>
      {addError && <Alert color="red">{addError}</Alert>}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
        <Stat icon={IconWallet} label={t('market.bond.outstanding')}>
          <Text fz={22} fw={800} lh={1.2}>
            {compact(bond.outstanding, bond.currency)}
          </Text>
          <Text size="sm" c="dimmed">
            {t('market.bond.shareLine', {
              share: formatPercent(bond.market_share),
              bonds: formatNumber(bond.outstanding_bonds, 0),
            })}
          </Text>
        </Stat>
        <Stat icon={IconPercentage} color="grape" label={t('market.bond.coupon')}>
          <Text fz={22} fw={800} lh={1.2}>
            {Number(bond.coupon_rate) === 0
              ? t('market.discount')
              : formatPercent(bond.coupon_rate)}
          </Text>
          <Text size="sm" c="dimmed">
            {t(`bonds.frequencies.${bond.coupon_frequency as 0 | 1 | 2 | 4 | 12}`)}
          </Text>
        </Stat>
        <Stat icon={IconChartLine} color="blue" label={t('market.bond.lastPrice')}>
          <Text fz={22} fw={800} lh={1.2}>
            {quote?.clean_price == null ? '—' : formatNumber(quote.clean_price)}
          </Text>
          <Text size="sm" c="dimmed">
            {quote
              ? t('market.bond.dirtyOn', {
                  dirty: quote.dirty_price == null ? '—' : formatNumber(quote.dirty_price),
                  date: formatDate(quote.day),
                })
              : t('market.bond.noTrades')}
          </Text>
        </Stat>
        <Stat icon={IconReceipt2} color="orange" label={t('market.bond.yield')}>
          <Text fz={22} fw={800} lh={1.2}>
            {formatPercent(quote?.yield_avg)}
          </Text>
          <Text size="sm" c="dimmed">
            {quote?.yield_min != null && quote.yield_max != null
              ? t('market.bond.yieldRange', {
                  min: formatPercent(quote.yield_min),
                  max: formatPercent(quote.yield_max),
                })
              : bond.last_auction
                ? t('market.bond.auctionYield', {
                    value: formatPercent(bond.last_auction.yield_avg),
                    date: formatDate(bond.last_auction.day),
                  })
                : ''}
          </Text>
        </Stat>
        <Stat icon={IconCalendarDue} color="teal" label={t('market.bond.nextPayment')}>
          <Text fz={22} fw={800} lh={1.2}>
            {formatDate(bond.next_payment_date)}
          </Text>
          <Text size="sm" c="dimmed">
            {t('market.bond.volume30', { value: compact(bond.volume_30d_uah, 'UAH') })}
          </Text>
        </Stat>
      </SimpleGrid>
      <PriceCharts detail={detail} />
      <Paper withBorder>
        <Group justify="space-between" p="md" pb={0}>
          <Text fw={600}>{t('market.bond.auctions')}</Text>
          <SourceNote source={t('market.source.auctions')} />
        </Group>
        {detail.auctions.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">
            {t('market.bond.noAuctions')}
          </Text>
        ) : (
          <AuctionsTable
            auctions={detail.auctions}
            storageKey="table:market-bond-auctions"
            withBond={false}
          />
        )}
      </Paper>
      <Schedule detail={detail} />
      {adding && (
        <BondFormModal opened instrument={null} prefill={adding} onClose={() => setAdding(null)} />
      )}
    </Stack>
  );
}

export function MarketBondPage() {
  const isin = useParams().isin ?? '';
  const detail = useMarketBond(isin);
  return <QueryState query={detail}>{(data) => <BondView detail={data} />}</QueryState>;
}
