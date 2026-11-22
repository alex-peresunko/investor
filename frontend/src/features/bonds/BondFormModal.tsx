import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { IconCloudDownload } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { lookupSecurity, useSaveInstrument } from '@/api/hooks';
import type { Currency, Instrument, Security } from '@/api/types';
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

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const TERMS = [
  'currency',
  'face_value',
  'coupon_rate_percent',
  'coupon_frequency',
  'issue_date',
  'maturity_date',
] as const;

const valuesOf = (s: Security): Values => ({
  isin: s.isin,
  name: s.name,
  currency: s.currency,
  face_value: Number(s.face_value),
  coupon_rate_percent: Math.round(Number(s.coupon_rate) * 1e6) / 1e4,
  coupon_frequency: String(s.coupon_frequency),
  issue_date: s.issue_date,
  maturity_date: s.maturity_date,
});

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
  const [nbu, setNbu] = useState<{
    terms: Values;
    schedule: Security['schedule'];
    variableRate: boolean;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  // NBU's published schedule is kept only while the terms it came with are unchanged.
  const nbuSchedule =
    nbu && TERMS.every((k) => String(form.values[k]) === String(nbu.terms[k]))
      ? nbu.schedule
      : null;

  const fillFromNbu = async () => {
    const isin = form.values.isin.trim().toUpperCase();
    if (!ISIN.test(isin)) {
      form.setFieldError('isin', t('validation.isin'));
      return;
    }
    setLookingUp(true);
    try {
      const security = await lookupSecurity(isin);
      const values = valuesOf(security);
      form.setValues(values);
      setNbu({
        terms: values,
        schedule: security.schedule,
        variableRate: security.variable_rate,
      });
    } catch (error) {
      form.setFieldError('isin', (error as Error).message);
    } finally {
      setLookingUp(false);
    }
  };

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
      schedule: nbuSchedule,
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
            rightSection={
              instrument ? null : (
                <Tooltip label={t('bonds.fillFromNbu')}>
                  <ActionIcon
                    variant="subtle"
                    loading={lookingUp}
                    onClick={() => void fillFromNbu()}
                    aria-label={t('bonds.fillFromNbu')}
                  >
                    <IconCloudDownload size={16} />
                  </ActionIcon>
                </Tooltip>
              )
            }
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
        {nbu && (
          <Text size="sm" c="dimmed" mt="sm">
            {nbuSchedule
              ? t('bonds.fromNbu', { count: nbuSchedule.length })
              : t('bonds.fromNbuChanged')}
            {nbu.variableRate && ` ${t('bonds.variableRate')}`}
          </Text>
        )}
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
