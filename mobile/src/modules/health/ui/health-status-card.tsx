import { t } from '@gomecoiffer/client-core';
import { View } from 'react-native';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/ui/brand';
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
        <View className="flex-row items-center gap-3">
          <IconTile name="sparkle" tone="green" size={40} />
          <View className="flex-1 gap-0.5">
            <CardTitle className="text-success">{t('health.ok')}</CardTitle>
            <CardDescription>{t('health.okHint')}</CardDescription>
          </View>
          <Badge variant="success" label="En ligne" />
        </View>
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
