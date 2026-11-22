import { can, selectSession, t } from '@gomecoiffer/client-core';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/store/hooks';

export type RequirePermissionProps = {
  readonly permission: string;
  readonly fallbackHref?: Href;
  readonly wrapDeniedInSafeArea?: boolean;
  readonly children: ReactNode;
};

export function RequirePermission({
  permission,
  fallbackHref = '/(salon)/(tabs)',
  wrapDeniedInSafeArea = false,
  children,
}: RequirePermissionProps) {
  const session = useAppSelector(selectSession);

  if (can(session, permission)) {
    return children;
  }

  const deniedView = (
    <EmptyState
      title={t('errors.forbidden.title')}
      description={t('errors.forbidden.permission')}
      action={
        <Link href={fallbackHref} asChild>
          <Button variant="outline" title={t('common.back')} className="self-start" />
        </Link>
      }
    />
  );

  if (wrapDeniedInSafeArea) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background p-4">
        {deniedView}
      </SafeAreaView>
    );
  }

  return deniedView;
}
