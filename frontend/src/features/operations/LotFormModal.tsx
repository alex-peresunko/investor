import { Button, Group, Modal, Select, SimpleGrid, Textarea } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useInstruments, useSaveLot, useSchedule } from '@/api/hooks';
import type { Lot } from '@/api/types';
import { DateField } from '@/components/DateField';
import { FxRateInput } from '@/components/FxRateInput';
import { MoneyInput } from '@/components/MoneyInput';
import { accruedPerUnit } from '@/lib/accrued';
import { nonNegative, positive, required, toDecimal, translateErrors } from '@/lib/validation';

import { useNbuRate } from './useNbuRate';

const schema = z.object({
  instrument_id: required,
  trade_date: required,
  quantity: positive,
  price_per_unit: positive,
  total_cost_uah: positive,
  accrued_paid_uah: nonNegative,
  fee_uah: nonNegative,
  fx_rate: positive,
});

type Values = {
  instrument_id: string | null;
  trade_date: string | null;
  quantity: number | string;
  price_per_unit: number | string;
  total_cost_uah: number | string;
  accrued_paid_uah: number | string;
  fee_uah: number | string;
  fx_rate: number | string;
  note: string;
};

interface Props {
  lot: Lot | null;
  onClose: () => void;
}

export function LotFormModal({ lot, onClose }: Props) {
  const { t } = useTranslation();
  const instruments = useInstruments();
  const save = useSaveLot();
  const form = useForm<Values>({
    initialValues: lot
      ? {
          instrument_id: String(lot.instrument_id),
          trade_date: lot.trade_date,
          quantity: Number(lot.quantity),
          price_per_unit: Number(lot.price_per_unit),
          total_cost_uah: Number(lot.total_cost_uah),
          accrued_paid_uah: Number(lot.accrued_paid_uah),
          fee_uah: Number(lot.fee_uah),
          fx_rate: Number(lot.fx_rate),
          note: lot.note ?? '',
        }
      : {
          instrument_id: null,
          trade_date: null,
          quantity: '',
          price_per_unit: '',
          total_cost_uah: '',
          accrued_paid_uah: 0,
          fee_uah: 0,
          fx_rate: '',
          note: '',
        },
    validate: translateErrors(schemaResolver(schema, { sync: true })),
  });
  const instrumentId = form.values.instrument_id ? Number(form.values.instrument_id) : null;
  const schedule = useSchedule(instrumentId);
  const nbu = useNbuRate((rate) => form.setFieldValue('fx_rate', rate));

  // Prefills only on user edits of the source fields, so manual overrides of the totals stick.
  const prefill = (patch: Partial<Values>) => {
    const next = { ...form.values, ...patch };
    const qty = Number(next.quantity);
    const price = Number(next.price_per_unit);
    if (qty > 0 && price > 0)
      form.setFieldValue('total_cost_uah', Math.round(qty * price * 100) / 100);
    const instrument = instruments.data?.find((i) => i.id === Number(next.instrument_id));
    if (instrument && schedule.data && next.trade_date && qty > 0) {
      const accrued = accruedPerUnit(instrument, schedule.data, next.trade_date) * qty;
      form.setFieldValue('accrued_paid_uah', Math.round(accrued * 100) / 100);
    }
  };

  const submit = form.onSubmit(async (v) => {
    await save.mutateAsync({
      id: lot?.id,
      body: {
        instrument_id: Number(v.instrument_id),
        trade_date: v.trade_date ?? '',
        quantity: toDecimal(v.quantity),
        price_per_unit: toDecimal(v.price_per_unit),
        total_cost_uah: toDecimal(v.total_cost_uah),
        accrued_paid_uah: toDecimal(v.accrued_paid_uah),
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
      title={lot ? t('lotForm.edit', { id: lot.id }) : t('lotForm.new')}
      size="lg"
    >
      <form onSubmit={submit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label={t('common.bond')}
            placeholder={t('common.selectBond')}
            searchable
            data={(instruments.data ?? []).map((i) => ({
              value: String(i.id),
              label: `${i.isin} · ${i.name}`,
            }))}
            {...form.getInputProps('instrument_id')}
            onChange={(value) => {
              form.setFieldValue('instrument_id', value);
              prefill({ instrument_id: value });
            }}
          />
          <DateField
            label={t('lotForm.purchaseDate')}
            {...form.getInputProps('trade_date')}
            onChange={(value) => {
              form.setFieldValue('trade_date', value);
              prefill({ trade_date: value });
              void nbu.load(value);
            }}
          />
          <MoneyInput
            label={t('common.quantity')}
            decimalScale={0}
            {...form.getInputProps('quantity')}
            onChange={(value) => {
              form.setFieldValue('quantity', value);
              prefill({ quantity: value });
            }}
          />
          <MoneyInput
            label={t('lotForm.price')}
            description={t('lotForm.priceDescription')}
            decimalScale={6}
            {...form.getInputProps('price_per_unit')}
            onChange={(value) => {
              form.setFieldValue('price_per_unit', value);
              prefill({ price_per_unit: value });
            }}
          />
          <MoneyInput
            label={t('lotForm.totalCost')}
            description={t('lotForm.totalCostDescription')}
            {...form.getInputProps('total_cost_uah')}
          />
          <MoneyInput
            label={t('lotForm.accruedPaid')}
            description={t('common.fromSchedule')}
            {...form.getInputProps('accrued_paid_uah')}
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
