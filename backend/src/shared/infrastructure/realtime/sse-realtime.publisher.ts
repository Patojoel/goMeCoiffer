import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { defer, EMPTY, filter, merge, of, Subject } from 'rxjs';
import { AfterCommit } from '../../application/after-commit.js';
import type { RealtimeMessage, RealtimePublisher } from '../../application/ports.js';

const MAX_REMEMBERED_CLOSINGS = 1_000;
/** Un identifiant d'utilisateur ou de salon sert plusieurs fois : une fermeture ne vaut que pour les flux qui s'ouvrent juste après. */
const RECENT_CLOSING_WINDOW_MS = 5_000;

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

  /** Fermetures d'utilisateur (`close:<id>`) et d'utilisateur sur un salon, avec leur instant, pour la fenêtre ci-dessus. */
  private readonly recentUserClosings = new Map<string, number>();

  constructor(private readonly afterCommit: AfterCommit) {}

  publishToUser(userId: string, message: RealtimeMessage): void {
    this.afterCommit.register(() => this.channel(`user:${userId}`).next(message));
  }

  publishToSalon(salonId: string, message: RealtimeMessage): void {
    this.afterCommit.register(() => this.channel(`salon:${salonId}`).next(message));
  }

  closeStreamsOfUser(userId: string): void {
    this.afterCommit.register(() => this.signalClosing(`close:${userId}`));
  }

  closeStreamsOfSession(sessionId: string): void {
    this.afterCommit.register(() => {
      this.recentlyClosed.add(sessionId);
      if (this.recentlyClosed.size > MAX_REMEMBERED_CLOSINGS)
        this.recentlyClosed.delete(this.recentlyClosed.values().next().value as string);
      this.sessionClosings.next(sessionId);
    });
  }

  closeUserStreamsInSalon(userId: string, salonId: string): void {
    this.afterCommit.register(() => this.signalClosing(`close:${userId}:salon:${salonId}`));
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
    return this.closingChannel(`close:${userId}`);
  }

  /** Émet quand les flux de cet utilisateur sur ce salon précis doivent se fermer (UC-011). */
  closingOfUserInSalon(userId: string, salonId: string) {
    return this.closingChannel(`close:${userId}:salon:${salonId}`);
  }

  streamOf(channel: `user:${string}` | `salon:${string}`) {
    return this.channel(channel).asObservable();
  }

  onModuleDestroy(): void {
    for (const subject of this.channels.values()) subject.complete();
    this.sessionClosings.complete();
  }

  private signalClosing(name: string): void {
    this.recentUserClosings.delete(name);
    this.recentUserClosings.set(name, Date.now());
    if (this.recentUserClosings.size > MAX_REMEMBERED_CLOSINGS)
      this.recentUserClosings.delete(this.recentUserClosings.keys().next().value as string);
    this.channel(name).next({ type: 'closed', payload: {} });
  }

  private closingChannel(name: string) {
    return merge(
      this.channel(name).asObservable(),
      defer(() => {
        const closedAt = this.recentUserClosings.get(name);
        return closedAt !== undefined && Date.now() - closedAt <= RECENT_CLOSING_WINDOW_MS ? of(name) : EMPTY;
      }),
    );
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
