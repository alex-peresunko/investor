import { Badge, Table, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import type { LotSummary } from '@/api/reportHooks';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { MoneyText } from '@/components/Stat';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

const COLUMNS = {
  package: (l) => l.lot_id,
  bond: (l) => l.isin,
  bought: (l) => l.trade_date,
  maturity: (l) => l.maturity_date,
  held: (l) => Number(l.open_quantity),
  value: (l) => Number(l.pnl.closing_value.usd),
  pnlUah: (l) => Number(l.pnl.pnl.uah),
  pnlUsd: (l) => Number(l.pnl.pnl.usd),
  xirr: (l) => (l.xirr_usd === null ? null : Number(l.xirr_usd)),
} satisfies SortColumns<LotSummary, string>;

export function LotsTable({ lots, storageKey }: { lots: LotSummary[]; storageKey: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sort = useSortedRows(storageKey, lots, COLUMNS, 'bought');
  if (lots.length === 0) {
    return (
      <Text c="dimmed" p="lg">
        {t('lots.empty')}
      </Text>
    );
  }
  return (
    <Table.ScrollContainer minWidth={1000}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <SortTh {...sort.th('package')}>{t('common.package')}</SortTh>
            <SortTh {...sort.th('bond')}>{t('common.bond')}</SortTh>
            <SortTh {...sort.th('bought')}>{t('lots.bought')}</SortTh>
            <SortTh {...sort.th('maturity')}>{t('lots.maturity')}</SortTh>
            <SortTh ta="right" {...sort.th('held')}>
              {t('lots.heldBought')}
            </SortTh>
            <SortTh ta="right" {...sort.th('value')}>
              {t('lots.valueUsd')}
            </SortTh>
            <SortTh ta="right" {...sort.th('pnlUah')}>
              {t('lots.pnlUah')}
            </SortTh>
            <SortTh ta="right" {...sort.th('pnlUsd')}>
              {t('lots.pnlUsd')}
            </SortTh>
            <SortTh ta="right" {...sort.th('xirr')}>
              {t('lots.xirrUsd')}
            </SortTh>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sort.rows.map((lot) => {
            const open = Number(lot.open_quantity) > 0;
            return (
              <Table.Tr
                key={lot.lot_id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/packages/${lot.lot_id}`)}
              >
                <Table.Td>
                  #{lot.lot_id}{' '}
                  <Badge size="xs" variant="light" color={open ? 'blue' : 'gray'} ml={4}>
                    {open ? t('common.open') : t('common.closed')}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {lot.isin}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {lot.name}
                  </Text>
                </Table.Td>
                <Table.Td>{formatDate(lot.trade_date)}</Table.Td>
                <Table.Td>{formatDate(lot.maturity_date)}</Table.Td>
                <Table.Td ta="right">
                  {formatNumber(lot.open_quantity, 0)} / {formatNumber(lot.quantity, 0)}
                </Table.Td>
                <Table.Td ta="right">
                  <MoneyText value={lot.pnl.closing_value.usd} currency="USD" />
                </Table.Td>
                <Table.Td ta="right">
                  <MoneyText value={lot.pnl.pnl.uah} currency="UAH" signed />
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  <MoneyText value={lot.pnl.pnl.usd} currency="USD" signed />
                </Table.Td>
                <Table.Td ta="right">{formatPercent(lot.xirr_usd)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
