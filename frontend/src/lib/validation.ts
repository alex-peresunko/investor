import { z } from 'zod';

type NumberField = number | string;

const numberField = z.union([z.number(), z.string()]);

export const positive = numberField.refine((v) => v !== '' && Number(v) > 0, {
  message: 'Must be greater than 0',
});

export const nonNegative = numberField.refine((v) => v !== '' && Number(v) >= 0, {
  message: 'Cannot be negative',
});

export const required = z.string({ error: 'Required' }).min(1, 'Required');

/** Mantine NumberInput yields number | ''; the API takes decimal strings. */
export function toDecimal(value: NumberField): string {
  return String(value);
}
