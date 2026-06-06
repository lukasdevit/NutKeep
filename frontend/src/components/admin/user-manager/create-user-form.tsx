interface Props {
  newUsername: string;
  onUsernameChange: (v: string) => void;
  newPassword: string;
  onPasswordChange: (v: string) => void;
  newIsAdmin: boolean;
  onAdminChange: (v: boolean) => void;
  newStorageLimit: number;
  onStorageLimitChange: (v: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateUserForm({
  newUsername,
  onUsernameChange,
  newPassword,
  onPasswordChange,
  newIsAdmin,
  onAdminChange,
  newStorageLimit,
  onStorageLimitChange,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-violet-600/40 bg-zinc-800/30 p-4 space-y-3"
    >
      <h3 className="text-sm font-medium text-zinc-300">Create New User</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="new-username"
            className="block text-xs text-zinc-500 mb-1"
          >
            Username *
          </label>
          <input
            id="new-username"
            type="text"
            value={newUsername}
            onChange={(e) => onUsernameChange(e.target.value)}
            className="input-sm"
            placeholder="newuser"
            minLength={3}
          />
        </div>
        <div>
          <label
            htmlFor="new-password"
            className="block text-xs text-zinc-500 mb-1"
          >
            Password *
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="input-sm"
            placeholder="min 6 chars"
            minLength={6}
          />
        </div>
        <div>
          <label
            htmlFor="new-storage"
            className="block text-xs text-zinc-500 mb-1"
          >
            Storage Limit (GB, optional)
          </label>
          <input
            id="new-storage"
            type="number"
            value={newStorageLimit}
            onChange={(e) =>
              onStorageLimitChange(Number(e.target.value) || 0)
            }
            className="input-sm"
            placeholder="Default: 10 GB"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Role</label>
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => onAdminChange(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-700 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-xs text-zinc-300">Admin user</span>
          </label>
        </div>
      </div>
      <button
        type="submit"
        className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-green-600 hover:bg-green-500 text-white"
      >
        Create User
      </button>
    </form>
  );
}
