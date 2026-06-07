'use client';

import { useTranslation } from '@/i18n';

const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  pl: '🇵🇱',
};

const LABELS: Record<string, string> = {
  en: 'English',
  pl: 'Polski',
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as 'en' | 'pl')}
      className="bg-transparent border border-zinc-700 rounded px-2 py-1 text-sm cursor-pointer hover:border-zinc-500 transition-colors"
      title={LABELS[locale]}
      aria-label="Switch language"
    >
      <option value="en">{FLAGS.en} EN</option>
      <option value="pl">{FLAGS.pl} PL</option>
    </select>
  );
}
