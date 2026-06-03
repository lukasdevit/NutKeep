'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { formatSize } from '@/lib/utils';
import { CopyButton } from '@/components/ui/CopyButton';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { OpenInNewTab } from '@/components/ui/OpenInNewTab';
import type { FileInfo } from '@/types';

const VOLUME_KEY = 'linqoy_video_volume';

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
  file: FileInfo;
  copiedId: number | null;
  deletingId: number | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onCopyLink: (filename: string, id: number) => void;
}

export function VideoViewer({
  file,
  copiedId,
  deletingId,
  onClose,
  onDelete,
  onCopyLink,
}: Props) {
  const src = `${location.origin}/file/${file.filename}`;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [volume, setVolume] = useState(loadVolume);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Apply our React volume/muted state to the video element + persist
  useEffect(() => {
    saveVolume(volume);
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  // 2) When the native browser volume control changes, sync back to React state
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onVolumeChange = () => {
      setVolume(el.volume);
      setMuted(el.muted);
    };
    el.addEventListener('volumechange', onVolumeChange);
    return () => el.removeEventListener('volumechange', onVolumeChange);
  }, []);

  // 3) When video src loads (new file), restore saved volume
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => {
      const saved = loadVolume();
      el.volume = saved;
      setVolume(saved);
      setMuted(false);
    };
    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [file]);

  // Auto-hide volume slider
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

  // Picture-in-Picture enter/leave tracking
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    el.addEventListener('enterpictureinpicture', onEnter);
    el.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      el.removeEventListener('enterpictureinpicture', onEnter);
      el.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [file]);

  // Keyboard shortcuts for video viewer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const el = videoRef.current;
      if (!el) return;
      if (e.key === ' ') {
        e.preventDefault();
        el.paused ? el.play() : el.pause();
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); el.currentTime = Math.max(0, el.currentTime - 5); }
      if (e.key === 'ArrowRight') { e.preventDefault(); el.currentTime = Math.min(el.duration || 0, el.currentTime + 5); }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); el.muted = !el.muted; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (document.pictureInPictureElement) document.exitPictureInPicture(); else el.requestFullscreen().catch(() => {}); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file]);

  async function togglePiP() {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement === el) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch { /* PiP not supported or denied */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
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
            {/* Volume */}
            <div
              className="relative flex items-center"
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
            <OpenInNewTab href={src} />
            <button
              type="button"
              aria-label={loop ? 'Disable loop' : 'Enable loop'}
              onClick={() => {
                const next = !loop;
                setLoop(next);
                if (videoRef.current) videoRef.current.loop = next;
              }}
              className={`p-1.5 rounded-md transition-colors ${
                loop
                  ? 'bg-violet-600 text-white hover:bg-violet-500'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={loop ? 'Loop on' : 'Loop off'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={isPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
              onClick={togglePiP}
              className={`p-1.5 rounded-md transition-colors ${
                isPiP
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Picture-in-Picture (P)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 4H8a2 2 0 00-2 2" />
              </svg>
            </button>
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
              aria-label="Close viewer"
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
        <div className="flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            controls
            className="max-w-full max-h-[75vh]"
            src={src}
            autoPlay
          >
            <track kind="captions" />
            Your browser does not support the video element.
          </video>
        </div>
      </div>
    </div>
  );
}
