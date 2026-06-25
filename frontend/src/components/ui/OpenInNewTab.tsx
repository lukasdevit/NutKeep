'use client';

import { useTranslation } from '@/i18n';

interface Props {
  href: string;
  /** Optional: extra onClick handler (e.g. stopPropagation in lightbox) */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function OpenInNewTab({ href, onClick }: Props) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="pressable px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
      onClick={onClick}
    >
      {t('ui.buttons.open_new_tab', 'Open in new Tab')}
    </a>
  );
}
