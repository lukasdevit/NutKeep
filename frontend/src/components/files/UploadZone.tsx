'use client';

import { useRef, useState, useCallback } from 'react';
import { useUppyUpload } from '@/hooks/use-uppy-upload';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGlowEffect } from '@/hooks/use-glow-effect';

interface Props {
  s3Enabled: boolean;
  token: string | null;
  onUploadComplete: () => Promise<void>;
}

export function UploadZone({ s3Enabled, token, onUploadComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { ref: glowRef, onMouseMove: glowMove, onMouseLeave: glowLeave } = useGlowEffect<HTMLDivElement>();

  const { api } = useAuth();
  const uppy = useUppyUpload(s3Enabled, token, onUploadComplete);
  const legacy = useFileUpload(api, token);

  const uploading = s3Enabled ? uppy.uploading : legacy.uploading;
  const uploadProgress = s3Enabled ? uppy.uploadProgress : legacy.uploadProgress;
  const error = s3Enabled ? uppy.error : legacy.error;
  const expireDays = s3Enabled ? uppy.expireDays : legacy.expireDays;
  const setExpireDays = s3Enabled ? uppy.setExpireDays : legacy.setExpireDays;

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (s3Enabled && uppy.uppyRef.current) {
        uppy.addFiles(files);
      } else {
        legacy.uploadFile(files, onUploadComplete);
      }
    },
    [s3Enabled, uppy, legacy, onUploadComplete]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) addFiles(Array.from(fileList));
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="w-full max-w-2xl px-4 mb-6">
      <div
        ref={glowRef}
        onMouseMove={(e) => { glowMove(e); }}
        onMouseLeave={(e) => { glowLeave(); setDragOver(false); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        className={`relative flex flex-col items-center justify-center h-44 rounded-2xl border-2 border-dashed cursor-pointer select-none overflow-hidden ${
          dragOver
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : 'glow-hover glow-blue border-zinc-700/60 hover:border-zinc-500/80 bg-zinc-900/50 hover:bg-zinc-900/80'
        } ${uploading ? 'pointer-events-none opacity-50' : 'pressable'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2.5 w-52">
            <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200 bg-linear-to-r from-blue-500 to-blue-400"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">
              {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
            </span>
          </div>
        ) : (
          <>
            <div className={`mb-3 p-3 rounded-xl transition-colors ${dragOver ? 'bg-blue-500/20' : 'bg-zinc-800/50'}`}>
              <svg className="w-10 h-8" viewBox="0 0 40 30" fill="none">
                <path d="M8 24c-3.31 0-6-2.69-6-6s2.69-6 6-6c.8-2.8 3.5-4.8 6.6-4.8 2.9 0 5.4 1.7 6.4 4.2 1.8-.8 3.8-1.2 6-1.2 4.4 0 8 3.6 8 8s-3.6 8-8 8H8z" fill="currentColor" className={`${dragOver ? 'text-blue-400/40' : 'text-zinc-600/50'} transition-colors`} />
                <path d="M20 20l7-7M20 20V8" stroke={dragOver ? '#60a5fa' : '#52525b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
              </svg>
            </div>
            <span className={`text-sm font-medium transition-colors ${dragOver ? 'text-blue-300' : 'text-zinc-400'}`}>
              {dragOver ? 'Drop to upload' : 'Drop a file here or click to browse'}
            </span>
          </>
        )}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple aria-label="Choose files to upload" />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800/40 border-t border-zinc-700/40" onClick={(e) => e.stopPropagation()}>
          <span className="text-[11px] text-zinc-500 whitespace-nowrap">Auto-delete:</span>
          <select value={expireDays} onChange={(e) => setExpireDays(e.target.value)} className="bg-transparent text-zinc-400 text-[11px] focus:outline-none cursor-pointer">
            <option value="">Never</option>
            <option value="1">After 1 day</option>
            <option value="7">After 7 days</option>
            <option value="30">After 30 days</option>
            <option value="90">After 90 days</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
