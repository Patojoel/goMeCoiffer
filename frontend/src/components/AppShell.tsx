import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router';
import { t } from '@/lib/i18n/i18n';

type AppShellProps = { space: string; navLabel: string; nav?: ReactNode };

/** Coque mobile-first commune aux trois espaces : en-tête sobre, contenu centré. */
export function AppShell({ space, navLabel, nav }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link to="/" className="flex min-h-11 flex-col justify-center leading-tight">
            <span className="text-base font-semibold">{t('app.name')}</span>
            <span className="text-xs text-muted-foreground">{space}</span>
          </Link>
          {nav ? <nav aria-label={navLabel}>{nav}</nav> : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
