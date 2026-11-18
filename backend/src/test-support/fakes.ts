import type { ActorRights, Clock, IdGenerator } from '../shared/application/ports.js';

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(instant: Date): void {
    this.current = instant;
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  next(): string {
    this.counter += 1;
    return `00000000-0000-7000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

/** Droits fixés par le test : `rights[userId][salonId]` = permissions, `systemRoles[userId]` = rôles système. */
export class GrantedRights implements ActorRights {
  constructor(
    private readonly rights: Record<string, Record<string, readonly string[]>> = {},
    private readonly systemRoles: Record<string, readonly string[]> = {},
  ) {}

  async resolve(userId: string, activeSalonId: string | null) {
    const inSalon = activeSalonId ? this.rights[userId]?.[activeSalonId] : undefined;
    return {
      isMember: inSalon !== undefined,
      permissions: inSalon ?? [],
      systemRoles: this.systemRoles[userId] ?? [],
    };
  }
}
