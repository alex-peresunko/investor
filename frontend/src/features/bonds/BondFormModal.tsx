import { Button, Group, Modal, Select, SimpleGrid, TextInput } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import { z } from 'zod';

import { useSaveInstrument } from '@/api/hooks';
import type { Instrument } from '@/api/types';
import { DateField } from '@/components/DateField';
import { MoneyInput } from '@/components/MoneyInput';
import { positive, required, toDecimal } from '@/lib/validation';

const FREQUENCIES = [
  { value: '2', label: 'Semi-annual' },
  { value: '4', label: 'Quarterly' },
  { value: '12', label: 'Monthly' },
  { value: '1', label: 'Annual' },
  { value: '0', label: 'Zero-coupon' },
];

const schema = z
  .object({
    isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'ISIN: 12 characters, e.g. UA4000227045'),
    name: z.string().min(1, 'Required').max(200),
    face_value: positive,
    coupon_rate_percent: z
      .union([z.number(), z.string()])
      .refine((v) => v !== '' && Number(v) >= 0 && Number(v) < 100, 'Between 0 and 100'),
    coupon_frequency: required,
    issue_date: required,
    maturity_date: required,
  })
  .refine((v) => v.maturity_date > v.issue_date, {
    path: ['maturity_date'],
    message: 'Must be after the issue date',
  });

type Values = {
  isin: string;
  name: string;
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
  const save = useSaveInstrument();
  const form = useForm<Values>({
    initialValues: instrument
      ? {
          isin: instrument.isin,
          name: instrument.name,
          face_value: Number(instrument.face_value),
          coupon_rate_percent: Number(instrument.coupon_rate) * 100,
          coupon_frequency: String(instrument.coupon_frequency),
          issue_date: instrument.issue_date,
          maturity_date: instrument.maturity_date,
        }
      : {
          isin: '',
          name: '',
          face_value: 1000,
          coupon_rate_percent: '',
          coupon_frequency: '2',
          issue_date: null,
          maturity_date: null,
        },
    validate: schemaResolver(schema, { sync: true }),
  });

  const submit = form.onSubmit(async (values) => {
    await save.mutateAsync({
      id: instrument?.id,
      body: {
        isin: values.isin.trim().toUpperCase(),
        currency: 'UAH',
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
      title={instrument ? 'Edit bond' : 'Add bond'}
      size="lg"
    >
      <form onSubmit={submit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="ISIN" placeholder="UA4000227045" {...form.getInputProps('isin')} />
          <TextInput
            label="Name"
            placeholder="OVDP 16.5% 09/2027"
            {...form.getInputProps('name')}
          />
          <MoneyInput label="Face value, UAH" {...form.getInputProps('face_value')} />
          <MoneyInput
            label="Coupon rate, % per year"
            decimalScale={4}
            {...form.getInputProps('coupon_rate_percent')}
          />
          <Select
            label="Coupon frequency"
            data={FREQUENCIES}
            allowDeselect={false}
            {...form.getInputProps('coupon_frequency')}
          />
          <div />
          <DateField label="Issue date" {...form.getInputProps('issue_date')} />
          <DateField label="Maturity date" {...form.getInputProps('maturity_date')} />
        </SimpleGrid>
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
