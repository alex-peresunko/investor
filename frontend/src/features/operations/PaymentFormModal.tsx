import {
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Text,
  Textarea,
} from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { z } from 'zod';

import { useInstruments, useLots, useSales, useSavePayment, useSchedule } from '@/api/hooks';
import type { Payment } from '@/api/types';
import { DateField } from '@/components/DateField';
import { FxRateInput } from '@/components/FxRateInput';
import { MoneyInput } from '@/components/MoneyInput';
import { formatNumber } from '@/lib/format';
import { heldBefore } from '@/lib/holdings';
import { nonNegative, positive, required, toDecimal } from '@/lib/validation';

import { useNbuRate } from './useNbuRate';

const schema = z.object({
  instrument_id: required,
  pay_date: required,
  total_amount_uah: positive,
  fee_uah: nonNegative,
  fx_rate: positive,
});

type Kind = 'coupon' | 'redemption';

type Values = {
  instrument_id: string | null;
  kind: Kind;
  pay_date: string | null;
  total_amount_uah: number | string;
  fee_uah: number | string;
  fx_rate: number | string;
  note: string;
};

interface Props {
  payment: Payment | null;
  onClose: () => void;
}

export function PaymentFormModal({ payment, onClose }: Props) {
  const instruments = useInstruments();
  const lots = useLots();
  const sales = useSales();
  const save = useSavePayment();
  const form = useForm<Values>({
    initialValues: payment
      ? {
          instrument_id: String(payment.instrument_id),
          kind: payment.kind,
          pay_date: payment.pay_date,
          total_amount_uah: Number(payment.total_amount_uah),
          fee_uah: Number(payment.fee_uah),
          fx_rate: Number(payment.fx_rate),
          note: payment.note ?? '',
        }
      : {
          instrument_id: null,
          kind: 'coupon',
          pay_date: null,
          total_amount_uah: '',
          fee_uah: 0,
          fx_rate: '',
          note: '',
        },
    validate: schemaResolver(schema, { sync: true }),
  });
  const instrumentId = form.values.instrument_id ? Number(form.values.instrument_id) : null;
  const schedule = useSchedule(instrumentId);
  const nbu = useNbuRate((rate) => form.setFieldValue('fx_rate', rate));
  const held =
    instrumentId !== null && form.values.pay_date
      ? heldBefore(instrumentId, form.values.pay_date, lots.data ?? [], sales.data ?? [])
      : null;

  // Suggests held quantity × scheduled amount when the date matches a scheduled payment.
  const prefillAmount = (patch: Partial<Values>) => {
    const next = { ...form.values, ...patch };
    if (!next.instrument_id || !next.pay_date || !schedule.data) return;
    const item = schedule.data.find((s) => s.kind === next.kind && s.pay_date === next.pay_date);
    const qty = heldBefore(
      Number(next.instrument_id),
      next.pay_date,
      lots.data ?? [],
      sales.data ?? [],
    );
    if (item && qty > 0) {
      form.setFieldValue(
        'total_amount_uah',
        Math.round(Number(item.amount_per_unit) * qty * 100) / 100,
      );
    }
  };

  const submit = form.onSubmit(async (v) => {
    await save.mutateAsync({
      id: payment?.id,
      body: {
        instrument_id: Number(v.instrument_id),
        kind: v.kind,
        pay_date: v.pay_date ?? '',
        total_amount_uah: toDecimal(v.total_amount_uah),
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
      title={payment ? `Edit payment #${payment.id}` : 'Record coupon or redemption'}
      size="lg"
    >
      <form onSubmit={submit}>
        <SegmentedControl
          fullWidth
          mb="sm"
          data={[
            { value: 'coupon', label: 'Coupon' },
            { value: 'redemption', label: 'Redemption' },
          ]}
          value={form.values.kind}
          onChange={(value) => {
            const kind: Kind = value === 'redemption' ? 'redemption' : 'coupon';
            form.setFieldValue('kind', kind);
            prefillAmount({ kind });
          }}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Bond"
            placeholder="Select a bond"
            searchable
            data={(instruments.data ?? []).map((i) => ({
              value: String(i.id),
              label: `${i.isin} · ${i.name}`,
            }))}
            {...form.getInputProps('instrument_id')}
            onChange={(value) => {
              form.setFieldValue('instrument_id', value);
              prefillAmount({ instrument_id: value });
            }}
          />
          <DateField
            label="Payment date"
            {...form.getInputProps('pay_date')}
            onChange={(value) => {
              form.setFieldValue('pay_date', value);
              prefillAmount({ pay_date: value });
              void nbu.load(value);
            }}
          />
          <MoneyInput
            label="Total received, UAH"
            description="For all your packages of this bond together"
            {...form.getInputProps('total_amount_uah')}
          />
          <MoneyInput label="Fee, UAH" {...form.getInputProps('fee_uah')} />
          <FxRateInput
            loading={nbu.loading}
            onRefresh={() => void nbu.load(form.values.pay_date)}
            {...form.getInputProps('fx_rate')}
          />
        </SimpleGrid>
        {held !== null && (
          <Text size="sm" c="dimmed" mt="xs">
            Held the day before: {formatNumber(held, 0)} bonds. The amount is split across packages
            in proportion to their holdings.
          </Text>
        )}
        <Textarea label="Note" mt="sm" autosize minRows={1} {...form.getInputProps('note')} />
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
