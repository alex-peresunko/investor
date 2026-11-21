import { Button, Group, Modal, Select, SimpleGrid, Textarea } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useInstruments, useLots, useSales, useSaveSale, useSchedule } from '@/api/hooks';
import type { Sale } from '@/api/types';
import { DateField } from '@/components/DateField';
import { FxRateInput } from '@/components/FxRateInput';
import { MoneyInput } from '@/components/MoneyInput';
import { accruedPerUnit } from '@/lib/accrued';
import { formatDate, formatNumber } from '@/lib/format';
import { soldQuantity } from '@/lib/holdings';
import { nonNegative, positive, required, toDecimal, translateErrors } from '@/lib/validation';

import { useNbuRate } from './useNbuRate';

const schema = z.object({
  lot_id: required,
  trade_date: required,
  quantity: positive,
  total_proceeds_uah: positive,
  accrued_received_uah: nonNegative,
  fee_uah: nonNegative,
  fx_rate: positive,
});

type Values = {
  lot_id: string | null;
  trade_date: string | null;
  quantity: number | string;
  total_proceeds_uah: number | string;
  accrued_received_uah: number | string;
  fee_uah: number | string;
  fx_rate: number | string;
  note: string;
};

interface Props {
  sale: Sale | null;
  /** Preselected package when selling from a package page. */
  lotId?: number;
  onClose: () => void;
}

export function SaleFormModal({ sale, lotId, onClose }: Props) {
  const { t } = useTranslation();
  const instruments = useInstruments();
  const lots = useLots();
  const sales = useSales();
  const save = useSaveSale();
  const form = useForm<Values>({
    initialValues: sale
      ? {
          lot_id: String(sale.lot_id),
          trade_date: sale.trade_date,
          quantity: Number(sale.quantity),
          total_proceeds_uah: Number(sale.total_proceeds_uah),
          accrued_received_uah: Number(sale.accrued_received_uah),
          fee_uah: Number(sale.fee_uah),
          fx_rate: Number(sale.fx_rate),
          note: sale.note ?? '',
        }
      : {
          lot_id: lotId === undefined ? null : String(lotId),
          trade_date: null,
          quantity: '',
          total_proceeds_uah: '',
          accrued_received_uah: 0,
          fee_uah: 0,
          fx_rate: '',
          note: '',
        },
    validate: translateErrors(schemaResolver(schema, { sync: true })),
  });
  const nbu = useNbuRate((rate) => form.setFieldValue('fx_rate', rate));
  const selectedLot = lots.data?.find((l) => l.id === Number(form.values.lot_id));
  const schedule = useSchedule(selectedLot?.instrument_id ?? null);
  const isinOf = (instrumentId: number) =>
    instruments.data?.find((i) => i.id === instrumentId)?.isin ?? '';
  const available = (id: number) => {
    const lot = lots.data?.find((l) => l.id === id);
    return lot ? Number(lot.quantity) - soldQuantity(id, sales.data ?? [], sale?.id) : 0;
  };
  const options = (lots.data ?? [])
    .filter((l) => available(l.id) > 0 || l.id === sale?.lot_id)
    .map((l) => ({
      value: String(l.id),
      label: t('saleForm.option', {
        id: l.id,
        isin: isinOf(l.instrument_id),
        bought: formatDate(l.trade_date),
        available: formatNumber(available(l.id), 0),
      }),
    }));

  const prefillAccrued = (patch: Partial<Values>) => {
    const next = { ...form.values, ...patch };
    const lot = lots.data?.find((l) => l.id === Number(next.lot_id));
    const instrument = instruments.data?.find((i) => i.id === lot?.instrument_id);
    const qty = Number(next.quantity);
    if (instrument && schedule.data && next.trade_date && qty > 0) {
      const accrued = accruedPerUnit(instrument, schedule.data, next.trade_date) * qty;
      form.setFieldValue('accrued_received_uah', Math.round(accrued * 100) / 100);
    }
  };

  const submit = form.onSubmit(async (v) => {
    await save.mutateAsync({
      id: sale?.id,
      body: {
        lot_id: Number(v.lot_id),
        trade_date: v.trade_date ?? '',
        quantity: toDecimal(v.quantity),
        total_proceeds_uah: toDecimal(v.total_proceeds_uah),
        accrued_received_uah: toDecimal(v.accrued_received_uah),
        fee_uah: toDecimal(v.fee_uah),
        fx_rate: toDecimal(v.fx_rate),
        note: v.note.trim() || null,
      },
    });
    onClose();
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={sale ? t('saleForm.edit', { id: sale.id }) : t('saleForm.new')}
      size="lg"
    >
      <form onSubmit={submit}>
        <Select
          label={t('common.package')}
          placeholder={t('saleForm.selectPackage')}
          data={options}
          mb="sm"
          {...form.getInputProps('lot_id')}
          onChange={(value) => {
            form.setFieldValue('lot_id', value);
            prefillAccrued({ lot_id: value });
          }}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <DateField
            label={t('saleForm.saleDate')}
            {...form.getInputProps('trade_date')}
            onChange={(value) => {
              form.setFieldValue('trade_date', value);
              prefillAccrued({ trade_date: value });
              void nbu.load(value);
            }}
          />
          <MoneyInput
            label={t('common.quantity')}
            decimalScale={0}
            description={
              selectedLot
                ? t('saleForm.available', {
                    available: formatNumber(available(selectedLot.id), 0),
                  })
                : undefined
            }
            {...form.getInputProps('quantity')}
            onChange={(value) => {
              form.setFieldValue('quantity', value);
              prefillAccrued({ quantity: value });
            }}
          />
          <MoneyInput
            label={t('saleForm.proceeds')}
            description={t('saleForm.proceedsDescription')}
            {...form.getInputProps('total_proceeds_uah')}
          />
          <MoneyInput
            label={t('saleForm.accruedReceived')}
            description={t('common.fromSchedule')}
            {...form.getInputProps('accrued_received_uah')}
          />
          <MoneyInput label={t('common.feeUah')} {...form.getInputProps('fee_uah')} />
          <FxRateInput
            loading={nbu.loading}
            onRefresh={() => void nbu.load(form.values.trade_date)}
            {...form.getInputProps('fx_rate')}
          />
        </SimpleGrid>
        <Textarea
          label={t('common.note')}
          mt="sm"
          autosize
          minRows={1}
          {...form.getInputProps('note')}
        />
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
