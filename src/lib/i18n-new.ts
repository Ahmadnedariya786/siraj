import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { SUPPORTED_CODES, DEFAULT_LANGUAGE } from '@/lib/language-config';

// Only English is bundled synchronously in the main chunk; non-active locales load as split chunks
import enTranslations from '../locales/en.json';

const loadedLocales = new Set<string>(['en']);

export async function ensureLocaleLoaded(lang: string): Promise<void> {
  if (!lang || loadedLocales.has(lang)) return;
  let mod: { default: Record<string, unknown> } | null = null;
  switch (lang) {
    case 'ar':
      mod = await import('../locales/ar.json');
      break;
    case 'ur':
      mod = await import('../locales/ur.json');
      break;
    case 'gu':
      mod = await import('../locales/gu.json');
      break;
    case 'hi':
      mod = await import('../locales/hi.json');
      break;
    case 'bn':
      mod = await import('../locales/bn.json');
      break;
    case 'ru':
      mod = await import('../locales/ru.json');
      break;
    case 'fr':
      mod = await import('../locales/fr.json');
      break;
    default:
      return;
  }
  if (mod?.default) {
    i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
    loadedLocales.add(lang);
  }
}

const resources = {
  en: { translation: enTranslations },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_CODES,
    debug: false,
    showSupportNotice: false,

    interpolation: {
      escapeValue: true, // Enable escaping for security
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
    },

    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;
