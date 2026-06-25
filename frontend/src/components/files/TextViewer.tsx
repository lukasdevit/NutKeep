'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { formatSize } from '@/lib/utils';
import { CopyButton } from '@/components/ui/CopyButton';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { OpenInNewTab } from '@/components/ui/OpenInNewTab';
import { useTranslation } from '@/i18n';
import type { FileInfo } from '@/types';

interface Props {
  file: FileInfo;
  content: string | null;
  copiedId: number | null;
  deletingId: number | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onCopyLink: (filename: string, id: number) => void;
}

export function TextViewer({
  file,
  content,
  copiedId,
  deletingId,
  onClose,
  onDelete,
  onCopyLink,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {file.original_name}
            </p>
            <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OpenInNewTab href={`/file/${file.filename}`} />
            <CopyButton
              filename={file.filename}
              id={file.id}
              copiedId={copiedId}
              onClick={() => onCopyLink(file.filename, file.id)}
            />
            <DeleteButton
              id={file.id}
              confirming={deletingId === file.id}
              onClick={() => onDelete(file.id)}
            />
            <button
              type="button"
              aria-label={t('ui.files.close_viewer', 'Close viewer')}
              onClick={onClose}
              className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4"
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
          </div>
        </div>
        <div className="overflow-auto max-h-[70vh]">
          {content === null && file.mime_type !== 'application/pdf' ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : file.mime_type === 'application/pdf' ? (
            <iframe
              src={`${location.origin}/file/${file.filename}`}
              className="w-full h-[70vh] border-0"
              title={file.original_name}
              sandbox="allow-scripts"
            />
          ) : file.mime_type === 'text/markdown' ||
            file.original_name.endsWith('.md') ? (
            <MarkdownBody content={content!} />
          ) : (
            <pre className="p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap break-all">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Private ── */

function MarkdownBody({ content }: { content: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content) as string),
    [content]
  );
  return (
    <div
      className="p-4 text-sm text-zinc-300 markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
