export function StorageBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#3b82f6',
        }}
      />
    </div>
  );
}
