import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { defer, EMPTY, filter, merge, of, Subject } from 'rxjs';
import { AfterCommit } from '../../application/after-commit.js';
import type { RealtimeMessage, RealtimePublisher } from '../../application/ports.js';

const MAX_REMEMBERED_CLOSINGS = 1_000;

/** Canaux en mémoire d'un processus ; l'envoi part après le commit de la commande en cours. */
@Injectable()
export class SseRealtimePublisher implements RealtimePublisher, OnModuleDestroy {
  private readonly channels = new Map<string, Subject<RealtimeMessage>>();
  /** Identifiants de session dont les flux doivent se fermer ; un seul sujet, filtré par chaque flux. */
  private readonly sessionClosings = new Subject<string>();

  /**
   * Sessions dont les flux viennent d'être fermés. Un flux qui a lu sa session juste avant sa destruction peut
   * s'abonner après le signal : il se ferme alors tout de suite. Borné (les plus anciennes sortent) ; un identifiant
   * de session ne servant jamais deux fois, aucune entrée ne peut fermer le flux d'une autre session.
   */
  private readonly recentlyClosed = new Set<string>();

  constructor(private readonly afterCommit: AfterCommit) {}

  publishToUser(userId: string, message: RealtimeMessage): void {
    this.afterCommit.register(() => this.channel(`user:${userId}`).next(message));
  }

  publishToSalon(salonId: string, message: RealtimeMessage): void {
    this.afterCommit.register(() => this.channel(`salon:${salonId}`).next(message));
  }

  closeStreamsOfUser(userId: string): void {
    this.afterCommit.register(() => this.channel(`close:${userId}`).next({ type: 'closed', payload: {} }));
  }

  closeStreamsOfSession(sessionId: string): void {
    this.afterCommit.register(() => {
      this.recentlyClosed.add(sessionId);
      if (this.recentlyClosed.size > MAX_REMEMBERED_CLOSINGS)
        this.recentlyClosed.delete(this.recentlyClosed.values().next().value as string);
      this.sessionClosings.next(sessionId);
    });
  }

  /** Émet quand les flux ouverts avec cette session doivent se fermer : les autres sessions de l'utilisateur ne sont pas touchées. */
  closingOfSession(sessionId: string) {
    return merge(
      this.sessionClosings.pipe(filter((closed) => closed === sessionId)),
      defer(() => (this.recentlyClosed.has(sessionId) ? of(sessionId) : EMPTY)),
    );
  }

  /** Émet quand les flux de cet utilisateur doivent se fermer. */
  closingOf(userId: string) {
    return this.channel(`close:${userId}`).asObservable();
  }

  streamOf(channel: `user:${string}` | `salon:${string}`) {
    return this.channel(channel).asObservable();
  }

  onModuleDestroy(): void {
    for (const subject of this.channels.values()) subject.complete();
    this.sessionClosings.complete();
  }

  private channel(name: string): Subject<RealtimeMessage> {
    let subject = this.channels.get(name);
    if (!subject) {
      subject = new Subject<RealtimeMessage>();
      this.channels.set(name, subject);
    }
    return subject;
  }
}
