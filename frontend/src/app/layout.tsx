import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://linqoy.app';

export const metadata: Metadata = {
  title: {
    default: 'linqoy.',
    template: '%s · linqoy.',
  },
  description: 'Drop files. Share links. That\'s it. A clean, fast file sharing app — no clutter, no subscriptions.',
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'linqoy.',
    title: 'linqoy.',
    description: 'Drop files. Share links. That\'s it. A clean, fast file sharing app.',
    url: SITE_URL,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'linqoy. — file sharing that just works',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'linqoy.',
    description: 'Drop files. Share links. That\'s it.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'theme-color': '#0a0a0a',
  },
};

import { Providers } from './Providers';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
