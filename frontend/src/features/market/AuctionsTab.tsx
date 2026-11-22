import { Anchor, Badge, Group, Paper, Table, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import type { MarketAuction } from '@/api/marketHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

import {
  currencyColor,
  type CurrencyFilter,
  CurrencyPicker,
  SourceNote,
  useCompact,
} from './common';

const columns = {
  // Default order, newest first; not a column of its own.
  recent: (a) => -Date.parse(a.day),
  date: (a) => a.day,
  isin: (a) => a.isin,
  currency: (a) => a.currency,
  maturity: (a) => a.maturity_date,
  bucket: (a) => a.bucket,
  yield: (a) => (a.yield_avg === null ? null : Number(a.yield_avg)),
  cutoff: (a) => (a.yield_cutoff === null ? null : Number(a.yield_cutoff)),
  bid: (a) => Number(a.bid),
  sold: (a) => Number(a.sold),
  cover: (a) => (Number(a.sold) ? Number(a.bid) / Number(a.sold) : null),
  raised: (a) => Number(a.raised),
} satisfies SortColumns<MarketAuction, string>;

const KEY = (a: MarketAuction) => `${a.day}-${a.number}-${a.isin}`;

/** Auctions table; also used on a bond's page with `withBond` off. */
export function AuctionsTable({
  auctions,
  storageKey,
  withBond = true,
}: {
  auctions: MarketAuction[];
  storageKey: string;
  withBond?: boolean;
}) {
  const { t } = useTranslation();
  const compact = useCompact();
  const sort = useSortedRows(storageKey, auctions, columns, 'recent');
  const heads: { key: Exclude<keyof typeof columns, 'recent'>; right?: boolean; hint?: string }[] =
    [
      { key: 'date' },
      ...(withBond
        ? ([{ key: 'isin' }, { key: 'currency' }, { key: 'maturity' }, { key: 'bucket' }] as const)
        : []),
      { key: 'yield', right: true },
      { key: 'cutoff', right: true },
      { key: 'bid', right: true },
      { key: 'sold', right: true },
      { key: 'cover', right: true, hint: t('market.auctions.coverHint') },
      { key: 'raised', right: true },
    ];
  return (
    <Table.ScrollContainer minWidth={withBond ? 1000 : 600}>
      <Table verticalSpacing="xs" striped>
        <Table.Thead>
          <Table.Tr>
            {heads.map((h) => (
              <SortTh
                key={h.key}
                ta={h.right ? 'right' : undefined}
                title={h.hint}
                {...sort.th(h.key)}
              >
                {t(`market.auctions.col.${h.key}`)}
              </SortTh>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sort.rows.map((a) => (
            <Table.Tr key={KEY(a)}>
              <Table.Td>{formatDate(a.day)}</Table.Td>
              {withBond && (
                <>
                  <Table.Td>
                    <Anchor component={Link} to={`/market/${a.isin}`} size="sm" ff="monospace">
                      {a.isin}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={currencyColor(a.currency)}>
                      {a.currency}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatDate(a.maturity_date)}</Table.Td>
                  <Table.Td>{a.bucket}</Table.Td>
                </>
              )}
              <Table.Td ta="right">{formatPercent(a.yield_avg)}</Table.Td>
              <Table.Td ta="right">{formatPercent(a.yield_cutoff)}</Table.Td>
              <Table.Td ta="right">{compact(a.bid, a.currency)}</Table.Td>
              <Table.Td ta="right">{compact(a.sold, a.currency)}</Table.Td>
              <Table.Td ta="right">
                {Number(a.sold) ? formatNumber(Number(a.bid) / Number(a.sold)) : '—'}
              </Table.Td>
              <Table.Td ta="right">{compact(a.raised, a.currency)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function AuctionsTab({ data }: { data: MarketAuction[] }) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<CurrencyFilter>('all');
  const rows = useMemo(
    () => data.filter((a) => currency === 'all' || a.currency === currency),
    [data, currency],
  );
  return (
    <Paper withBorder>
      <Group justify="space-between" p="md" pb="xs">
        <Group>
          <CurrencyPicker value={currency} onChange={setCurrency} />
          <Text size="xs" c="dimmed">
            {t('market.auctions.count', { count: rows.length })}
          </Text>
        </Group>
        <SourceNote source={t('market.source.auctions')} day={data[0]?.day} />
      </Group>
      <AuctionsTable auctions={rows} storageKey="table:market-auctions" />
    </Paper>
  );
}
