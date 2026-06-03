'use client';

import { formatSize, formatDate, isOpenable, isAudio } from '@/lib/utils';
import type { FileInfo } from '@/types';
import { TAG_COLORS, DEFAULT_TAG_COLOR } from '@/config/constants';
import { VisibilityToggle } from '@/components/ui/VisibilityToggle';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { useGlowEffect } from '@/hooks/use-glow-effect';

interface Props {
  files: FileInfo[];
  total?: number;
  copiedId: number | null;
  deletingId: number | null;
  /** ID of the currently playing audio file — used for the now-playing indicator */
  currentAudioId: number | null;
  onCopyLink: (filename: string, id: number) => void;
  onTogglePublic: (id: number, isPublic: boolean) => void;
  onDelete: (id: number) => void;
  onOpenViewer: (file: FileInfo) => void;
  onPlayAudio: (file: FileInfo) => void;
}

function getExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext.length <= 5 ? ext : '';
}

function TagBadge({ filename }: { filename: string }) {
  const ext = getExt(filename);
  const color = ext ? TAG_COLORS[ext] || DEFAULT_TAG_COLOR : DEFAULT_TAG_COLOR;
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${color}`}
    >
      {ext ? `.${ext}` : '?'}
    </span>
  );
}

function FileRow({
  f,
  isNowPlaying,
  onClick,
  children,
}: {
  f: FileInfo;
  isNowPlaying: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const { ref, onMouseMove, onMouseLeave } = useGlowEffect<HTMLLIElement>();
  return (
    <li
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`pressable glow-hover glow-blue flex items-center gap-3 p-3 rounded-lg border
        ${isOpenable(f.mime_type) ? 'cursor-pointer' : ''}
        ${isNowPlaying ? 'border-violet-500/60 bg-violet-500/5 shadow-[0_0_12px_rgba(139,92,246,0.08)]' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
      onClick={onClick}
    >
      {children}
    </li>
  );
}

export function FileList({
  files,
  total,
  copiedId,
  deletingId,
  currentAudioId,
  onCopyLink,
  onTogglePublic,
  onDelete,
  onOpenViewer,
  onPlayAudio,
}: Props) {
  return (
    <section>
      <ul className="space-y-1.5">
        {files.map((f) => {
          const isNowPlaying = currentAudioId === f.id && isAudio(f.mime_type);
          return (
          <FileRow
            key={f.id}
            f={f}
            isNowPlaying={isNowPlaying}
            onClick={() => {
              if (!isOpenable(f.mime_type)) return;
              if (isAudio(f.mime_type)) onPlayAudio(f);
              else onOpenViewer(f);
            }}
          >
            {/* Tag badge */}
            <TagBadge filename={f.original_name} />
            {isNowPlaying && (
              <span className="shrink-0 flex gap-0.5 items-end h-3">
                <span className="w-0.5 bg-violet-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" style={{ height: '60%' }} />
                <span className="w-0.5 bg-violet-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite]" style={{ height: '100%' }} />
                <span className="w-0.5 bg-violet-400 rounded-full animate-[pulse_0.6s_ease-in-out_0.1s_infinite]" style={{ height: '80%' }} />
              </span>
            )}
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isNowPlaying ? 'text-blue-300' : 'text-zinc-200'}`}>
                {f.original_name}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {formatSize(f.size)} · {formatDate(f.created_at)}
                {f.expires_at && (
                  <span className="text-amber-500 ml-1">
                    · Expires {formatDate(f.expires_at)}
                  </span>
                )}
              </p>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <VisibilityToggle
                isPublic={!!f.is_public}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePublic(f.id, !f.is_public);
                }}
              />
              <DeleteButton
                id={f.id}
                confirming={deletingId === f.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(f.id);
                }}
              />
              <CopyButton
                filename={f.filename}
                id={f.id}
                copiedId={copiedId}
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyLink(f.filename, f.id);
                }}
              />
            </div>
          </FileRow>
        )})}
      </ul>
    </section>
  );
}
