'use client';

import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/60">
        {icon ?? <Inbox className="w-8 h-8 text-zinc-600" />}
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {description && (
        <p className="text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
