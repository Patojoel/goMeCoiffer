import { TransactionHost } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { getDataSourceToken } from '@nestjs/typeorm';
import { firstValueFrom, take, timeout, toArray } from 'rxjs';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REALTIME_PUBLISHER, type RealtimePublisher } from '../../application/ports.js';
import { TransactionalCommandBus } from '../../application/transactional-command-bus.js';
import type { DomainEvent, IntegrationEvent } from '../../domain/domain-event.js';
import { DomainEventDispatcher } from '../../infrastructure/events/domain-event-dispatcher.js';
import { OutboxRelay } from '../../infrastructure/events/outbox-relay.js';
import { SseRealtimePublisher } from '../../infrastructure/realtime/sse-realtime.publisher.js';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

class NoteWritten implements DomainEvent {
  constructor(
    readonly noteId: string,
    readonly text: string,
    readonly occurredAt: Date,
  ) {}
}

class NoteShared implements IntegrationEvent {
  static readonly type = 'probe.note_shared';
  readonly integration = true as const;
  constructor(
    readonly noteId: string,
    readonly occurredAt: Date,
  ) {}
}

class WriteNote extends Command<void> {
  constructor(
    readonly noteId: string,
    readonly text: string,
    readonly share: boolean,
  ) {
    super();
  }
}

@CommandHandler(WriteNote)
class WriteNoteHandler implements ICommandHandler<WriteNote> {
  constructor(
    private readonly txHost: TransactionHost,
    private readonly events: DomainEventDispatcher,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute({ noteId, text, share }: WriteNote) {
    const at = new Date('2027-01-12T08:00:00Z');
    await (this.txHost.tx as { query: DataSource['query'] }).query(
      `INSERT INTO probe_notes (id) VALUES ($1)`,
      [noteId],
    );
    this.realtime.publishToSalon('salon-1', { type: 'NOTE_WRITTEN', payload: { noteId } });
    await this.events.dispatch(
      share
        ? [new NoteWritten(noteId, text, at), new NoteShared(noteId, at)]
        : [new NoteWritten(noteId, text, at)],
    );
  }
}

@Injectable()
class WhenNoteWritten {
  readonly subscribesTo = NoteWritten;
  handle(e: NoteWritten) {
    if (e.text === 'refused') throw new Error('subscriber refuses the note');
  }
}

@Injectable()
class WhenNoteShared {
  readonly subscribesTo = NoteShared;
  constructor(private readonly txHost: TransactionHost) {}
  handle(e: NoteShared) {
    return (this.txHost.tx as { query: DataSource['query'] }).query(
      `INSERT INTO probe_deliveries (note_id) VALUES ($1)`,
      [e.noteId],
    );
  }
}

describe('Writing through the transactional command bus', () => {
  let t: TestApp;
  let bus: TransactionalCommandBus;
  let relay: OutboxRelay;
  let db: DataSource;
  const count = async (sqlText: string, id: string) => Number((await db.query(sqlText, [id]))[0].n);
  const notes = (id: string) => count(`SELECT count(*) AS n FROM probe_notes WHERE id = $1`, id);
  const deliveries = (id: string) =>
    count(`SELECT count(*) AS n FROM probe_deliveries WHERE note_id = $1`, id);
  const outbox = (id: string) => count(`SELECT count(*) AS n FROM outbox WHERE payload->>'noteId' = $1`, id);

  beforeAll(async () => {
    t = await startTestApp({ providers: [WriteNoteHandler, WhenNoteWritten, WhenNoteShared] });
    bus = t.moduleRef.get(TransactionalCommandBus);
    relay = t.moduleRef.get(OutboxRelay);
    db = t.moduleRef.get(getDataSourceToken());
    await db.query(`CREATE TABLE probe_notes (id text PRIMARY KEY)`);
    await db.query(`CREATE TABLE probe_deliveries (note_id text NOT NULL)`);
  });
  afterAll(() => t.close());

  it('cancels the whole command when a domain-event subscriber refuses it', async () => {
    await expect(bus.execute(new WriteNote('n-refused', 'refused', false))).rejects.toThrow(
      'subscriber refuses',
    );
    expect(await notes('n-refused')).toBe(0);
  });

  it('lets no integration event out of a command that failed', async () => {
    await expect(bus.execute(new WriteNote('n-failed-share', 'refused', true))).rejects.toThrow();
    expect(await outbox('n-failed-share')).toBe(0);
  });

  it('delivers an integration event to its subscriber after the commit', async () => {
    await bus.execute(new WriteNote('n-shared', 'hello', true));
    await relay.drain();
    expect(await deliveries('n-shared')).toBe(1);
  });

  it('does not repeat the effect when the same integration event is delivered again', async () => {
    await bus.execute(new WriteNote('n-replayed', 'hello', true));
    await relay.drain();
    await db.query(`UPDATE outbox SET processed_at = NULL WHERE payload->>'noteId' = $1`, ['n-replayed']);
    await relay.drain();
    expect(await deliveries('n-replayed')).toBe(1);
  });

  it('pushes a realtime message only once the command is committed', async () => {
    const received = firstValueFrom(
      t.moduleRef
        .get(SseRealtimePublisher)
        .streamOf('salon:salon-1')
        .pipe(take(1), toArray(), timeout(2_000)),
    );
    await expect(bus.execute(new WriteNote('n-rt-failed', 'refused', false))).rejects.toThrow();
    await bus.execute(new WriteNote('n-rt-ok', 'hello', false));
    expect(await received).toEqual([{ type: 'NOTE_WRITTEN', payload: { noteId: 'n-rt-ok' } }]);
  });
});
