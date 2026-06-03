'use client';

import { useDemoLogin } from '@/hooks/use-demo-login';
import { useGlowEffect } from '@/hooks/use-glow-effect';
import { UploadCloud, Link, Image, LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ComponentType } from 'react';

const features = [
  {
    icon: UploadCloud,
    title: 'Drag, drop, done',
    desc: 'Toss your files in like acorns into a burrow. Images, docs, archives. The only limit is your hard drive.',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconBg: 'bg-blue-500/15 text-blue-400',
    glow: 'glow-blue',
  },
  {
    icon: Link,
    title: 'ShareX ready',
    desc: 'One-click config. Screenshot → upload → link. The fastest way to share from your desktop.',
    gradient: 'from-violet-500/20 to-purple-500/10',
    iconBg: 'bg-violet-500/15 text-violet-400',
    glow: 'glow-violet',
  },
  {
    icon: Image,
    title: 'Gallery with lightbox',
    desc: 'Browse images in a clean gallery with fullscreen view, keyboard navigation, and instant previews.',
    gradient: 'from-amber-500/20 to-orange-500/10',
    iconBg: 'bg-amber-500/15 text-amber-400',
    glow: 'glow-amber',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin dashboard',
    desc: 'Manage users, check analytics, run backups. You\'re the head squirrel now. Act accordingly.',
    gradient: 'from-emerald-500/20 to-green-500/10',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    glow: 'glow-emerald',
  },
];

function GlowCard({ glow, gradient, children }: { glow: string; gradient: string; children: ReactNode }) {
  const { ref, onMouseMove, onMouseLeave } = useGlowEffect<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`glow-hover ${glow} group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-linear-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="relative">{children}</div>
    </div>
  );
}

export function LandingPage({ onLogin }: { onLogin: () => void }) {
  const { loading: demoLoading, error: demoError, handleTryDemo } = useDemoLogin();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-4 pt-20 sm:pt-28 pb-8 max-w-4xl mx-auto">
        <div className="flex items-baseline gap-0.5 mb-6">
          <span className="text-2xl sm:text-3xl mr-1">🐿️</span>
          <span className="text-3xl sm:text-4xl font-semibold text-zinc-300">Nut</span>
          <span className="text-3xl sm:text-4xl font-bold text-zinc-100">Keep</span>
        </div>

        <p className="text-base sm:text-lg text-zinc-400 max-w-xl mb-8 leading-relaxed">
          Drop files. Share links. That's it.{' '}
          A clean, fast file sharing app — no clutter, no subscriptions, no surprises.
        </p>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={demoLoading}
            className="pressable px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
          >
            {demoLoading ? 'Signing in…' : 'Try Demo'}
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="pressable px-6 py-2.5 rounded-lg text-sm font-medium border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100"
          >
            Sign In →
          </button>
        </div>

        {demoError && <p className="text-sm text-red-400 mb-4">{demoError}</p>}
      </section>

      {/* ── Features ── */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-24">
        <h2 className="text-center text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-10">
          What this squirrel can do
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <GlowCard key={f.title} glow={f.glow} gradient={f.gradient}>
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${f.iconBg} mb-3`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1.5">
                {f.title}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center pb-8 text-xs text-zinc-600">
        <a
          href="https://github.com/lukasdevit/linqoy"
          className="hover:text-zinc-400 transition-colors"
        >
          GitHub
        </a>
        <span className="mx-2">·</span>
        <a
          href="https://github.com/lukasdevit/linqoy#readme"
          className="hover:text-zinc-400 transition-colors"
        >
          Readme
        </a>
      </footer>
    </div>
  );
}
