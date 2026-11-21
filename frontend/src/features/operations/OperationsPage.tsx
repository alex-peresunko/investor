import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCash,
  IconDownload,
  IconPencil,
  IconShoppingCart,
  IconTrendingDown,
} from '@tabler/icons-react';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useDeleteLot,
  useDeletePayment,
  useDeleteSale,
  useInstruments,
  useLots,
  usePayments,
  useSales,
} from '@/api/hooks';
import type { Lot, Payment, Sale } from '@/api/types';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { type SortColumns, SortTh, useSortedRows } from '@/components/SortableTable';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

import { LotFormModal } from './LotFormModal';
import { PaymentFormModal } from './PaymentFormModal';
import { SaleFormModal } from './SaleFormModal';

type OpType = 'buy' | 'sell' | 'coupon' | 'redemption';

const TYPE_COLOR: Record<OpType, string> = {
  buy: 'blue',
  sell: 'orange',
  coupon: 'teal',
  redemption: 'grape',
};

interface Row {
  key: string;
  type: OpType;
  date: string;
  instrumentId: number;
  isin: string;
  lotId: number | null;
  quantity: string | null;
  /** Signed from the investor's view: money paid out is negative. */
  amountUah: number;
  feeUah: number;
  fxRate: number;
  record:
    | { kind: 'lot'; value: Lot }
    | { kind: 'sale'; value: Sale }
    | { kind: 'payment'; value: Payment };
}

const sortColumns = (t: TFunction) =>
  ({
    date: (r) => r.date,
    type: (r) => t(`kind.${r.type}`),
    bond: (r) => r.isin,
    package: (r) => r.lotId,
    quantity: (r) => (r.quantity === null ? null : Number(r.quantity)),
    amount: (r) => r.amountUah,
    fee: (r) => r.feeUah || null,
    fx: (r) => r.fxRate,
    amountUsd: (r) => r.amountUah / r.fxRate,
  }) satisfies SortColumns<Row, string>;

type Editing =
  | { kind: 'lot'; value: Lot | null }
  | { kind: 'sale'; value: Sale | null }
  | { kind: 'payment'; value: Payment | null }
  | null;

