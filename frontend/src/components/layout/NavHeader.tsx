'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

function CloudIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 40 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 24c-3.31 0-6-2.69-6-6s2.69-6 6-6c.8-2.8 3.5-4.8 6.6-4.8 2.9 0 5.4 1.7 6.4 4.2 1.8-.8 3.8-1.2 6-1.2 4.4 0 8 3.6 8 8s-3.6 8-8 8H8z" />
    </svg>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </>
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </>
      )}
    </svg>
  );
}

interface NavButtonProps {
  active: boolean;
  icon?: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick: () => void;
}

function NavButton({ active, icon, label, highlight, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 ease-out ${
        active
          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
          : highlight
            ? 'bg-violet-600/20 text-violet-400 hover:bg-violet-600 hover:text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function NavHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useCallback(
    (path: string) => {
      setMenuOpen(false);
      router.push(path);
    },
    [router],
  );

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800/80">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6 max-w-screen-2xl mx-auto">
        <button
          onClick={() => navigate('/files')}
          className="pressable flex items-center transition-colors duration-200"
        >
          <BrandLogo size="text-lg" />
        </button>

        {/* ── Desktop nav ── */}
        <div className="hidden sm:flex items-center gap-1">
          <span className="text-sm text-zinc-500 mr-2">
            {user.username}
          </span>
          <NavButton active={pathname === '/files'} icon={<CloudIcon />} label="Upload" highlight onClick={() => navigate('/files')} />
          {user.isAdmin && <NavButton active={pathname === '/admin'} label="Admin" onClick={() => navigate('/admin')} />}
          <NavButton active={pathname === '/settings'} label="Settings" onClick={() => navigate('/settings')} />
          <button type="button" onClick={logout} className="pressable px-3.5 py-1.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-200">
            Logout
          </button>
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          type="button"
          className="pressable sm:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-200"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <HamburgerIcon open={menuOpen} />
        </button>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-slide-in">
          <div className="px-4 py-3 space-y-1 max-w-screen-2xl mx-auto">
            <div className="text-xs text-zinc-500 pb-2 border-b border-zinc-800/60 mb-1">
              Signed in as <span className="text-zinc-400 font-medium">{user.username}</span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/files')}
              className={`pressable w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                pathname === '/files'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
              }`}
            >
              <CloudIcon />
              Upload
            </button>

            {user.isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className={`pressable w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                  pathname === '/admin'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Admin
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={`pressable w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                pathname === '/settings'
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </button>

            <div className="pt-2 border-t border-zinc-800/60 mt-1">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); logout(); }}
                className="pressable w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
