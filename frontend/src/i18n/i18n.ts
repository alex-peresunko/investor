import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(LANGUAGES).map(([code, { messages }]) => [code, { translation: messages }]),
  ),
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: Object.keys(LANGUAGES),
  initAsync: false,
  // React escapes rendered text already.
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

export { i18n };
