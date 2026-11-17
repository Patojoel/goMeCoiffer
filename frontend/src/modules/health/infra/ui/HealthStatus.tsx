import { CircleAlert, CircleCheck, DatabaseZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/lib/i18n/i18n';
import { useApiHealth } from './useApiHealth';

export function HealthStatus() {
  const { view, isRetrying, retry } = useApiHealth();

  if (view === 'loading') {
    return (
      <Card role="status" aria-busy="true" aria-label={t('common.loading')}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
      </Card>
    );
  }

  if (view === 'ok') {
    return (
      <Card role="status" aria-busy={isRetrying}>
        <CardTitle className="flex items-center gap-2 text-success">
          <CircleCheck aria-hidden="true" className="size-5" />
          {t('health.ok')}
        </CardTitle>
        <CardDescription>{t('health.okHint')}</CardDescription>
      </Card>
    );
  }

  const failure =
    view === 'databaseDown'
      ? { icon: DatabaseZap, title: t('health.databaseDown'), hint: t('health.databaseDownHint') }
      : { icon: CircleAlert, title: t('health.error'), hint: t('health.errorHint') };
  const Icon = failure.icon;

  return (
    <Card role="alert" aria-busy={isRetrying}>
      <CardTitle className="flex items-center gap-2 text-destructive">
        <Icon aria-hidden="true" className="size-5" />
        {failure.title}
      </CardTitle>
      <CardDescription>{failure.hint}</CardDescription>
      <Button variant="outline" onClick={retry} disabled={isRetrying} className="self-start">
        {t('common.retry')}
      </Button>
    </Card>
  );
}
