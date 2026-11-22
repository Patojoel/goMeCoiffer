import { t } from '@gomecoiffer/client-core';
import { ErrorState } from '@/components/feedback/error-state';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiHealth } from './use-api-health';

export function HealthStatusCard() {
  const { view, isRetrying, retry } = useApiHealth();

  if (view === 'loading') {
    return (
      <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
      </Card>
    );
  }

  if (view === 'ok') {
    return (
      <Card accessible role="status" aria-busy={isRetrying}>
        <CardTitle className="text-success">{t('health.ok')}</CardTitle>
        <CardDescription>{t('health.okHint')}</CardDescription>
      </Card>
    );
  }

  if (view === 'databaseDown') {
    return (
      <ErrorState
        title={t('health.databaseDown')}
        description={t('health.databaseDownHint')}
        onRetry={retry}
        isRetrying={isRetrying}
      />
    );
  }

  return (
    <ErrorState
      title={t('health.error')}
      description={t('health.errorHint')}
      onRetry={retry}
      isRetrying={isRetrying}
    />
  );
}
