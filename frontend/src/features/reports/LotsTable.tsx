import { Badge, Table, Text } from '@mantine/core';
import { useNavigate } from 'react-router';

import type { LotSummary } from '@/api/reportHooks';
import { MoneyText } from '@/components/Stat';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';

export function LotsTable({ lots }: { lots: LotSummary[] }) {
  const navigate = useNavigate();
  if (lots.length === 0) {
    return (
      <Text c="dimmed" p="lg">
        No packages in this period.
      </Text>
    );
  }
  return (
    <Table.ScrollContainer minWidth={1000}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Package</Table.Th>
            <Table.Th>Bond</Table.Th>
            <Table.Th>Bought</Table.Th>
            <Table.Th>Maturity</Table.Th>
            <Table.Th ta="right">Held / bought</Table.Th>
            <Table.Th ta="right">Value, USD</Table.Th>
            <Table.Th ta="right">P&L, UAH</Table.Th>
            <Table.Th ta="right">P&L, USD</Table.Th>
            <Table.Th ta="right">XIRR, USD</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lots.map((lot) => {
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
                    {open ? 'open' : 'closed'}
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
