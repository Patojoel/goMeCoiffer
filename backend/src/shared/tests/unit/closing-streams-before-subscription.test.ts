import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AfterCommit } from '../../application/after-commit.js';
import { SseRealtimePublisher } from '../../infrastructure/realtime/sse-realtime.publisher.js';

const publisher = () =>
  new SseRealtimePublisher({ register: (f: () => void) => f() } as unknown as AfterCommit);

describe('Closing the streams of a user that were not yet subscribed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-11-20T09:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('closes a stream of the user that subscribes just after the closing', () => {
    const p = publisher();
    p.closeStreamsOfUser('user-1');

    let closed = false;
    p.closingOf('user-1').subscribe(() => (closed = true));

    expect(closed).toBe(true);
  });

  it('closes a stream of the user on this salon that subscribes just after the closing', () => {
    const p = publisher();
    p.closeUserStreamsInSalon('user-1', 'salon-1');

    let closed = false;
    p.closingOfUserInSalon('user-1', 'salon-1').subscribe(() => (closed = true));

    expect(closed).toBe(true);
  });

  it('keeps open the streams of the same user on another salon, and of another user', () => {
    const p = publisher();
    p.closeUserStreamsInSalon('user-1', 'salon-1');

    let otherSalon = false;
    let otherUser = false;
    p.closingOfUserInSalon('user-1', 'salon-2').subscribe(() => (otherSalon = true));
    p.closingOfUserInSalon('user-2', 'salon-1').subscribe(() => (otherUser = true));

    expect([otherSalon, otherUser]).toEqual([false, false]);
  });

  it('does not close a stream opened well after the closing: a later sign-in must stay connected', () => {
    const p = publisher();
    p.closeStreamsOfUser('user-1');
    p.closeUserStreamsInSalon('user-1', 'salon-1');
    vi.advanceTimersByTime(10_000);

    let user = false;
    let inSalon = false;
    p.closingOf('user-1').subscribe(() => (user = true));
    p.closingOfUserInSalon('user-1', 'salon-1').subscribe(() => (inSalon = true));

    expect([user, inSalon]).toEqual([false, false]);
  });
});
