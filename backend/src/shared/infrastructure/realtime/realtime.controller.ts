import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import type { Actor } from '../../application/ports.js';
import { CurrentActor } from '../security/decorators.js';
import { SseRealtimePublisher } from './sse-realtime.publisher.js';

const HEARTBEAT_MS = 25_000;

/**
 * Flux privé de l'utilisateur connecté : ses messages et ceux de son salon actif. Les destinataires sont
 * choisis par le serveur depuis la session ; le client ne choisit jamais le salon écouté.
 */
@Controller('salon/realtime')
export class RealtimeController {
  constructor(private readonly publisher: SseRealtimePublisher) {}

  @Sse('stream')
  stream(@CurrentActor() actor: Actor): Observable<MessageEvent> {
    const sources = [this.publisher.streamOf(`user:${actor.userId}`)];
    if (actor.activeSalonId) sources.push(this.publisher.streamOf(`salon:${actor.activeSalonId}`));
    const messages = merge(...sources).pipe(
      map((message): MessageEvent => ({ type: 'message', data: message })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: '' })));
    return merge(messages, heartbeat);
  }
}
