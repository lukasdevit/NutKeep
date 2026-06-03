'use client';

import {
  Users, Database, HardDrive, Shield, BarChart3,
  Archive, ScrollText, ShieldCheck, History, Zap,
} from 'lucide-react';
import { ADMIN_TABS } from '@/config/constants';
import type { AdminTab } from '@/config/constants';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users, 'hard-drive': HardDrive, shield: Shield,
  'bar-chart-3': BarChart3, archive: Archive, 'scroll-text': ScrollText,
  'shield-check': ShieldCheck, history: History, database: Database,
};

interface Props {
  username: string;
  activeTab: AdminTab;
  collapsed: boolean;
  mobileOpen: boolean;
  onTabChange: (tab: AdminTab) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export function AdminSidebar({
  username,
  activeTab,
  collapsed,
  mobileOpen,
  onTabChange,
  onToggleCollapse,
  onCloseMobile,
}: Props) {
  return (
    <aside
      className={`fixed lg:relative inset-y-0 left-0 z-50 flex flex-col transform transition-all duration-200 bg-zinc-950 border-r border-zinc-800 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 items-center justify-center transition-colors z-10"
        title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (⌘+\\)`}
      >
        <svg
          className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Header */}
      <div className={`px-5 py-5 border-b border-zinc-800 ${collapsed ? 'px-3 text-center' : ''}`}>
        {collapsed ? (
          <Zap className="w-5 h-5 text-zinc-400" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex items-baseline gap-0">
                <span className="text-sm font-bold text-zinc-100 tracking-tight">linqoy.</span>
              </div>
              <span className="text-[10px] text-zinc-600 bg-zinc-800 rounded px-1.5 py-0.5">Admin</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1 truncate">{username}</p>
          </>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {ADMIN_TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => {
              onTabChange(t.key as AdminTab);
              onCloseMobile();
            }}
            title={collapsed ? t.label : undefined}
            className={`w-full flex items-center gap-2.5 rounded-md text-sm transition-colors ${collapsed ? 'justify-center px-0 py-2.5 text-base' : 'px-3 py-2'} ${activeTab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            {(() => { const Ic = ICON_MAP[t.icon]; return Ic ? <Ic className="w-4 h-4" /> : null; })()}
            {!collapsed && <span>{t.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
