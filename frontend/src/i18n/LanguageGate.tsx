import { DatesProvider } from '@mantine/dates';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES } from './languages';
import { usePreferences } from './preferences';

/**
 * Renders `children` once the saved language is applied, so the UI never flashes in the default
 * language. If preferences cannot be loaded, the default language is used.
 */
export function LanguageGate({ children }: { children: ReactNode }) {
  const preferences = usePreferences();
  const { i18n } = useTranslation();
  if (preferences.isPending) return null;
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  return (
    <DatesProvider settings={{ locale: LANGUAGES[language].dayjsLocale, firstDayOfWeek: 1 }}>
      {children}
    </DatesProvider>
  );
}
