'use client';

import { useEffect, useCallback, useRef, useState, useLayoutEffect } from 'react';
import { useFileList } from '@/hooks/use-file-list';
import { useFileActions } from '@/hooks/use-file-actions';
import { useFileViewer } from '@/hooks/use-file-viewer';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useStorageAndRandomAudio } from '@/hooks/use-storage-and-random-audio';
import { UploadZone } from '@/components/files/UploadZone';
import { ImageGallery } from '@/components/files/ImageGallery';
import { FileSection } from '@/components/files/FileSection';
import { Lightbox } from '@/components/files/Lightbox';
import { TextViewer } from '@/components/files/TextViewer';
import { VideoViewer } from '@/components/files/VideoViewer';
import { AudioPlayerBar } from '@/components/files/AudioPlayerBar';
import { isVideo } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { StorageBar } from '@/components/files/StorageBar';
import { LayoutGrid, Image, Music, Film, File, Search, CloudUpload, Eye } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDashboard } from '@/features/dashboard/DashboardProvider';
import type { FilesViewMode } from '@/features/dashboard/DashboardProvider';

const PAGE_SIZE = 9;

const TABS = [
  { key: 'all' as const, Icon: LayoutGrid, label: 'All' },
  { key: 'images' as const, Icon: Image, label: 'Images' },
  { key: 'audio' as const, Icon: Music, label: 'Audio' },
  { key: 'video' as const, Icon: Film, label: 'Video' },
  { key: 'file' as const, Icon: File, label: 'Files' },
] as const;

