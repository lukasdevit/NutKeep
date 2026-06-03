'use client';

interface Props {
  filename: string;
  id: number;
  copiedId: number | null;
  onClick: (e: React.MouseEvent) => void;
}

export function CopyButton({ filename, id, copiedId, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable px-2.5 py-1.5 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap"
    >
      {copiedId === id ? '✓ Copied' : 'Copy link'}
    </button>
  );
}
