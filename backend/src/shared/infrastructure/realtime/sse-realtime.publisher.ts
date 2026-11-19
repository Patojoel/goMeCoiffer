import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AfterCommit } from '../../application/after-commit.js';
import type { RealtimeMessage, RealtimePublisher } from '../../application/ports.js';

/** Canaux en mémoire d'un processus ; l'envoi part après le commit de la commande en cours. */
@Injectable()
export class SseRealtimePublisher implements RealtimePublisher, OnModuleDestroy {
  private readonly channels = new Map<string, Subject<RealtimeMessage>>();

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

  /** Émet quand les flux de cet utilisateur doivent se fermer. */
  closingOf(userId: string) {
    return this.channel(`close:${userId}`).asObservable();
  }

  streamOf(channel: `user:${string}` | `salon:${string}`) {
    return this.channel(channel).asObservable();
  }

  onModuleDestroy(): void {
    for (const subject of this.channels.values()) subject.complete();
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
