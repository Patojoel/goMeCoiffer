import { t } from '@gomecoiffer/client-core';
import { View } from 'react-native';
import { IconTile } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export type ErrorStateProps = {
  readonly title: string;
  readonly description: string;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
  readonly retryLabel?: string;
};

export function ErrorState({
  title,
  description,
  onRetry,
  isRetrying = false,
  retryLabel = t('common.retry'),
}: ErrorStateProps) {
  return (
    <Card accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-3">
        <IconTile name="shield" tone="terra" size={42} />
        <View className="flex-1 gap-0.5">
          <CardTitle role="alert" className="text-destructive">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </View>
      </View>
      {onRetry ? (
        <Button
          variant="outline"
          title={retryLabel}
          onPress={onRetry}
          loading={isRetrying}
          className="self-start"
        />
      ) : null}
    </Card>
  );
}
