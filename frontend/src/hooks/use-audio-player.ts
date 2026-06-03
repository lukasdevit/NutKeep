'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileInfo } from '@/types';

const VOLUME_KEY = 'linqoy_audio_volume';

function getSavedVolume(): number {
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

/**
 * Hook for managing the bottom-bar audio player.
 * Audio files don't open a modal — they play in the fixed bottom bar.
 */
export function useAudioPlayer() {
  const [currentAudio, setCurrentAudio] = useState<FileInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((file: FileInfo) => {
    setCurrentAudio(file);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    setIsPlaying(true);
    if (audioRef.current) audioRef.current.play().catch(() => {});
  }, []);

  const close = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentAudio(null);
  }, []);

  // Sync audio element play/pause with isPlaying state
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentAudio) return;

    const src = `${location.origin}/file/${currentAudio.filename}`;
    if (el.src !== src) {
      el.src = src;
      el.load();
      // load() resets volume to 1 — restore saved volume immediately
      el.volume = getSavedVolume();
    }

    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [currentAudio, isPlaying]);

  // Listen for native ended event
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [currentAudio]);

  return {
    currentAudio,
    isPlaying,
    audioRef,
    play,
    pause,
    resume,
    close,
  };
}
