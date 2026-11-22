import type { RealtimeSource, RealtimeSourceCallbacks } from '@gomecoiffer/client-core';
import type { CreateRealtimeSourceOptions } from './createRealtimeSource';

export type { CreateRealtimeSourceOptions };

export function createRealtimeSource({
  url,
  onStreamClosed,
}: CreateRealtimeSourceOptions): RealtimeSource {
  return {
    connect(callbacks: RealtimeSourceCallbacks): () => void {
      const source = new EventSource(url, { withCredentials: true });
      source.onopen = () => callbacks.onOpen();
      source.onerror = () => {
        callbacks.onError();
        if (typeof EventSource !== 'undefined' && source.readyState === EventSource.CLOSED) {
          onStreamClosed?.();
        }
      };
      source.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') {
          callbacks.onMessage(event.data);
        }
      };
      return () => source.close();
    },
  };
}
