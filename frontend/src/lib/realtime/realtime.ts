import { RealtimeEventSchema } from '@gomecoiffer/contracts';

/** Sous-ensemble d'`EventSource` utilisé ; permet d'injecter un faux dans les tests. */
export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  close(): void;
}

export type EventSourceFactory = (url: string, init: { withCredentials: boolean }) => EventSourceLike;

type Handler = (payload: Record<string, unknown>) => void;

export type RealtimeOptions = {
  url: string;
  /** Appelé quand le flux revient après une coupure : relire tout ce qui est affiché. */
  onReconnect: () => void;
  createEventSource?: EventSourceFactory;
};

const browserEventSource: EventSourceFactory = (url, init) => new EventSource(url, init);

export function createRealtime({
  url,
  onReconnect,
  createEventSource = browserEventSource,
}: RealtimeOptions) {
  const handlers = new Map<string, Set<Handler>>();
  let source: EventSourceLike | null = null;
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
    /** Abonne un handler à un type d'événement ; renvoie le désabonnement. */
    onRealtimeEvent(type: string, handler: Handler): () => void {
      const set = handlers.get(type) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(type, set);
      return () => set.delete(handler);
    },

    connect() {
      if (source) return;
      source = createEventSource(url, { withCredentials: true });
      source.onmessage = (event) => dispatch(event.data);
      source.onerror = () => {
        lost = true;
      };
      source.onopen = () => {
        if (!lost) return;
        lost = false;
        onReconnect();
      };
    },

    disconnect() {
      source?.close();
      source = null;
      lost = false;
    },
  };
}

export type Realtime = ReturnType<typeof createRealtime>;
