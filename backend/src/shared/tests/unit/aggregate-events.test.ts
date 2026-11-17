import { describe, expect, it } from 'vitest';
import { AggregateRoot } from '../../domain/aggregate-root.js';
import type { DomainEvent } from '../../domain/domain-event.js';

class SalonOpened implements DomainEvent {
  constructor(
    readonly salonId: string,
    readonly occurredAt: Date,
  ) {}
}

class Salon extends AggregateRoot {
  constructor(readonly id: string) {
    super();
  }
  open(at: Date) {
    this.record(new SalonOpened(this.id, at));
  }
}

describe('Events recorded by an aggregate', () => {
  it('hands over the recorded facts once, so they are never dispatched twice', () => {
    const salon = new Salon('salon-1');
    salon.open(new Date('2027-01-12T08:00:00Z'));

    expect(salon.pullEvents()).toEqual([new SalonOpened('salon-1', new Date('2027-01-12T08:00:00Z'))]);
    expect(salon.pullEvents()).toEqual([]);
  });
});
