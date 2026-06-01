'use client';

import { useGlowEffect } from '@/hooks/use-glow-effect';

interface Props {
  mode: 'login' | 'register';
  username: string;
  password: string;
  error: string | null;
  onModeChange: (mode: 'login' | 'register') => void;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack?: () => void;
}

export function LoginForm({
  mode,
  username,
  password,
  error,
  onModeChange,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onBack,
}: Props) {
  const { ref: glowRef, onMouseMove: glowMove, onMouseLeave: glowLeave } = useGlowEffect<HTMLDivElement>();

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 pb-32">
      {/* Back link */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="pressable self-start mb-6 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to home
        </button>
      )}

      <div className="w-full">
        {/* Branding */}
        <div className="flex flex-col mb-8">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl mr-0.5">🐿️</span>
            <span className="text-2xl font-semibold text-zinc-200">Nut</span>
            <span className="text-2xl font-bold text-zinc-100">Keep</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">File sharing that just works</p>
        </div>

        {/* Card */}
        <div
          ref={glowRef}
          onMouseMove={glowMove}
          onMouseLeave={glowLeave}
          className="glow-hover glow-blue p-6 rounded-xl border border-zinc-800 bg-zinc-900/50"
        >
          <p className="text-sm text-zinc-400 mb-5">
            {mode === 'login'
              ? 'Welcome back. Sign in to access your files.'
              : 'Create an account to start uploading.'}
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="login-username" className="block text-xs font-medium text-zinc-500 mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-zinc-500 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Enter your password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-150"
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        {/* Toggle login/register */}
        <p className="mt-5 text-center text-xs text-zinc-500">
          {mode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
            className="pressable text-blue-400 hover:text-blue-300"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
