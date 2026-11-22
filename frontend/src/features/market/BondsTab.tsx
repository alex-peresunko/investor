import { ScatterChart } from '@mantine/charts';
import {
  Badge,
  Checkbox,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import type { MarketBond, MarketBonds } from '@/api/marketHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

import {
  CURRENCY_COLORS,
  currencyColor,
  type CurrencyFilter,
  CurrencyPicker,
  SourceNote,
  useCompact,
  yearsBetween,
} from './common';

// Quotes older than this are left off the yield curve.
const CURVE_MAX_AGE_DAYS = 30;

const columns = {
  isin: (b) => b.isin,
  currency: (b) => b.currency,
  maturity: (b) => b.maturity_date,
  coupon: (b) => Number(b.coupon_rate),
  outstanding: (b) => Number(b.outstanding_uah),
  share: (b) => Number(b.market_share),
  price: (b) => (b.last_trade?.clean_price == null ? null : Number(b.last_trade.clean_price)),
  yield: (b) => (b.last_trade?.yield_avg == null ? null : Number(b.last_trade.yield_avg)),
  traded: (b) => b.last_trade?.day ?? null,
  volume: (b) => Number(b.volume_30d_uah),
  auction: (b) => (b.last_auction?.yield_avg == null ? null : Number(b.last_auction.yield_avg)),
} satisfies SortColumns<MarketBond, string>;

function YieldCurve({ bonds, asOf }: { bonds: MarketBond[]; asOf: string | null }) {
  const { t } = useTranslation();
  const data = (['UAH', 'USD', 'EUR'] as const).flatMap((currency) => {
    const points = bonds
      .filter(
        (b) =>
          b.currency === currency &&
          b.last_trade?.yield_avg != null &&
          asOf !== null &&
          yearsBetween(b.last_trade.day, asOf) * 365.25 <= CURVE_MAX_AGE_DAYS,
      )
      .map((b) => ({
        years: Math.round(yearsBetween(asOf ?? b.maturity_date, b.maturity_date) * 100) / 100,
        yield: Math.round(Number(b.last_trade?.yield_avg) * 10000) / 100,
      }));
    return points.length
      ? [{ name: currency, color: CURRENCY_COLORS[currency], data: points }]
      : [];
  });

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="xs">
        <div>
          <Text fw={600}>{t('market.curve.title')}</Text>
          <Text size="xs" c="dimmed">
            {t('market.curve.hint', { days: CURVE_MAX_AGE_DAYS })}
          </Text>
        </div>
        <SourceNote source={t('market.source.trades')} day={asOf} />
      </Group>
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('common.noData')}
        </Text>
      ) : (
        <ScatterChart
          h={280}
          data={data}
          dataKey={{ x: 'years', y: 'yield' }}
          xAxisLabel={t('market.curve.years')}
          yAxisLabel={t('market.curve.yield')}
          unit={{ y: '%' }}
          withLegend
          valueFormatter={{ x: (v) => formatNumber(v, 1), y: (v) => `${formatNumber(v)} %` }}
        />
      )}
    </Paper>
  );
}

function sortable(t: TFunction) {
  return (key: keyof typeof columns, ta?: 'right') => ({ key, ta, label: t(`market.col.${key}`) });
}

export function BondsTab({ data }: { data: MarketBonds }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const compact = useCompact();
  const [currency, setCurrency] = useState<CurrencyFilter>('all');
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.bonds.filter(
      (b) =>
        (currency === 'all' || b.currency === currency) &&
        (!mine || b.instrument_id !== null) &&
        (!query || `${b.isin} ${b.name}`.toLowerCase().includes(query)),
    );
  }, [data.bonds, currency, search, mine]);
  const sort = useSortedRows('table:market-bonds', rows, columns, 'maturity');
  const th = sortable(t);
  const heads = [
    th('isin'),
    th('currency'),
    th('maturity'),
    th('coupon', 'right'),
    th('outstanding', 'right'),
    th('share', 'right'),
    th('price', 'right'),
    th('yield', 'right'),
    th('traded'),
    th('volume', 'right'),
    th('auction', 'right'),
  ];

  return (
    <Stack gap="md">
      <YieldCurve bonds={data.bonds} asOf={data.trades_as_of} />
      <Paper withBorder>
        <Group justify="space-between" p="md" pb="xs">
          <Group>
            <TextInput
              size="xs"
              w={240}
              leftSection={<IconSearch size={14} />}
              placeholder={t('market.search')}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <CurrencyPicker value={currency} onChange={setCurrency} />
            <Checkbox
              size="xs"
              label={t('market.onlyMine')}
              checked={mine}
              onChange={(e) => setMine(e.currentTarget.checked)}
            />
          </Group>
          <Text size="xs" c="dimmed">
            {t('market.bondsShown', { count: sort.rows.length })}
          </Text>
        </Group>
        <Table.ScrollContainer minWidth={1100}>
          <Table verticalSpacing="xs" highlightOnHover striped>
            <Table.Thead>
              <Table.Tr>
                {heads.map((h) => (
                  <SortTh key={h.key} ta={h.ta} {...sort.th(h.key)}>
                    {h.label}
                  </SortTh>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sort.rows.map((b) => (
                <Table.Tr
                  key={b.isin}
                  style={{ cursor: 'pointer' }}
                  onClick={() => void navigate(`/market/${b.isin}`)}
                >
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <div>
                        <Text size="sm" fw={600} ff="monospace">
                          {b.isin}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {b.name}
                        </Text>
                      </div>
                      {b.instrument_id !== null && (
                        <Badge size="xs" variant="light" color="violet">
                          {t('market.mine')}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={currencyColor(b.currency)}>
                      {b.currency}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatDate(b.maturity_date)}</Table.Td>
                  <Table.Td ta="right">
                    {Number(b.coupon_rate) === 0
                      ? t('market.discount')
                      : formatPercent(b.coupon_rate)}
                    {b.variable_rate && (
                      <Tooltip label={t('market.variableHint')}>
                        <Text span c="orange" ml={4}>
                          *
                        </Text>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{compact(b.outstanding, b.currency)}</Table.Td>
                  <Table.Td ta="right">{formatPercent(b.market_share)}</Table.Td>
                  <Table.Td ta="right">
                    {b.last_trade?.clean_price == null
                      ? '—'
                      : formatNumber(b.last_trade.clean_price)}
                  </Table.Td>
                  <Table.Td ta="right">{formatPercent(b.last_trade?.yield_avg)}</Table.Td>
                  <Table.Td>{formatDate(b.last_trade?.day)}</Table.Td>
                  <Table.Td ta="right">
                    {Number(b.volume_30d_uah) ? compact(b.volume_30d_uah, 'UAH') : '—'}
                  </Table.Td>
                  <Table.Td ta="right">
                    {b.last_auction ? (
                      <Tooltip label={formatDate(b.last_auction.day)}>
                        <span>{formatPercent(b.last_auction.yield_avg)}</span>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group p="md" pt="xs" justify="space-between">
          <Text size="xs" c="dimmed">
            {t('market.priceNote')}
          </Text>
          <SourceNote source={t('market.source.securities')} />
        </Group>
      </Paper>
    </Stack>
  );
}
