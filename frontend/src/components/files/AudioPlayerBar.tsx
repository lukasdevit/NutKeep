'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatSize } from '@/lib/utils';
import { OpenInNewTab } from '@/components/ui/OpenInNewTab';
import { CopyButton } from '@/components/ui/CopyButton';
import { DeleteButton } from '@/components/ui/DeleteButton';
import type { FileInfo } from '@/types';

const VOLUME_KEY = 'linqoy_audio_volume';

function loadVolume(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw !== null) {
      const v = parseFloat(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
    }
  } catch { /* ignore */ }
  return 1;
}

function saveVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* ignore */ }
}

interface Props {
  currentAudio: FileInfo | null;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  copiedId: number | null;
  deletingId: number | null;
  onPlayPause: () => void;
  onNext: () => void;
  onClose: () => void;
  onDelete: (id: number) => void;
  onCopyLink: (filename: string, id: number) => void;
}

export function AudioPlayerBar({
  currentAudio,
  isPlaying,
  audioRef,
  copiedId,
  deletingId,
  onPlayPause,
  onNext,
  onClose,
  onDelete,
  onCopyLink,
}: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(loadVolume);
  const [muted, setMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [formatSupported, setFormatSupported] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveVolume(volume);
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted, audioRef]);

  const showSlider = useCallback(() => {
    setShowVolumeSlider(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    if (currentAudio && audioRef.current) {
      const canPlay = audioRef.current.canPlayType(currentAudio.mime_type);
      setFormatSupported(canPlay === 'probably' || canPlay === 'maybe');
    } else {
      setFormatSupported(true);
    }
  }, [currentAudio, audioRef]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => setDuration(el.duration || 0);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDur);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDur);
    };
  }, [audioRef, currentAudio]);

  if (!currentAudio) return null;

  const src = `${location.origin}/file/${currentAudio.filename}`;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!progressRef.current || !audioRef.current || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
  }

  function formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 border-t border-zinc-800 backdrop-blur-sm">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />

      {/* Progress bar (thin clickable strip) */}
      <div
        ref={progressRef}
        className="h-1 bg-zinc-800 cursor-pointer group"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-blue-500 transition-[width] duration-150 group-hover:bg-blue-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      {!formatSupported && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center">
          <span className="text-xs text-amber-400">
            Warning: Your browser may not support this audio format ({currentAudio.mime_type}). Try opening in a new tab.
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2 max-w-5xl mx-auto">
        {/* Previous — restart current track */}
        <button
          type="button"
          aria-label="Restart track"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }}
          className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={onPlayPause}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next — random audio file */}
        <button
          type="button"
          aria-label="Random track"
          onClick={onNext}
          className="shrink-0 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
          </svg>
        </button>

        {/* Replay / Loop toggle */}
        <button
          type="button"
          aria-label={loop ? 'Disable loop' : 'Enable loop'}
          onClick={() => {
            const next = !loop;
            setLoop(next);
            if (audioRef.current) audioRef.current.loop = next;
          }}
          className={`shrink-0 p-1.5 rounded-md transition-colors ${
            loop
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {currentAudio.original_name}
          </p>
          <p className="text-xs text-zinc-500">
            {formatTime(currentTime)} / {formatTime(duration)} · {formatSize(currentAudio.size)}
          </p>
        </div>

        {/* Volume */}
        <div
          className="relative flex items-center shrink-0"
          onMouseEnter={showSlider}
          onMouseLeave={() => setShowVolumeSlider(false)}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.01 : 0.01;
            setVolume((v) => Math.max(0, Math.min(1, +(v + delta).toFixed(2))));
            setMuted(false);
          }}
        >
          <button
            type="button"
            aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
            onClick={() => setMuted((m) => !m)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {muted || volume === 0 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9" />
              </svg>
            )}
          </button>
          {/* Volume slider */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              showVolumeSlider ? 'w-28 ml-1 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              aria-label="Volume"
              className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm
                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <OpenInNewTab href={src} />
          <CopyButton
            filename={currentAudio.filename}
            id={currentAudio.id}
            copiedId={copiedId}
            onClick={() => onCopyLink(currentAudio.filename, currentAudio.id)}
          />
          <DeleteButton
            id={currentAudio.id}
            confirming={deletingId === currentAudio.id}
            onClick={() => onDelete(currentAudio.id)}
          />
          <button
            type="button"
            aria-label="Close player"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
