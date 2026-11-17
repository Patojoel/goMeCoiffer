import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { t, type MessageKey } from '@/lib/i18n/i18n';
import { useAppSelector } from '@/lib/store/hooks';
import { selectHasPermission, selectHasSystemRole } from './sessionSlice';

function Forbidden({ hint }: { hint: MessageKey }) {
  return (
    <Card role="alert">
      <CardTitle className="flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="size-5" />
        {t('rbac.forbidden.title')}
      </CardTitle>
      <CardDescription>{t(hint)}</CardDescription>
    </Card>
  );
}

/** Confort UX : le back refuse seul. Lit les permissions du salon actif. */
export function RequirePermission({ code, children }: { code: string; children: ReactNode }) {
  const allowed = useAppSelector((state) => selectHasPermission(state, code));
  return allowed ? children : <Forbidden hint="rbac.forbidden.permission" />;
}

export function RequireSystemRole({ role, children }: { role: string; children: ReactNode }) {
  const allowed = useAppSelector((state) => selectHasSystemRole(state, role));
  return allowed ? children : <Forbidden hint="rbac.forbidden.systemRole" />;
}