export function OperationsPage() {
  const { t, i18n } = useTranslation();
  const instruments = useInstruments();
  const lots = useLots();
  const sales = useSales();
  const payments = usePayments();
  const deleteLot = useDeleteLot();
  const deleteSale = useDeleteSale();
  const deletePayment = useDeletePayment();
  const [typeFilter, setTypeFilter] = useState<'all' | OpType>('all');
  const [bondFilter, setBondFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const rows = useMemo<Row[]>(() => {
    const lotById = new Map((lots.data ?? []).map((l) => [l.id, l]));
    const isinById = new Map((instruments.data ?? []).map((i) => [i.id, i.isin]));
    const isin = (id: number) => isinById.get(id) ?? '—';
    const all: Row[] = [
      ...(lots.data ?? []).map((l): Row => ({
        key: `lot-${l.id}`,
        type: 'buy',
        date: l.trade_date,
        instrumentId: l.instrument_id,
        isin: isin(l.instrument_id),
        lotId: l.id,
        quantity: l.quantity,
        amountUah: -Number(l.total_cost_uah),
        feeUah: Number(l.fee_uah),
        fxRate: Number(l.fx_rate),
        record: { kind: 'lot', value: l },
      })),
      ...(sales.data ?? []).map((s): Row => ({
        key: `sale-${s.id}`,
        type: 'sell',
        date: s.trade_date,
        instrumentId: lotById.get(s.lot_id)?.instrument_id ?? 0,
        isin: isin(lotById.get(s.lot_id)?.instrument_id ?? 0),
        lotId: s.lot_id,
        quantity: s.quantity,
        amountUah: Number(s.total_proceeds_uah),
        feeUah: Number(s.fee_uah),
        fxRate: Number(s.fx_rate),
        record: { kind: 'sale', value: s },
      })),
      ...(payments.data ?? []).map((p): Row => ({
        key: `payment-${p.id}`,
        type: p.kind,
        date: p.pay_date,
        instrumentId: p.instrument_id,
        isin: isin(p.instrument_id),
        lotId: null,
        quantity: null,
        amountUah: Number(p.total_amount_uah),
        feeUah: Number(p.fee_uah),
        fxRate: Number(p.fx_rate),
        record: { kind: 'payment', value: p },
      })),
    ];
    return all
      .filter((r) => typeFilter === 'all' || r.type === typeFilter)
      .filter((r) => bondFilter === null || r.instrumentId === Number(bondFilter));
  }, [instruments.data, lots.data, sales.data, payments.data, typeFilter, bondFilter]);
  const columns = useMemo(() => sortColumns(t), [t]);
  const sort = useSortedRows('table:operations', rows, columns, 'date');

  const queries = [instruments, lots, sales, payments];
  const error = queries.find((q) => q.isError)?.error;

  const remove = (row: Row) => {
    switch (row.record.kind) {
      case 'lot':
        return deleteLot.mutateAsync(row.record.value.id);
      case 'sale':
        return deleteSale.mutateAsync(row.record.value.id);
      case 'payment':
        return deletePayment.mutateAsync(row.record.value.id);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('operations.title')}</Title>
        <Group>
          <Button
            leftSection={<IconShoppingCart size={16} />}
            onClick={() => setEditing({ kind: 'lot', value: null })}
          >
            {t('operations.buy')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconTrendingDown size={16} />}
            onClick={() => setEditing({ kind: 'sale', value: null })}
          >
            {t('operations.sell')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconCash size={16} />}
            onClick={() => setEditing({ kind: 'payment', value: null })}
          >
            {t('operations.payment')}
          </Button>
          <Tooltip label={t('operations.export')}>
            <ActionIcon
              variant="default"
              size="lg"
              component="a"
              href={`/api/v1/export/operations.xlsx?lang=${i18n.language}`}
              aria-label={t('operations.exportAria')}
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Group mb="md">
        <SegmentedControl
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as 'all' | OpType)}
          data={[
            { value: 'all', label: t('common.all') },
            { value: 'buy', label: t('operations.filterBuys') },
            { value: 'sell', label: t('operations.filterSales') },
            { value: 'coupon', label: t('operations.filterCoupons') },
            { value: 'redemption', label: t('operations.filterRedemptions') },
          ]}
        />
        <Select
          placeholder={t('operations.allBonds')}
          clearable
          data={(instruments.data ?? []).map((i) => ({ value: String(i.id), label: i.isin }))}
          value={bondFilter}
          onChange={setBondFilter}
          w={200}
        />
      </Group>
      <Paper withBorder radius="md">
        {error ? (
          <Alert color="red">{error.message}</Alert>
        ) : queries.some((q) => q.isPending) ? (
          <Loader m="lg" />
        ) : rows.length === 0 ? (
          <Text c="dimmed" p="lg">
            {t('operations.empty')}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <SortTh {...sort.th('date')}>{t('common.date')}</SortTh>
                  <SortTh {...sort.th('type')}>{t('common.type')}</SortTh>
                  <SortTh {...sort.th('bond')}>{t('common.bond')}</SortTh>
                  <SortTh {...sort.th('package')}>{t('common.package')}</SortTh>
                  <SortTh ta="right" {...sort.th('quantity')}>
                    {t('common.quantity')}
                  </SortTh>
                  <SortTh ta="right" {...sort.th('amount')}>
                    {t('common.amountUah')}
                  </SortTh>
                  <SortTh ta="right" {...sort.th('fee')}>
                    {t('common.fee')}
                  </SortTh>
                  <SortTh ta="right" {...sort.th('fx')}>
                    {t('common.usdUah')}
                  </SortTh>
                  <SortTh ta="right" {...sort.th('amountUsd')}>
                    {t('common.amountUsd')}
                  </SortTh>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sort.rows.map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>{formatDate(row.date)}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={TYPE_COLOR[row.type]}>
                        {t(`kind.${row.type}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td ff="monospace">{row.isin}</Table.Td>
                    <Table.Td>
                      {row.lotId === null ? t('operations.allHeld') : `#${row.lotId}`}
                    </Table.Td>
                    <Table.Td ta="right">
                      {row.quantity === null ? '' : formatNumber(row.quantity, 0)}
                    </Table.Td>
                    <Table.Td ta="right" c={row.amountUah < 0 ? 'red' : 'teal'}>
                      {formatMoney(row.amountUah, 'UAH')}
                    </Table.Td>
                    <Table.Td ta="right">
                      {row.feeUah ? formatMoney(row.feeUah, 'UAH') : ''}
                    </Table.Td>
                    <Table.Td ta="right">{formatNumber(row.fxRate, 4)}</Table.Td>
                    <Table.Td ta="right" c={row.amountUah < 0 ? 'red' : 'teal'}>
                      {formatMoney(row.amountUah / row.fxRate, 'USD')}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label={t('common.edit')}>
                          <ActionIcon
                            variant="subtle"
                            aria-label={t('operations.editAria')}
                            onClick={() => setEditing(row.record)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <ConfirmDeleteButton
                          what={t(`operations.deleteWhat.${row.type}`, {
                            date: formatDate(row.date),
                          })}
                          onConfirm={() => remove(row)}
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
      {editing?.kind === 'lot' && (
        <LotFormModal lot={editing.value} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'sale' && (
        <SaleFormModal sale={editing.value} onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'payment' && (
        <PaymentFormModal payment={editing.value} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
