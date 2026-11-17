import { invalidateAllReads } from '@/lib/store/api/appApi';
import type { AppDispatch } from '@/lib/store/store';
import { createRealtime, type EventSourceFactory } from './realtime';

/** Flux temps réel dont la reconnexion invalide toutes les lectures (relecture complète). */
export const createStoreRealtime = (
  url: string,
  dispatch: AppDispatch,
  createEventSource?: EventSourceFactory,
) => createRealtime({ url, createEventSource, onReconnect: () => dispatch(invalidateAllReads()) });
