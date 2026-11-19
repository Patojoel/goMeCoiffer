import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, type Observable, takeUntil, timer } from 'rxjs';
import type { Actor } from '../../application/ports.js';
import { AuthenticatedOnly, CurrentActor } from '../security/decorators.js';
import { SseRealtimePublisher } from './sse-realtime.publisher.js';

const HEARTBEAT_MS = 25_000;
/** Le flux se referme : le client se reconnecte et la session, l'appartenance et le salon actif sont revérifiés. */
const MAX_STREAM_LIFETIME_MS = 30 * 60_000;

/**
 * Flux privé de l'utilisateur connecté : ses messages et ceux de son salon actif (appartenance revérifiée par
 * l'AuthGuard). Les destinataires sont choisis par le serveur depuis la session, jamais par le client.
 */
@Controller('salon/realtime')
export class RealtimeController {
  constructor(private readonly publisher: SseRealtimePublisher) {}

  @Sse('stream')
  @AuthenticatedOnly()
  stream(@CurrentActor() actor: Actor): Observable<MessageEvent> {
    const sources = [this.publisher.streamOf(`user:${actor.userId}`)];
    if (actor.activeSalonId) sources.push(this.publisher.streamOf(`salon:${actor.activeSalonId}`));
    const messages = merge(...sources).pipe(
      map((message): MessageEvent => ({ type: 'message', data: message })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: '' })));
    return merge(messages, heartbeat).pipe(takeUntil(merge(timer(MAX_STREAM_LIFETIME_MS), this.publisher.closingOf(actor.userId))));
  }
}
