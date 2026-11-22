import { t } from '@gomecoiffer/client-core';
import { View } from 'react-native';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';

export type OfflineBannerProps = {
  readonly isOnline?: boolean;
};

function OfflineBannerView({ isOnline }: { readonly isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <View
      accessible
      role="alert"
      accessibilityLiveRegion="polite"
      className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5"
    >
      <ThemedText variant="error" className="text-sm font-medium">
        {t('common.offlineBanner')}
      </ThemedText>
    </View>
  );
}

function LiveOfflineBanner() {
  const isOnline = useOnlineStatus();
  return <OfflineBannerView isOnline={isOnline} />;
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline !== undefined) {
    return <OfflineBannerView isOnline={isOnline} />;
  }
  return <LiveOfflineBanner />;
}
