'use client';

import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { DashboardProvider } from '@/features/dashboard/DashboardProvider';
import { NavHeader } from '@/components/layout/NavHeader';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ErrorReporter } from '@/components/ui/ErrorReporter';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ErrorReporter />
      <I18nProvider>
        <AuthProvider>
          <DashboardProvider>
            <NavHeader />
            {children}
          </DashboardProvider>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
