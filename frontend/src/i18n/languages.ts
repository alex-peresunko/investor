import 'dayjs/locale/uk';

import type { Language } from '@/api/types';
import en from '@/locales/en.json';
import uk from '@/locales/uk.json';

export type Messages = typeof en;

export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * Keyed by the backend's language enum, so a language added there fails to compile until it is
 * registered here. `label` is the language's own name; `dayjsLocale` must be imported above.
 */
export const LANGUAGES: Record<
  Language,
  { label: string; dayjsLocale: string; messages: Messages }
> = {
  en: { label: 'English', dayjsLocale: 'en', messages: en },
  uk: { label: 'Українська', dayjsLocale: 'uk', messages: uk },
};

export function isLanguage(value: string): value is Language {
  return Object.hasOwn(LANGUAGES, value);
}