function TabBar({ filesViewMode, setFilesViewMode }: { filesViewMode: FilesViewMode; setFilesViewMode: (m: FilesViewMode) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current.get(filesViewMode);
    const container = containerRef.current;
    if (el && container) {
      const cr = container.getBoundingClientRect();
      const tr = el.getBoundingClientRect();
      setPill({ left: tr.left - cr.left, width: tr.width });
    }
  }, [filesViewMode]);

  return (
    <div ref={containerRef} className="relative flex gap-0.5 bg-zinc-900 rounded-xl p-1 border border-zinc-800/60">
      {/* Sliding pill */}
      <div
        className="tab-pill absolute top-1 bottom-1 rounded-lg bg-zinc-700/80 shadow-sm"
        style={{ left: pill.left, width: pill.width }}
      />
      {TABS.map(m => (
        <button
          type="button"
          key={m.key}
          ref={(el) => { if (el) tabRefs.current.set(m.key, el); }}
          onClick={() => setFilesViewMode(m.key)}
          className={`pressable relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            filesViewMode === m.key
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <m.Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function FilesPanel() {
  const { user, api, token } = useAuth();
  const { filesViewMode, setFilesViewMode } = useDashboard();

  const {
    files, page: filePage, totalPages: fileTotalPages, total: fileTotal,
    imageFiles, imagePage, imageTotalPages, imageTotal,
    audioFiles, audioPage, audioTotalPages, audioTotal,
    videoFiles, videoPage, videoTotalPages, videoTotal,
    search, searchRef, fetchFiles, setSearch,
  } = useFileList(api, { pageSize: PAGE_SIZE });

  const { copiedId, deletingId, deleteFile, togglePublic, copyLink } = useFileActions(api);
  const {
    lightboxIndex, viewingFile, fileContent,
    openViewer, closeViewer, openLightbox, closeLightbox,
  } = useFileViewer();
  const {
    currentAudio, isPlaying, audioRef,
    play, pause, resume, close: closeAudio,
  } = useAudioPlayer();

  const { storage, playRandomAudio } = useStorageAndRandomAudio(play);

  const refreshList = useCallback(
    () => fetchFiles(filesViewMode, 1, searchRef.current),
    [fetchFiles, filesViewMode, searchRef]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (currentAudio?.id === id) closeAudio();
      await deleteFile(id, refreshList);
    },
    [currentAudio, closeAudio, deleteFile, refreshList]
  );

  const goToPage = useCallback(
    (type: FilesViewMode, page: number) => fetchFiles(type, page, search),
    [fetchFiles, search]
  );

  useEffect(() => {
    fetchFiles(filesViewMode, 1, search);
  }, [fetchFiles, filesViewMode, search]);

  useKeyboardShortcuts(
    { lightboxIndex, imageCount: imageFiles.length, closeLightbox, openLightbox },
    { viewingFile, closeViewer },
    currentAudio ? { currentAudio, isPlaying, audioRef, pause, resume } : null
  );

  const show = (mode: FilesViewMode) => filesViewMode === mode || filesViewMode === 'all';
  const anyContent = imageFiles.length || files.length || audioFiles.length || videoFiles.length;
  const isEmpty = !anyContent && !search;

  const sectionProps = {
    copiedId, deletingId,
    filesViewMode,
    search,
    onCopyLink: copyLink,
    onTogglePublic: (id: number, isPublic: boolean) => togglePublic(id, isPublic, refreshList),
    onDelete: handleDelete,
    onOpenViewer: openViewer,
    onPlayAudio: play,
  } as const;

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {user?.isDemo && (
        <div className="w-full bg-amber-500/8 border-b border-amber-500/15">
          <div className="max-w-4xl xl:max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <span className="text-xs text-amber-400/90">
              Demo session — files are deleted when you close this tab. Storage limit: 100 MB.
            </span>
          </div>
        </div>
      )}

      {storage && <StorageBar used={storage.used} limit={storage.limit} />}

      <UploadZone
        s3Enabled={storage?.s3_upload_enabled ?? false}
        token={token}
        onUploadComplete={refreshList}
      />

      <div className={`w-full max-w-4xl xl:max-w-6xl mx-auto px-4 space-y-5 ${currentAudio ? 'pb-24' : 'pb-16'}`}>
        {/* Tabs + Search */}
        <div className="flex items-center gap-3">
          <TabBar filesViewMode={filesViewMode} setFilesViewMode={setFilesViewMode} />
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchFiles(filesViewMode, 1, search); }}
              placeholder="Search files..." aria-label="Search files"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchFiles(filesViewMode, 1, ''); }}
                className="pressable absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div key={filesViewMode} className="animate-tab-in space-y-5">
        {isEmpty && (
          <EmptyState
            icon={<CloudUpload className="w-8 h-8 text-zinc-600" />}
            title="No files yet"
            description="Drop a file above or click the upload zone to get started."
          />
        )}

        {/* Images */}
        {show('images') && imageFiles.length > 0 && (
          <>
            {filesViewMode === 'all' && (
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pt-1">
                Images
                <span className="ml-1.5 text-zinc-600 font-normal">({imageTotal})</span>
              </h2>
            )}
            <ImageGallery
              images={imageFiles} total={imageTotal}
              copiedId={copiedId} deletingId={deletingId}
              onCopyLink={copyLink}
              onDelete={handleDelete}
              onTogglePublic={(id, isPublic) => togglePublic(id, isPublic, refreshList)}
              onOpenLightbox={openLightbox}
            />
            {imageTotalPages > 1 && (
              <Pagination
                page={imagePage} totalPages={imageTotalPages} total={imageTotal}
                onPrev={() => goToPage(filesViewMode, imagePage - 1)}
                onNext={() => goToPage(filesViewMode, imagePage + 1)}
                label="Images"
              />
            )}
          </>
        )}

        {/* Audio / Video / Files — reusable FileSection */}
        <FileSection
          {...sectionProps}
          label="Audio" files={audioFiles} total={audioTotal}
          page={audioPage} totalPages={audioTotalPages}
          currentAudioId={currentAudio?.id ?? null}
          showDivider={filesViewMode === 'all' && (imageFiles.length > 0 || videoFiles.length > 0)}
          onPageChange={p => goToPage(filesViewMode, p)}
        />
        <FileSection
          {...sectionProps}
          label="Video" files={videoFiles} total={videoTotal}
          page={videoPage} totalPages={videoTotalPages}
          currentAudioId={null}
          showDivider={filesViewMode === 'all' && (imageFiles.length > 0 || audioFiles.length > 0)}
          onPageChange={p => goToPage(filesViewMode, p)}
        />
        <FileSection
          {...sectionProps}
          label="Files" files={files} total={fileTotal}
          page={filePage} totalPages={fileTotalPages}
          currentAudioId={currentAudio?.id ?? null}
          showDivider={filesViewMode === 'all' && anyContent > 0}
          onPageChange={p => goToPage(filesViewMode, p)}
        />

        {search && !anyContent && (
          <EmptyState icon={<Search className="w-8 h-8 text-zinc-600" />} title="No results" description={`No files matching "${search}"`} />
        )}
        </div>
      </div>

      {/* Modals */}
      {lightboxIndex !== null && lightboxIndex < imageFiles.length && (
        <Lightbox
          image={imageFiles[lightboxIndex]!}
          index={lightboxIndex} total={imageFiles.length}
          hasPrev={lightboxIndex > 0} hasNext={lightboxIndex < imageFiles.length - 1}
          copiedId={copiedId} deletingId={deletingId}
          onClose={closeLightbox}
          onPrev={() => openLightbox(lightboxIndex - 1)}
          onNext={() => openLightbox(lightboxIndex + 1)}
          onCopyLink={copyLink}
          onDelete={handleDelete}
          onTogglePublic={(id, isPublic) => togglePublic(id, isPublic, refreshList)}
        />
      )}

      {viewingFile && (
        isVideo(viewingFile.mime_type) ? (
          <VideoViewer
            file={viewingFile} copiedId={copiedId} deletingId={deletingId}
            onClose={closeViewer} onCopyLink={copyLink} onDelete={handleDelete}
          />
        ) : (
          <TextViewer
            file={viewingFile} content={fileContent}
            copiedId={copiedId} deletingId={deletingId}
            onClose={closeViewer} onCopyLink={copyLink} onDelete={handleDelete}
          />
        )
      )}

      <AudioPlayerBar
        currentAudio={currentAudio} isPlaying={isPlaying} audioRef={audioRef}
        copiedId={copiedId} deletingId={deletingId}
        onPlayPause={isPlaying ? pause : resume}
        onNext={playRandomAudio}
        onClose={closeAudio}
        onDelete={handleDelete}
        onCopyLink={copyLink}
      />
    </div>
  );
}
