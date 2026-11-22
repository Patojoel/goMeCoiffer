import { describe, expect, it, vi } from 'vitest';
import {
  createRealtimeClient,
  type RealtimeSource,
  type RealtimeSourceCallbacks,
} from '../RealtimeSource.js';

class FakeRealtimeSource implements RealtimeSource {
  connections = 0;
  closed = false;
  private callbacks: RealtimeSourceCallbacks | null = null;

  connect(callbacks: RealtimeSourceCallbacks): () => void {
    this.connections++;
    this.closed = false;
    this.callbacks = callbacks;
    return () => {
      this.closed = true;
      this.callbacks = null;
    };
  }

  open() {
    this.callbacks?.onOpen();
  }

  fail() {
    this.callbacks?.onError();
  }

  emit(data: unknown) {
    this.callbacks?.onMessage(typeof data === 'string' ? data : JSON.stringify(data));
  }
}

describe('Realtime event routing and reconnection', () => {
  it('opens a single connection and routes valid events by type', () => {
    const source = new FakeRealtimeSource();
    const client = createRealtimeClient({ source, onReconnect: vi.fn() });
    const onBooking = vi.fn();
    const onStaff = vi.fn();

    client.onRealtimeEvent('booking.confirmed', onBooking);
    client.onRealtimeEvent('staff.updated', onStaff);
    client.connect();
    client.connect();

    source.emit({ type: 'booking.confirmed', payload: { bookingId: 'b1' } });

    expect(source.connections).toBe(1);
    expect(onBooking).toHaveBeenCalledWith({ bookingId: 'b1' });
    expect(onStaff).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON or payloads outside RealtimeEventSchema', () => {
    const source = new FakeRealtimeSource();
    const client = createRealtimeClient({ source, onReconnect: vi.fn() });
    const handler = vi.fn();
    client.onRealtimeEvent('booking.confirmed', handler);
    client.connect();

    source.emit('not json');
    source.emit({ payload: {} });
    source.emit({ type: 'booking.confirmed', payload: 'invalid' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering events after unsubscribing and closes on disconnect', () => {
    const source = new FakeRealtimeSource();
    const client = createRealtimeClient({ source, onReconnect: vi.fn() });
    const handler = vi.fn();
    const unsubscribe = client.onRealtimeEvent('booking.confirmed', handler);

    client.connect();
    unsubscribe();
    source.emit({ type: 'booking.confirmed', payload: {} });
    client.disconnect();

    expect(handler).not.toHaveBeenCalled();
    expect(source.closed).toBe(true);
  });

  it('triggers onReconnect only when reopening after an error, never on initial open', () => {
    const source = new FakeRealtimeSource();
    const onReconnect = vi.fn();
    const client = createRealtimeClient({ source, onReconnect });

    client.connect();
    source.open();
    expect(onReconnect).not.toHaveBeenCalled();

    source.fail();
    source.open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
