// ── File extension tag colors ──
// Used by FileList TagBadge to color-code file extensions.

export const TAG_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/10 text-red-400 border-red-500/20',
  txt: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  md: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  json: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  xml: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  html: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  css: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  js: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  ts: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  jsx: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  tsx: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  py: 'bg-green-500/10 text-green-400 border-green-500/20',
  java: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  c: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  cpp: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  sh: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  yaml: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  yml: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  zip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  gz: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  tar: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  '7z': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rar: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  png: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  jpg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  jpeg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  gif: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  webp: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  svg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  mp3: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  wav: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  ogg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  mp4: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  webm: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  dll: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  exe: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export const DEFAULT_TAG_COLOR =
  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';

export type AdminTab =
  | 'users'
  | 'database'
  | 'storage'
  | 'ssl'
  | 'analytics'
  | 'backups'
  | 'logs'
  | 'integrity'
  | 'actions';

export const ADMIN_TABS = [
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'database', label: 'Database', icon: 'database' },
  { key: 'storage', label: 'Storage', icon: 'hard-drive' },
  { key: 'ssl', label: 'SSL', icon: 'shield' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-3' },
  { key: 'backups', label: 'Backups', icon: 'archive' },
  { key: 'logs', label: 'Logs', icon: 'scroll-text' },
  { key: 'integrity', label: 'Integrity', icon: 'shield-check' },
  { key: 'actions', label: 'Actions', icon: 'history' },
] as const;

export const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  users: 'Users',
  database: 'Database',
  storage: 'Storage',
  ssl: 'SSL / HTTPS',
  analytics: 'Analytics',
  backups: 'Backups',
  logs: 'Logs',
  integrity: 'Integrity',
  actions: 'Actions',
};

export const ADMIN_TAB_DESCRIPTIONS: Record<AdminTab, string> = {
  users: 'Manage user accounts, storage limits, and admin permissions.',
  database: 'Browse and manage database tables directly.',
  storage: 'Configure storage backends and view usage across all users.',
  ssl: 'Monitor SSL certificate status and HTTPS configuration.',
  analytics: 'View upload trends, top users, and file type distribution.',
  backups: 'Run and download database backups, view backup history.',
  logs: 'View live server logs, filter by level, and download log files.',
  integrity: 'Check database entries against files on disk for consistency.',
  actions: 'View and undo recent admin operations in the integrity panel.',
};
