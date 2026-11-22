declare module 'react-native-sse' {
  export type EventSourceOptions = {
    method?: string;
    timeout?: number;
    timeoutBeforeConnection?: number;
    withCredentials?: boolean;
    headers?: Record<string, string>;
    body?: string;
    debug?: boolean;
    pollingInterval?: number;
    lineEndingCharacter?: string | null;
  };

  export type SseMessageEvent = {
    type: string;
    data: string | null;
    url: string;
    lastEventId: string | null;
  };

  export default class EventSource {
    constructor(url: string, options?: EventSourceOptions);
    addEventListener(type: 'open' | 'error' | 'close' | 'heartbeat', listener: () => void): void;
    addEventListener(type: 'message', listener: (event: SseMessageEvent) => void): void;
    removeEventListener(type: string, listener: (...args: never[]) => void): void;
    close(): void;
  }
}
