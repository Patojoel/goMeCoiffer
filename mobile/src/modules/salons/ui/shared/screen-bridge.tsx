import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';

export type ScreenContextProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
  readonly children: (context: {
    readonly onNavigate: (path: string) => void;
    readonly isOnline: boolean;
  }) => ReactNode;
};

function RouterNavigateBridge({
  isOnline,
  children,
}: {
  readonly isOnline: boolean;
  readonly children: ScreenContextProps['children'];
}) {
  const router = useRouter();
  return children({
    onNavigate: (path) => router.replace(path as Href),
    isOnline,
  });
}

function OnlineStatusBridge({
  onNavigate,
  children,
}: {
  readonly onNavigate?: (path: string) => void;
  readonly children: ScreenContextProps['children'];
}) {
  const liveOnline = useOnlineStatus();
  if (onNavigate) {
    return children({ onNavigate, isOnline: liveOnline });
  }
  return <RouterNavigateBridge isOnline={liveOnline}>{children}</RouterNavigateBridge>;
}

export function WithScreenContext({ onNavigate, isOnline, children }: ScreenContextProps) {
  if (isOnline === undefined) {
    return <OnlineStatusBridge onNavigate={onNavigate}>{children}</OnlineStatusBridge>;
  }
  if (!onNavigate) {
    return <RouterNavigateBridge isOnline={isOnline}>{children}</RouterNavigateBridge>;
  }
  return children({ onNavigate, isOnline });
}
