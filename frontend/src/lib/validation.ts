import type { FormErrors } from '@mantine/form';
import { z } from 'zod';

import { i18n } from '@/i18n/i18n';

type NumberField = number | string;

// Schema messages are translation keys; `translateErrors` turns them into text.
const numberField = z.union([z.number(), z.string()]);

export const positive = numberField.refine((v) => v !== '' && Number(v) > 0, {
  message: 'validation.positive',
});

export const nonNegative = numberField.refine((v) => v !== '' && Number(v) >= 0, {
  message: 'validation.nonNegative',
});

export const required = z.string({ error: 'validation.required' }).min(1, 'validation.required');

/** Wraps a form resolver so its message keys come back translated into the current language. */
export function translateErrors<V>(validate: (values: V) => FormErrors) {
  return (values: V): FormErrors =>
    Object.fromEntries(
      Object.entries(validate(values)).map(([field, key]) => [
        field,
        typeof key === 'string' && i18n.exists(key) ? i18n.t(key as 'validation.required') : key,
      ]),
    );
}

/** Mantine NumberInput yields number | ''; the API takes decimal strings. */
export function toDecimal(value: NumberField): string {
  return String(value);
}
