import { canAccessSalonSpace, hasSystemRole, selectSession, t } from '@gomecoiffer/client-core';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/store/hooks';

export type RequireSystemRoleProps = {
  readonly role?: string;
  readonly fallbackHref?: Href;
  readonly children: ReactNode;
};

export function RequireSystemRole({
  role,
  fallbackHref = '/(client)/(tabs)',
  children,
}: RequireSystemRoleProps) {
  const session = useAppSelector(selectSession);
  const allowed = role
    ? hasSystemRole(session, role)
    : session.systemRoles.length > 0 && canAccessSalonSpace(session);

  if (allowed) {
    return children;
  }

  return (
    <EmptyState
      title={t('errors.forbidden.title')}
      description={t('errors.forbidden.systemRole')}
      action={
        <Link href={fallbackHref} asChild>
          <Button variant="outline" title={t('common.back')} className="self-start" />
        </Link>
      }
    />
  );
}
