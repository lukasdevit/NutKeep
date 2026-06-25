import { formatSize } from '@/lib/utils';
import type { User, MigratePreview } from './types';

interface Props {
  user: User;
  editStorage: number;
  onStorageChange: (v: number) => void;
  editMaxFileSize: number;
  onMaxFileSizeChange: (v: number) => void;
  editAdmin: boolean;
  onAdminChange: (v: boolean) => void;
  editPassword: string;
  onPasswordChange: (v: string) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: (id: number) => void;
  migratePreview: MigratePreview | null;
  onMigratePreview: (userId: number) => void;
  onMigrate: (userId: number) => void;
  onCancelMigrate: () => void;
  migrating: boolean;
}

export function UserEditForm({
  user,
  editStorage,
  onStorageChange,
  editMaxFileSize,
  onMaxFileSizeChange,
  editAdmin,
  onAdminChange,
  editPassword,
  onPasswordChange,
  onSave,
  onCancel,
  deleteConfirm,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  migratePreview,
  onMigratePreview,
  onMigrate,
  onCancelMigrate,
  migrating,
}: Props) {
  return (
    <form onSubmit={onSave} className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-200">
          Editing: {user.username}
        </span>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-green-600 hover:bg-green-500 text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-zinc"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor={`edit-storage-${user.id}`}
            className="block text-xs text-zinc-500 mb-1"
          >
            Storage Limit (GB)
          </label>
          <input
            id={`edit-storage-${user.id}`}
            type="number"
            value={editStorage}
            onChange={(e) => onStorageChange(Number(e.target.value) || 0)}
            className="input-sm"
            min="0"
          />
          <span className="text-xs text-zinc-600">
            {formatSize(Number(editStorage) || 0)}
          </span>
        </div>
        <div>
          <label
            htmlFor={`edit-max-file-size-${user.id}`}
            className="block text-xs text-zinc-500 mb-1"
          >
            Max File Size (MB)
          </label>
          <input
            id={`edit-max-file-size-${user.id}`}
            type="number"
            value={editMaxFileSize}
            onChange={(e) => onMaxFileSizeChange(Number(e.target.value) || 0)}
            className="input-sm"
            min="0"
            placeholder="0 = unlimited"
          />
          <span className="text-xs text-zinc-600">
            {editMaxFileSize > 0 ? formatSize(editMaxFileSize * 1024 * 1024) : 'unlimited'}
          </span>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Admin</label>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={editAdmin}
              onChange={(e) => onAdminChange(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-xs text-zinc-300">Is admin</span>
          </label>
        </div>
        <div>
          <label
            htmlFor={`edit-password-${user.id}`}
            className="block text-xs text-zinc-500 mb-1"
          >
            New Password
          </label>
          <input
            id={`edit-password-${user.id}`}
            type="password"
            value={editPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="(leave blank)"
            className="input-sm"
          />
        </div>
      </div>

      {/* ── File Migration ── */}
      <div className="border-t border-zinc-700 pt-3">
        {migratePreview ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              <span className="text-zinc-200 font-medium">
                {migratePreview.count}
              </span>{' '}
              file(s) ({formatSize(migratePreview.totalSize)}) on other
              backends will be migrated to{' '}
              <span className="text-violet-400">
                {migratePreview.backend}
              </span>
              .
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onMigrate(user.id)}
                disabled={migrating}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-green-600 hover:bg-green-500 text-white"
              >
                {migrating ? 'Migrating…' : 'Confirm Migration'}
              </button>
              <button
                type="button"
                onClick={onCancelMigrate}
                className="btn-zinc text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onMigratePreview(user.id)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white"
          >
            📦 Migrate Files
          </button>
        )}
      </div>

      {/* ── Delete ── */}
      <div className="flex items-center justify-between pt-1">
        {deleteConfirm ? (
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span className="text-red-400">Confirm delete?</span>
            <button
              type="button"
              onClick={() => onDelete(user.id)}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-500 text-zinc-200 font-medium transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConfirmDelete}
            className="btn-red ml-auto"
          >
            🗑 Delete User
          </button>
        )}
      </div>
    </form>
  );
}
