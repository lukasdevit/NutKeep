'use client';

import { useTranslation } from '@/i18n';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}

export function Pagination({ page, totalPages, total, onPrev, onNext, label }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-zinc-600">
        {t('ui.pagination.total', '{label}: {total} total')
          .replace('{label}', label)
          .replace('{total}', String(total))}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="pressable px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t('ui.pagination.prev', '← Prev')}
        </button>
        <span className="text-xs text-zinc-600 tabular-nums px-1">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="pressable px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t('ui.pagination.next', 'Next →')}
        </button>
      </div>
    </div>
  );
}
