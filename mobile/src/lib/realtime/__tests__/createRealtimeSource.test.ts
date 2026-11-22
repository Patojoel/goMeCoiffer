import { createRealtimeClient } from '@gomecoiffer/client-core';
import type { EventSourceOptions, SseMessageEvent } from 'react-native-sse';
import type { AppStateStatus } from 'react-native';
import { InMemoryTokenStorage } from '../../storage/InMemoryTokenStorage';
import {
  createRealtimeSource,
  type AppStateAdapter,
  type NativeEventSourceLike,
  type NativeSseErrorEvent,
} from '../createRealtimeSource';
import { createRealtimeSource as createWebRealtimeSource } from '../createRealtimeSource.web';

class FakeNativeEventSource implements NativeEventSourceLike {
  private openListeners: (() => void)[] = [];
  private closeListeners: (() => void)[] = [];
  private heartbeatListeners: (() => void)[] = [];
  private errorListeners: ((event: NativeSseErrorEvent) => void)[] = [];
  private messageListeners: ((event: SseMessageEvent) => void)[] = [];
  closed = false;

  constructor(
    readonly url: string,
    readonly options: EventSourceOptions,
  ) {}

  addEventListener(type: 'open' | 'close' | 'heartbeat', listener: () => void): void;
  addEventListener(type: 'error', listener: (event?: NativeSseErrorEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SseMessageEvent) => void): void;
  addEventListener(type: string, listener: (...args: never[]) => void): void {
    if (type === 'open') this.openListeners.push(listener as () => void);
    if (type === 'close') this.closeListeners.push(listener as () => void);
    if (type === 'heartbeat') this.heartbeatListeners.push(listener as () => void);
    if (type === 'error') this.errorListeners.push(listener as (event: NativeSseErrorEvent) => void);
    if (type === 'message') this.messageListeners.push(listener as (event: SseMessageEvent) => void);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    // Simule react-native-sse qui émet synchronement 'close' lors de source.close().
    this.emitClose();
  }

  emitOpen(): void {
    for (const listener of this.openListeners) listener();
  }

  emitClose(): void {
    for (const listener of this.closeListeners) listener();
  }

  emitHeartbeat(): void {
    for (const listener of this.heartbeatListeners) listener();
  }

  emitError(event: NativeSseErrorEvent = {}): void {
    for (const listener of this.errorListeners) listener(event);
  }

  emitMessage(data: unknown): void {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    for (const listener of this.messageListeners) {
      listener({ type: 'message', data: raw, url: this.url, lastEventId: null });
    }
  }
}

class FakeAppState implements AppStateAdapter {
  currentState: AppStateStatus = 'active';
  private listeners = new Set<(state: AppStateStatus) => void>();

  addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
    this.listeners.add(listener);
    return {
      remove: () => {
        this.listeners.delete(listener);
      },
    };
  }

  setState(next: AppStateStatus): void {
    this.currentState = next;
    for (const listener of this.listeners) listener(next);
  }
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('Native SSE realtime source security & lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses to open an authenticated stream when no session token exists', async () => {
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage();
    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({ onOpen: () => {}, onError: () => {}, onMessage: () => {} });
    await flushMicrotasks();
    disconnect();

    expect(created).toHaveLength(0);
  });

  it('sends Bearer and app channel in headers with pollingInterval 0, and closes + notifies on current-token 401', async () => {
    jest.useFakeTimers();
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-live', deviceToken: 'dev-90' });
    let unauthorizedCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      onUnauthorized: () => {
        unauthorizedCount += 1;
      },
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({ onOpen: () => {}, onError: () => {}, onMessage: () => {} });
    await flushMicrotasks();

    expect(created).toHaveLength(1);
    expect(created[0]?.options).toMatchObject({
      pollingInterval: 0,
      headers: { 'x-client-channel': 'mobile', Authorization: 'Bearer tok-live' },
    });

    created[0]!.emitError({ xhrStatus: 401 });
    await flushMicrotasks();
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(created[0]!.closed).toBe(true);
    expect(created).toHaveLength(1);
    expect(unauthorizedCount).toBe(1);
    expect(await storage.getSessionToken()).toBeNull();
    expect(await storage.getDeviceToken()).toBe('dev-90');
    disconnect();
  });

  it('reopens immediately with rotated token when 401 belongs to an already-replaced token', async () => {
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-old' });
    let unauthorizedCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      onUnauthorized: () => {
        unauthorizedCount += 1;
      },
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({ onOpen: () => {}, onError: () => {}, onMessage: () => {} });
    await flushMicrotasks();

    await storage.setSessionToken('tok-new');
    created[0]!.emitError({ xhrStatus: 401 });
    await flushMicrotasks();

    expect(unauthorizedCount).toBe(0);
    expect(created).toHaveLength(2);
    expect(created[1]?.options.headers?.Authorization).toBe('Bearer tok-new');
    disconnect();
  });

  it('suspends cleanly if app goes background while token read is pending and triggers full reload on resume', async () => {
    let resolveToken!: (value: string | null) => void;
    const slowStorage = new InMemoryTokenStorage({ sessionToken: 'tok-bg' });
    slowStorage.getSessionToken = () =>
      new Promise<string | null>((resolve) => {
        resolveToken = resolve;
      });
    const appState = new FakeAppState();
    const created: FakeNativeEventSource[] = [];
    let reconnectCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage: slowStorage,
      appState,
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });
    const client = createRealtimeClient({
      source,
      onReconnect: () => {
        reconnectCount += 1;
      },
    });

    client.connect();
    appState.setState('background');
    resolveToken('tok-bg');
    await flushMicrotasks();
    expect(created).toHaveLength(0);

    slowStorage.getSessionToken = async () => 'tok-bg';
    appState.setState('active');
    await flushMicrotasks();

    expect(created).toHaveLength(1);
    created[0]!.emitOpen();
    expect(reconnectCount).toBe(1);
    client.disconnect();
  });

  it('keeps the stream open when heartbeat or message events arrive before heartbeatTimeoutMs', async () => {
    jest.useFakeTimers();
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-live' });
    let errorCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      heartbeatTimeoutMs: 1_000,
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({
      onOpen: () => {},
      onError: () => {
        errorCount += 1;
      },
      onMessage: () => {},
    });
    await flushMicrotasks();

    created[0]!.emitOpen();
    jest.advanceTimersByTime(700);
    created[0]!.emitHeartbeat();
    jest.advanceTimersByTime(700);
    created[0]!.emitMessage({ type: 'salon.team_changed', payload: {} });
    jest.advanceTimersByTime(700);

    expect(created[0]!.closed).toBe(false);
    expect(created).toHaveLength(1);
    expect(errorCount).toBe(0);

    // Silence after the last message triggers timeout at 1000ms (300ms remaining).
    jest.advanceTimersByTime(300);
    await flushMicrotasks();
    expect(created[0]!.closed).toBe(true);
    expect(errorCount).toBe(1);
    disconnect();
  });

  it('closes silent EOF stream after heartbeat timeout, reconnects immediately and detects 401', async () => {
    jest.useFakeTimers();
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-expired' });
    let errorCount = 0;
    let unauthorizedCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      heartbeatTimeoutMs: 1_000,
      onUnauthorized: () => {
        unauthorizedCount += 1;
      },
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({
      onOpen: () => {},
      onError: () => {
        errorCount += 1;
      },
      onMessage: () => {},
    });
    await flushMicrotasks();

    created[0]!.emitOpen();
    jest.advanceTimersByTime(1_000);
    jest.advanceTimersByTime(1);
    await flushMicrotasks();

    expect(created[0]!.closed).toBe(true);
    expect(errorCount).toBe(1);
    expect(created).toHaveLength(2);

    created[1]!.emitError({ xhrStatus: 401 });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(unauthorizedCount).toBe(1);
    expect(await storage.getSessionToken()).toBeNull();
    disconnect();
  });

  it('closes and reconnects immediately when native close event is emitted', async () => {
    jest.useFakeTimers();
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-live' });
    let errorCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({
      onOpen: () => {},
      onError: () => {
        errorCount += 1;
      },
      onMessage: () => {},
    });
    await flushMicrotasks();

    created[0]!.emitOpen();
    created[0]!.emitClose();
    jest.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(created[0]!.closed).toBe(true);
    expect(errorCount).toBe(1);
    expect(created).toHaveLength(2);
    disconnect();
  });

  it('waits 5000ms backoff on 500 error instead of 0ms tight loop even when close() emits close synchronously', async () => {
    jest.useFakeTimers();
    const created: FakeNativeEventSource[] = [];
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-live' });
    let errorCount = 0;

    const source = createRealtimeSource({
      url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
      storage,
      appState: new FakeAppState(),
      eventSourceFactory: (url, opts) => {
        const es = new FakeNativeEventSource(url, opts);
        created.push(es);
        return es;
      },
    });

    const disconnect = source.connect({
      onOpen: () => {},
      onError: () => {
        errorCount += 1;
      },
      onMessage: () => {},
    });
    await flushMicrotasks();

    created[0]!.emitOpen();
    created[0]!.emitError({ xhrStatus: 500 });
    jest.advanceTimersByTime(4_999);
    await flushMicrotasks();

    expect(errorCount).toBe(1);
    expect(created).toHaveLength(1);

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(created).toHaveLength(2);
    disconnect();
  });

  it('notifies onStreamClosed on web when EventSource enters CLOSED state on error', () => {
    const originalEventSource = globalThis.EventSource;
    let lastInstance: {
      readyState: number;
      onopen: (() => void) | null;
      onerror: (() => void) | null;
      onmessage: ((event: MessageEvent<unknown>) => void) | null;
      close: () => void;
    } | null = null;

    class FakeWebEventSource {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      constructor(
        url: string,
        _init?: EventSourceInit,
      ) {
        const instance = {
          url,
          readyState: 0,
          onopen: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
          close: () => {
            instance.readyState = 2;
          },
        };
        lastInstance = instance;
        return instance;
      }
    }

    (globalThis as unknown as { EventSource: typeof FakeWebEventSource }).EventSource = FakeWebEventSource;
    try {
      let errors = 0;
      let streamClosedCalls = 0;
      const source = createWebRealtimeSource({
        url: 'https://api.gomecoiffer.cm/api/salon/realtime/stream',
        storage: new InMemoryTokenStorage(),
        onStreamClosed: () => {
          streamClosedCalls += 1;
        },
      });
      const disconnect = source.connect({
        onOpen: () => {},
        onError: () => {
          errors += 1;
        },
        onMessage: () => {},
      });

      lastInstance!.readyState = FakeWebEventSource.CONNECTING;
      lastInstance!.onerror?.();
      expect(errors).toBe(1);
      expect(streamClosedCalls).toBe(0);

      lastInstance!.readyState = FakeWebEventSource.CLOSED;
      lastInstance!.onerror?.();
      expect(errors).toBe(2);
      expect(streamClosedCalls).toBe(1);
      disconnect();
    } finally {
      (globalThis as unknown as { EventSource: typeof originalEventSource }).EventSource =
        originalEventSource;
    }
  });
});
