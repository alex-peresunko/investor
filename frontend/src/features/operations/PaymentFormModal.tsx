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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useInstruments, useLots, useSales, useSavePayment, useSchedule } from '@/api/hooks';
import type { Currency, Payment } from '@/api/types';
import { DateField } from '@/components/DateField';
import { FxRateInput } from '@/components/FxRateInput';
import { MoneyInput } from '@/components/MoneyInput';
import { formatNumber } from '@/lib/format';
import { heldBefore } from '@/lib/holdings';
import { nonNegative, positive, required, toDecimal, translateErrors } from '@/lib/validation';

import { needsCurrencyRate, useOperationRates } from './useOperationRates';

const schema = z.object({
  instrument_id: required,
  pay_date: required,
  total_amount: positive,
  fee: nonNegative,
  fx_rate: positive,
});

type Kind = 'coupon' | 'redemption';

type Values = {
  instrument_id: string | null;
  kind: Kind;
  pay_date: string | null;
  total_amount: number | string;
  fee: number | string;
  fx_rate: number | string;
  currency_rate: number | string;
  note: string;
};

/** Prefill for a new payment, e.g. a scheduled payment that was never recorded. */
export interface PaymentDraft {
  instrument_id: number;
  currency: Currency;
  kind: Kind;
  pay_date: string;
  total_amount: string;
}

interface Props {
  payment: Payment | null;
  draft?: PaymentDraft;
  onClose: () => void;
}

export function PaymentFormModal({ payment, draft, onClose }: Props) {
  const { t } = useTranslation();
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
          total_amount: Number(payment.total_amount),
          fee: Number(payment.fee),
          fx_rate: Number(payment.fx_rate),
          currency_rate: payment.currency_rate ? Number(payment.currency_rate) : '',
          note: payment.note ?? '',
        }
      : {
          instrument_id: draft ? String(draft.instrument_id) : null,
          kind: draft?.kind ?? 'coupon',
          pay_date: draft?.pay_date ?? null,
          total_amount: draft ? Number(draft.total_amount) : '',
          fee: 0,
          fx_rate: '',
          currency_rate: '',
          note: '',
        },
    validate: translateErrors(schemaResolver(schema, { sync: true })),
  });
  const instrumentId = form.values.instrument_id ? Number(form.values.instrument_id) : null;
  const schedule = useSchedule(instrumentId);
  const currency = instruments.data?.find((i) => i.id === instrumentId)?.currency;
  const rates = useOperationRates(currency, {
    fx: (rate) => form.setFieldValue('fx_rate', rate),
    currency: (rate) => form.setFieldValue('currency_rate', rate),
  });
  const unit = t(`currencyUnit.${currency ?? 'UAH'}`);
  const draftDate = draft?.pay_date;
  const draftCurrency = draft?.currency;
  useEffect(() => {
    if (draftDate) void rates.load(draftDate, draftCurrency);
    // Once on open: later date changes load the rate from the date field's onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftDate, draftCurrency]);
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
        'total_amount',
        Math.round(Number(item.amount_per_unit) * qty * 100) / 100,
      );
    }
  };

  const submit = form.onSubmit(async (v) => {
    if (needsCurrencyRate(currency) && !(Number(v.currency_rate) > 0)) {
      form.setFieldError('currency_rate', t('validation.positive'));
      return;
    }
    await save.mutateAsync({
      id: payment?.id,
      body: {
        instrument_id: Number(v.instrument_id),
        kind: v.kind,
        pay_date: v.pay_date ?? '',
        total_amount: toDecimal(v.total_amount),
        fee: toDecimal(v.fee),
        fx_rate: toDecimal(v.fx_rate),
        currency_rate: needsCurrencyRate(currency) ? toDecimal(v.currency_rate) : null,
        note: v.note.trim() || null,
      },
    });
    onClose();
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={payment ? t('paymentForm.edit', { id: payment.id }) : t('paymentForm.new')}
      size="lg"
    >
      <form onSubmit={submit}>
        <SegmentedControl
          fullWidth
          mb="sm"
          data={[
            { value: 'coupon', label: t('kind.coupon') },
            { value: 'redemption', label: t('kind.redemption') },
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
              prefillAmount({ instrument_id: value });
              const bond = instruments.data?.find((i) => i.id === Number(value));
              void rates.loadCurrency(form.values.pay_date, bond?.currency);
            }}
          />
          <DateField
            label={t('paymentForm.paymentDate')}
            {...form.getInputProps('pay_date')}
            onChange={(value) => {
              form.setFieldValue('pay_date', value);
              prefillAmount({ pay_date: value });
              void rates.load(value);
            }}
          />
          <MoneyInput
            label={t('paymentForm.total', { currency: unit })}
            description={t('paymentForm.totalDescription')}
            {...form.getInputProps('total_amount')}
          />
          <MoneyInput
            label={t('common.feeIn', { currency: unit })}
            {...form.getInputProps('fee')}
          />
          <FxRateInput
            loading={rates.usd.loading}
            onRefresh={() => void rates.usd.load(form.values.pay_date)}
            {...form.getInputProps('fx_rate')}
          />
          {needsCurrencyRate(currency) && (
            <FxRateInput
              currency="EUR"
              loading={rates.eur.loading}
              onRefresh={() => void rates.eur.load(form.values.pay_date)}
              {...form.getInputProps('currency_rate')}
            />
          )}
        </SimpleGrid>
        {held !== null && (
          <Text size="sm" c="dimmed" mt="xs">
            {t('paymentForm.heldBefore', { count: held, held: formatNumber(held, 0) })}
          </Text>
        )}
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
