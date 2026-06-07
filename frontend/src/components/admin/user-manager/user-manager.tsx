'use client';
import { getApiErrorMessage } from "@/lib/api-error";

import { useState, useEffect } from 'react';
import { formatSize } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/CardSkeleton';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';

import type { User, Props, MigratePreview } from './types';
import { RegistrationToggles } from './registration-toggles';
import { CreateUserForm } from './create-user-form';
import { UserEditForm } from './user-edit-form';
import { StorageBar } from './storage-bar';

export function UserManager({ apiFetch }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editStorage, setEditStorage] = useState(0);
  const [editAdmin, setEditAdmin] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newStorageLimit, setNewStorageLimit] = useState(0);

  // Registration toggles
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [togglingReg, setTogglingReg] = useState(false);
  const [demoRegOpen, setDemoRegOpen] = useState(true);
  const [togglingDemoReg, setTogglingDemoReg] = useState(false);

  // Migration
  const [migrating, setMigrating] = useState<number | null>(null);
  const [migratePreview, setMigratePreview] = useState<MigratePreview | null>(null);

  // ── Data fetching ──

  async function fetchUsers(p = 1, s = '') {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (s) params.set('search', s);
      const r = await apiFetch(`/admin/users?${params.toString()}`);
      if (r.ok) {
        const d = await r.json();
        setUsers(d.users);
        setPage(d.page);
        setTotalPages(d.totalPages);
        setTotal(d.total);
      }
    } catch {
      /* */
    }
    setLoading(false);
  }

  async function fetchRegistrationsStatus() {
    try {
      const r = await apiFetch('/admin/storage');
      if (r.ok) {
        const d = await r.json();
        setRegistrationsOpen(d.registrations_open !== false);
      }
    } catch {
      /* keep default */
    }
  }

  async function fetchDemoRegStatus() {
    try {
      const r = await apiFetch('/admin/users/demo-config');
      if (r.ok) {
        const d = await r.json();
        setDemoRegOpen(d.demo_registrations_open !== false);
      }
    } catch {
      /* keep default */
    }
  }

  useEffect(() => {
    fetchUsers(1, search);
    fetchRegistrationsStatus();
    fetchDemoRegStatus();
  }, []);

  // ── Handlers ──

  function doSearch() {
    setPage(1);
    fetchUsers(1, search);
  }

  function openEdit(u: User) {
    setEditId(u.id);
    setEditStorage(
      u.storage_limit > 0 ? u.storage_limit / 1024 / 1024 / 1024 : 0
    );
    setEditAdmin(u.is_admin === 1);
    setEditPassword('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const body: Record<string, unknown> = {};
    const limitNum = Number(editStorage);
    if (editStorage >= 0) {
      body.storage_limit =
        editStorage > 0 ? Math.round(limitNum * 1024 * 1024 * 1024) : 0;
    }
    if (editAdmin !== (users.find((u) => u.id === editId)?.is_admin === 1))
      body.is_admin = editAdmin;
    if (editPassword.trim()) body.new_password = editPassword.trim();

    if (Object.keys(body).length === 0) {
      toast('No changes to save', 'err');
      return;
    }

    try {
      const r = await apiFetch(`/admin/users/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      toast('User updated', 'ok');
      setEditPassword('');
      await fetchUsers(page, search);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleDelete(id: number) {
    try {
      const r = await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      setDeleteConfirm(null);
      setEditId(null);
      await fetchUsers(page, search);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleMigratePreview(userId: number) {
    try {
      const r = await apiFetch(`/admin/users/${userId}/migrate-files-preview`);
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      setMigratePreview(d);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function handleMigrate(userId: number) {
    setMigrating(userId);
    try {
      const r = await apiFetch(`/admin/users/${userId}/migrate-files`, {
        method: 'POST',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      if (d.errors?.length) {
        toast(
          `Migrated ${d.migrated} files, ${d.errors.length} errors to ${d.backend}`,
          d.migrated > 0 ? 'ok' : 'err'
        );
      } else {
        toast(
          `Migrated ${d.migrated} files to ${d.backend}`,
          d.migrated > 0 ? 'ok' : 'err'
        );
      }
      setMigratePreview(null);
      await fetchUsers(page, search);
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setMigrating(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!newUsername.trim() || !newPassword.trim()) {
      toast('Username and password required', 'err');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        username: newUsername.trim(),
        password: newPassword,
      };
      if (newIsAdmin) body.is_admin = true;
      const limitNum = Number(newStorageLimit);
      if (newStorageLimit >= 0) {
        body.storage_limit =
          newStorageLimit > 0 ? Math.round(limitNum * 1024 * 1024 * 1024) : 0;
      }

      const r = await apiFetch('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      toast(`User "${d.username}" created`, 'ok');
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      setNewStorageLimit(0);
      await fetchUsers(page, search);
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  async function toggleRegistrations() {
    setTogglingReg(true);
    try {
      const r = await apiFetch('/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrations_open: String(!registrationsOpen),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      setRegistrationsOpen(!registrationsOpen);
      toast(
        `Registrations ${!registrationsOpen ? 'opened' : 'closed'}`,
        'ok'
      );
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setTogglingReg(false);
    }
  }

  async function toggleDemoRegistrations() {
    setTogglingDemoReg(true);
    try {
      const r = await apiFetch('/admin/users/demo-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_registrations_open: !demoRegOpen }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      setDemoRegOpen(!demoRegOpen);
      toast(`Demo accounts ${!demoRegOpen ? 'enabled' : 'disabled'}`, 'ok');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setTogglingDemoReg(false);
    }
  }

  // ── Derived ──

  const totalUsed = users.reduce((sum, u) => sum + u.used, 0);
  const totalFiles = users.reduce((sum, u) => sum + u.file_count, 0);
  const adminCount = users.filter((u) => u.is_admin === 1).length;
  const editingUser = users.find((u) => u.id === editId) || null;

  // ── Render ──

  return (
    <section className="card">
      <MetricGrid>
        <MetricCard label="Total Users" value={total} />
        <MetricCard label="Admins" value={adminCount} />
        <MetricCard label="Storage Used" value={formatSize(totalUsed)} />
        <MetricCard label="Files" value={totalFiles} />
      </MetricGrid>

      <RegistrationToggles
        registrationsOpen={registrationsOpen}
        togglingReg={togglingReg}
        onToggleRegistrations={toggleRegistrations}
        demoRegOpen={demoRegOpen}
        togglingDemoReg={togglingDemoReg}
        onToggleDemoRegistrations={toggleDemoRegistrations}
      />

      <div className="flex items-center justify-between">
        <h2 className="card-title">🛡️ User Manager</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white"
          >
            {showCreate ? 'Cancel' : '➕ Create User'}
          </button>
          <button
            type="button"
            onClick={() => fetchUsers(page, search)}
            className="btn-zinc"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateUserForm
          newUsername={newUsername}
          onUsernameChange={setNewUsername}
          newPassword={newPassword}
          onPasswordChange={setNewPassword}
          newIsAdmin={newIsAdmin}
          onAdminChange={setNewIsAdmin}
          newStorageLimit={newStorageLimit}
          onStorageLimitChange={setNewStorageLimit}
          onSubmit={handleCreate}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doSearch();
            }}
            placeholder="Search users..."
            aria-label="Search users"
            className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                fetchUsers(1, '');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <span className="text-xs text-zinc-500 self-center whitespace-nowrap">
          {total} user{total !== 1 ? 's' : ''} total
        </span>
        <span className="text-xs text-zinc-500 self-center whitespace-nowrap">
          {totalFiles} files
        </span>
        <span className="text-xs text-zinc-500 self-center whitespace-nowrap">
          {formatSize(totalUsed)}
        </span>
      </div>

      {loading ? (
        <CardSkeleton lines={5} />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {users.map((u) => {
            const usagePercent =
              u.storage_limit > 0
                ? Math.min(100, (u.used / u.storage_limit) * 100)
                : 0;
            const isEditing = editId === u.id;

            return (
              <div
                key={u.id}
                className={`rounded-lg border p-3 transition-colors ${isEditing ? 'border-violet-600 bg-zinc-800/50' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'}`}
              >
                {isEditing && editingUser ? (
                  <UserEditForm
                    user={editingUser}
                    editStorage={editStorage}
                    onStorageChange={setEditStorage}
                    editAdmin={editAdmin}
                    onAdminChange={setEditAdmin}
                    editPassword={editPassword}
                    onPasswordChange={setEditPassword}
                    onSave={handleSave}
                    onCancel={() => setEditId(null)}
                    deleteConfirm={deleteConfirm === u.id}
                    onConfirmDelete={() => setDeleteConfirm(u.id)}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    onDelete={handleDelete}
                    migratePreview={migratePreview}
                    onMigratePreview={handleMigratePreview}
                    onMigrate={handleMigrate}
                    onCancelMigrate={() => setMigratePreview(null)}
                    migrating={migrating === u.id}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {u.username}
                        </span>
                        {u.is_admin === 1 && (
                          <span className="badge-amber">ADMIN</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="btn-ghost"
                      >
                        ✏️ Edit
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {formatSize(u.used)} / {formatSize(u.storage_limit)}
                      </span>
                      <span>{u.file_count} files</span>
                    </div>
                    <StorageBar pct={usagePercent} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => fetchUsers(page - 1, search)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchUsers(page + 1, search)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
