import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import englishTranslations from '@shared/translations/english.json';
import arabicTranslations from '@shared/translations/arabic.json';

// Ref: CLAUDE.md §10. English primary; Arabic complete. Strings never hardcoded.
const storedLanguage = localStorage.getItem('mizan.language') ?? 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: englishTranslations },
    ar: { translation: arabicTranslations },
  },
  lng: storedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
