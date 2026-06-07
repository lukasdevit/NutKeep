'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

type Locale = 'en' | 'pl';
type Translations = Record<string, string>;

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}>({
  locale: 'en',
  setLocale: () => {},
  t: (key, fallback) => fallback ?? key,
});

const LOCALE_STORAGE_KEY = 'linqoy-locale';

const DOMAINS = ['cors', 'auth', 'file', 'upload', 'storage', 'db', 'integrity', 'backup', 'action', 'common'] as const;

function loadTranslations(locale: Locale): Translations {
  const merged: Translations = {};
  for (const domain of DOMAINS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chunk = require(`@/i18n/locales/${locale}/${domain}.json`);
      Object.assign(merged, chunk);
    } catch {
      // domain file missing — skip
    }
  }
  return merged;
}

// Preload both to avoid flicker
const translationsCache: Record<Locale, Translations> = {
  en: loadTranslations('en'),
  pl: loadTranslations('pl'),
};

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'pl' || stored === 'en') return stored;
  const navLang = navigator.language.toLowerCase();
  if (navLang.startsWith('pl')) return 'pl';
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return translationsCache[locale]?.[key] ?? fallback ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

/** Get current locale outside of React (reads localStorage) */
export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'pl' || stored === 'en') return stored as Locale;
  const navLang = navigator.language.toLowerCase();
  if (navLang.startsWith('pl')) return 'pl';
  return 'en';
}

/** Translate a messageKey outside of React — for error handlers, API utils, etc. */
export function translate(key: string, fallback?: string): string {
  const locale = getLocale();
  return translationsCache[locale]?.[key] ?? fallback ?? key;
}
