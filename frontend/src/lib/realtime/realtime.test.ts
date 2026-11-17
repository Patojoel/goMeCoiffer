import { describe, expect, it, vi } from 'vitest';
import { createRealtime, type EventSourceLike } from './realtime';

class FakeEventSource implements EventSourceLike {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;
  constructor(
    readonly url: string,
    readonly init: { withCredentials: boolean },
  ) {}
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
  }
  emit(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}

function setup() {
  const sources: FakeEventSource[] = [];
  const onReconnect = vi.fn();
  const realtime = createRealtime({
    url: '/api/salon/events',
    onReconnect,
    createEventSource: (url, init) => {
      const source = new FakeEventSource(url, init);
      sources.push(source);
      return source;
    },
  });
  return { realtime, onReconnect, sources };
}

describe('realtime', () => {
  it('ouvre un seul EventSource avec les cookies, même si on se connecte deux fois', () => {
    const { realtime, sources } = setup();

    realtime.connect();
    realtime.connect();

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ url: '/api/salon/events', init: { withCredentials: true } });
  });

  it('route un événement vers les abonnés de son type seulement', () => {
    const { realtime, sources } = setup();
    const onBooking = vi.fn();
    const onStaff = vi.fn();
    realtime.onRealtimeEvent('booking.confirmed', onBooking);
    realtime.onRealtimeEvent('staff.updated', onStaff);
    realtime.connect();

    sources[0]!.emit({ type: 'booking.confirmed', payload: { bookingId: 'b1' } });

    expect(onBooking).toHaveBeenCalledWith({ bookingId: 'b1' });
    expect(onStaff).not.toHaveBeenCalled();
  });

  it('ignore un événement dont la charge est invalide', () => {
    const { realtime, sources } = setup();
    const handler = vi.fn();
    realtime.onRealtimeEvent('booking.confirmed', handler);
    realtime.connect();

    sources[0]!.emit('pas du json');
    sources[0]!.emit({ payload: {} });
    sources[0]!.emit({ type: 'booking.confirmed', payload: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ne livre plus rien à un abonné désabonné', () => {
    const { realtime, sources } = setup();
    const handler = vi.fn();
    const unsubscribe = realtime.onRealtimeEvent('booking.confirmed', handler);
    realtime.connect();

    unsubscribe();
    sources[0]!.emit({ type: 'booking.confirmed', payload: {} });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ne relit rien à la première ouverture', () => {
    const { realtime, sources, onReconnect } = setup();
    realtime.connect();

    sources[0]!.open();

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('relit toutes les lectures quand le flux revient après une coupure', () => {
    const { realtime, sources, onReconnect } = setup();
    realtime.connect();
    sources[0]!.open();

    sources[0]!.fail();
    sources[0]!.open();

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('ferme le flux à la déconnexion', () => {
    const { realtime, sources } = setup();
    realtime.connect();

    realtime.disconnect();

    expect(sources[0]!.closed).toBe(true);
  });
});
