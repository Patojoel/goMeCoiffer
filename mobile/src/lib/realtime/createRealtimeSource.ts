import type { RealtimeSource, RealtimeSourceCallbacks, TokenStorage } from '@gomecoiffer/client-core';
import { AppState, type AppStateStatus } from 'react-native';
import EventSource, { type EventSourceOptions, type SseMessageEvent } from 'react-native-sse';
import { MOBILE_CLIENT_CHANNEL, MOBILE_CLIENT_HEADER } from '../http/headers';

const RECONNECT_DELAY_MS = 5_000;
const STREAM_RECYCLE_MS = 25 * 60 * 1_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 65_000;

export type NativeSseErrorEvent = {
  readonly xhrStatus?: number;
};

export interface NativeEventSourceLike {
  addEventListener(type: 'open' | 'close' | 'heartbeat', listener: () => void): void;
  addEventListener(type: 'error', listener: (event?: NativeSseErrorEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SseMessageEvent) => void): void;
  close(): void;
}

export type AppStateAdapter = {
  readonly currentState: AppStateStatus | string | null | undefined;
  addEventListener(type: 'change', listener: (next: AppStateStatus) => void): { remove(): void };
};

const isBackgroundState = (state: AppStateAdapter['currentState']): boolean => state === 'background';

export type CreateRealtimeSourceOptions = {
  readonly url: string;
  readonly storage: TokenStorage;
  readonly onUnauthorized?: () => void;
  readonly onStreamClosed?: () => void;
  readonly heartbeatTimeoutMs?: number;
  readonly eventSourceFactory?: (url: string, options: EventSourceOptions) => NativeEventSourceLike;
  readonly appState?: AppStateAdapter;
};

export function createRealtimeSource({
  url,
  storage,
  onUnauthorized,
  heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS,
  eventSourceFactory = (targetUrl, options) =>
    new EventSource(targetUrl, options) as NativeEventSourceLike,
  appState = AppState,
}: CreateRealtimeSourceOptions): RealtimeSource {
  return {
    connect(callbacks: RealtimeSourceCallbacks): () => void {
      let disposed = false;
      let opening = false;
      let pausedInBackground = isBackgroundState(appState.currentState);
      let source: NativeEventSourceLike | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let recycleTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (recycleTimer) {
          clearTimeout(recycleTimer);
          recycleTimer = null;
        }
        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      const closeStream = () => {
        clearTimers();
        const active = source;
        source = null;
        active?.close();
      };

      const scheduleReconnect = (delayMs = RECONNECT_DELAY_MS) => {
        if (disposed || pausedInBackground || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void openStream();
        }, delayMs);
      };

      const armHeartbeat = (expectedSource: NativeEventSourceLike) => {
        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer);
        }
        heartbeatTimer = setTimeout(() => {
          heartbeatTimer = null;
          if (source !== expectedSource || disposed) return;
          closeStream();
          callbacks.onError();
          scheduleReconnect(0);
        }, heartbeatTimeoutMs);
      };

      const openStream = async () => {
        if (disposed || opening || source) return;
        if (isBackgroundState(appState.currentState)) {
          pausedInBackground = true;
          return;
        }

        opening = true;
        let openedToken: string | null = null;
        try {
          openedToken = await storage.getSessionToken();
        } catch {
          return;
        } finally {
          opening = false;
        }

        if (disposed || source) return;
        if (isBackgroundState(appState.currentState)) {
          pausedInBackground = true;
          return;
        }
        if (!openedToken) return;

        const nextSource = eventSourceFactory(url, {
          pollingInterval: 0,
          headers: {
            [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_CHANNEL,
            Authorization: `Bearer ${openedToken}`,
          },
        });

        nextSource.addEventListener('open', () => {
          if (source !== nextSource || disposed) return;
          callbacks.onOpen();
          clearTimers();
          recycleTimer = setTimeout(() => {
            if (source !== nextSource || disposed) return;
            closeStream();
            callbacks.onError();
            scheduleReconnect(0);
          }, STREAM_RECYCLE_MS);
          armHeartbeat(nextSource);
        });

        nextSource.addEventListener('heartbeat', () => {
          if (source !== nextSource || disposed) return;
          armHeartbeat(nextSource);
        });

        nextSource.addEventListener('close', () => {
          if (source !== nextSource || disposed) return;
          closeStream();
          callbacks.onError();
          scheduleReconnect(0);
        });

        nextSource.addEventListener('error', (event) => {
          if (source !== nextSource || disposed) return;
          closeStream();

          if (event?.xhrStatus === 401) {
            void handleUnauthorized(openedToken);
            return;
          }

          callbacks.onError();
          scheduleReconnect();
        });

        nextSource.addEventListener('message', (event) => {
          if (source !== nextSource || disposed || typeof event.data !== 'string') return;
          armHeartbeat(nextSource);
          callbacks.onMessage(event.data);
        });

        source = nextSource;
      };

      const handleUnauthorized = async (openedToken: string) => {
        const currentToken = await storage.getSessionToken().catch(() => null);
        if (disposed) return;

        if (currentToken && currentToken !== openedToken) {
          callbacks.onError();
          void openStream();
          return;
        }

        if (currentToken === openedToken) {
          await storage.clearSessionToken().catch(() => undefined);
          onUnauthorized?.();
        }
      };

      const appStateSub = appState.addEventListener('change', (nextState) => {
        if (nextState === 'background') {
          const hadPendingOrActive = Boolean(source || opening || reconnectTimer);
          pausedInBackground = true;
          closeStream();
          if (hadPendingOrActive) {
            callbacks.onError();
          }
          return;
        }

        if (nextState === 'active' && pausedInBackground) {
          pausedInBackground = false;
          void openStream();
        }
      });

      if (!pausedInBackground) {
        void openStream();
      }

      return () => {
        disposed = true;
        appStateSub.remove();
        closeStream();
      };
    },
  };
}
