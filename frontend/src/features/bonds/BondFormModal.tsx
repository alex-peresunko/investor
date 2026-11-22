import { Button, Group, Modal, Select, SimpleGrid, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useSaveInstrument } from '@/api/hooks';
import type { Currency, Instrument } from '@/api/types';
import { DateField } from '@/components/DateField';
import { MoneyInput } from '@/components/MoneyInput';
import { positive, required, toDecimal, translateErrors } from '@/lib/validation';

const FREQUENCIES = ['2', '4', '12', '1', '0'] as const;
const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR'];

const schema = z
  .object({
    isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'validation.isin'),
    name: z.string().min(1, 'validation.required').max(200),
    face_value: positive,
    coupon_rate_percent: z
      .union([z.number(), z.string()])
      .refine((v) => v !== '' && Number(v) >= 0 && Number(v) < 100, 'validation.percent'),
    coupon_frequency: required,
    issue_date: required,
    maturity_date: required,
  })
  .refine((v) => v.maturity_date > v.issue_date, {
    path: ['maturity_date'],
    message: 'validation.maturityAfterIssue',
  });

type Values = {
  isin: string;
  name: string;
  currency: Currency;
  face_value: number | string;
  coupon_rate_percent: number | string;
  coupon_frequency: string | null;
  issue_date: string | null;
  maturity_date: string | null;
};

interface Props {
  opened: boolean;
  onClose: () => void;
  instrument: Instrument | null;
}

export function BondFormModal({ opened, onClose, instrument }: Props) {
  const { t } = useTranslation();
  const save = useSaveInstrument();
  const form = useForm<Values>({
    initialValues: instrument
      ? {
          isin: instrument.isin,
          name: instrument.name,
          currency: instrument.currency,
          face_value: Number(instrument.face_value),
          coupon_rate_percent: Number(instrument.coupon_rate) * 100,
          coupon_frequency: String(instrument.coupon_frequency),
          issue_date: instrument.issue_date,
          maturity_date: instrument.maturity_date,
        }
      : {
          isin: '',
          name: '',
          currency: 'UAH',
          face_value: 1000,
          coupon_rate_percent: '',
          coupon_frequency: '2',
          issue_date: null,
          maturity_date: null,
        },
    validate: translateErrors(schemaResolver(schema, { sync: true })),
  });

  const submit = form.onSubmit(async (values) => {
    await save.mutateAsync({
      id: instrument?.id,
      body: {
        isin: values.isin.trim().toUpperCase(),
        currency: values.currency,
        name: values.name.trim(),
        face_value: toDecimal(values.face_value),
        // Percent in the form, fraction in the API: 16.5 -> 0.165.
        coupon_rate: (Number(values.coupon_rate_percent) / 100).toFixed(6),
        coupon_frequency: Number(values.coupon_frequency) as 0 | 1 | 2 | 4 | 12,
        issue_date: values.issue_date ?? '',
        maturity_date: values.maturity_date ?? '',
      },
    });
    onClose();
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={instrument ? t('bonds.edit') : t('bonds.add')}
      size="lg"
    >
      <form onSubmit={submit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={t('bonds.isin')}
            placeholder="UA4000227045"
            {...form.getInputProps('isin')}
          />
          <TextInput
            label={t('bonds.name')}
            placeholder={t('bonds.namePlaceholder')}
            {...form.getInputProps('name')}
          />
          <MoneyInput
            label={t('bonds.faceValueIn', {
              currency: t(`currencyUnit.${form.values.currency}`),
            })}
            {...form.getInputProps('face_value')}
          />
          <MoneyInput
            label={t('bonds.couponRate')}
            decimalScale={4}
            {...form.getInputProps('coupon_rate_percent')}
          />
          <Select
            label={t('bonds.couponFrequency')}
            data={FREQUENCIES.map((value) => ({
              value,
              label: t(`bonds.frequencies.${value}`),
            }))}
            allowDeselect={false}
            {...form.getInputProps('coupon_frequency')}
          />
          <Select
            label={t('common.currency')}
            description={t('bonds.currencyDescription')}
            data={CURRENCIES}
            allowDeselect={false}
            {...form.getInputProps('currency')}
            onChange={(value) => form.setFieldValue('currency', (value ?? 'UAH') as Currency)}
          />
          <DateField label={t('bonds.issueDate')} {...form.getInputProps('issue_date')} />
          <DateField label={t('bonds.maturityDate')} {...form.getInputProps('maturity_date')} />
        </SimpleGrid>
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
