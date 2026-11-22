import { RealtimeEventSchema } from '@gomecoiffer/contracts';

export type RealtimeSourceCallbacks = {
  readonly onOpen: () => void;
  readonly onError: () => void;
  readonly onMessage: (rawData: string) => void;
};

export interface RealtimeSource {
  connect(callbacks: RealtimeSourceCallbacks): () => void;
}

export type RealtimeClientOptions = {
  readonly source: RealtimeSource;
  readonly onReconnect: () => void;
};

type Handler = (payload: Record<string, unknown>) => void;

export function createRealtimeClient({ source, onReconnect }: RealtimeClientOptions) {
  const handlers = new Map<string, Set<Handler>>();
  let closeConnection: (() => void) | null = null;
  let lost = false;

  const dispatch = (raw: string) => {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    const event = RealtimeEventSchema.safeParse(json);
    if (!event.success) return;
    handlers.get(event.data.type)?.forEach((handler) => handler(event.data.payload));
  };

  return {
    onRealtimeEvent(type: string, handler: Handler): () => void {
      const set = handlers.get(type) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(type, set);
      return () => set.delete(handler);
    },

    connect() {
      if (closeConnection) return;
      closeConnection = source.connect({
        onMessage: dispatch,
        onError: () => {
          lost = true;
        },
        onOpen: () => {
          if (!lost) return;
          lost = false;
          onReconnect();
        },
      });
    },

    disconnect() {
      closeConnection?.();
      closeConnection = null;
      lost = false;
    },
  };
}

export type RealtimeClient = ReturnType<typeof createRealtimeClient>;
