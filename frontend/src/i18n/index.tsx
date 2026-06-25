'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

// ── Static imports — guaranteed to be bundled correctly ──
import enCommon from '@/i18n/locales/en/common.json';
import enUi from '@/i18n/locales/en/ui.json';
import enCors from '@/i18n/locales/en/cors.json';
import enAuth from '@/i18n/locales/en/auth.json';
import enFile from '@/i18n/locales/en/file.json';
import enUpload from '@/i18n/locales/en/upload.json';
import enStorage from '@/i18n/locales/en/storage.json';
import enDb from '@/i18n/locales/en/db.json';
import enIntegrity from '@/i18n/locales/en/integrity.json';
import enBackup from '@/i18n/locales/en/backup.json';
import enAction from '@/i18n/locales/en/action.json';

import plCommon from '@/i18n/locales/pl/common.json';
import plUi from '@/i18n/locales/pl/ui.json';
import plCors from '@/i18n/locales/pl/cors.json';
import plAuth from '@/i18n/locales/pl/auth.json';
import plFile from '@/i18n/locales/pl/file.json';
import plUpload from '@/i18n/locales/pl/upload.json';
import plStorage from '@/i18n/locales/pl/storage.json';
import plDb from '@/i18n/locales/pl/db.json';
import plIntegrity from '@/i18n/locales/pl/integrity.json';
import plBackup from '@/i18n/locales/pl/backup.json';
import plAction from '@/i18n/locales/pl/action.json';

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

function mergeChunks(chunks: Translations[]): Translations {
  const merged: Translations = {};
  for (const chunk of chunks) {
    Object.assign(merged, chunk);
  }
  return merged;
}

// Preload both locales from static imports — guaranteed to work
const translationsCache: Record<Locale, Translations> = {
  en: mergeChunks([enCommon, enUi, enCors, enAuth, enFile, enUpload, enStorage, enDb, enIntegrity, enBackup, enAction]),
  pl: mergeChunks([plCommon, plUi, plCors, plAuth, plFile, plUpload, plStorage, plDb, plIntegrity, plBackup, plAction]),
};

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'pl' || stored === 'en') return stored;
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
  return 'en';
}

/** Translate a messageKey outside of React — for error handlers, API utils, etc. */
export function translate(key: string, fallback?: string): string {
  const locale = getLocale();
  return translationsCache[locale]?.[key] ?? fallback ?? key;
}
