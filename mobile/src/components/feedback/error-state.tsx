import { t } from '@gomecoiffer/client-core';
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
      <CardTitle role="alert" className="text-destructive">
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
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
