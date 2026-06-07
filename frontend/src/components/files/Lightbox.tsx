'use client';

import { formatSize, formatDate } from '@/lib/utils';
import type { FileInfo } from '@/types';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { VisibilityToggle } from '@/components/ui/VisibilityToggle';
import { OpenInNewTab } from '@/components/ui/OpenInNewTab';
import { CopyButton } from '@/components/ui/CopyButton';
import { useTranslation } from '@/i18n';

interface Props {
  image: FileInfo;
  index: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  copiedId: number | null;
  deletingId: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCopyLink: (filename: string, id: number) => void;
  onDelete: (id: number) => void;
  onTogglePublic: (id: number, isPublic: boolean) => void;
}

export function Lightbox({
  image,
  index,
  total,
  hasPrev,
  hasNext,
  copiedId,
  deletingId,
  onClose,
  onPrev,
  onNext,
  onCopyLink,
  onDelete,
  onTogglePublic,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label={t('ui.common.close', 'Close')}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        onClick={onClose}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      {hasPrev && (
        <button
          type="button"
          aria-label={t('ui.files.previous_image', 'Previous image')}
          className="absolute left-4 z-10 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          aria-label={t('ui.files.next_image', 'Next image')}
          className="absolute right-4 z-10 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
      {hasPrev && (
        <img
          src={`${location.origin}/file/${image.filename}`}
          className="hidden"
          alt=""
        />
      )}
      {hasNext && (
        <img
          src={`${location.origin}/file/${image.filename}`}
          className="hidden"
          alt=""
        />
      )}
      <img
        key={image.filename}
        src={`${location.origin}/file/${image.filename}`}
        alt={image.original_name}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg opacity-0 transition-opacity duration-300"
        onLoad={(e) => (e.currentTarget.style.opacity = '1')}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {image.original_name}
            </p>
            <p className="text-xs text-zinc-400">
              {formatSize(image.size)} · {formatDate(image.created_at)} ·{' '}
              {index + 1}/{total}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <VisibilityToggle
              isPublic={!!image.is_public}
              onClick={() => onTogglePublic(image.id, !image.is_public)}
            />
            <OpenInNewTab
              href={`/file/${image.filename}`}
              onClick={(e) => e.stopPropagation()}
            />
            <CopyButton
              filename={image.filename}
              id={image.id}
              copiedId={copiedId}
              onClick={() => onCopyLink(image.filename, image.id)}
            />
            <DeleteButton
              id={image.id}
              confirming={deletingId === image.id}
              onClick={() => onDelete(image.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
