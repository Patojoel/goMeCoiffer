import { Invitation } from '../../domain/aggregates/invitation.js';
import type { SalonRole } from '../../domain/enums/salon-role.enum.js';
import { MIREILLE_ID } from './organization-builders.js';

export const AKWA_ID = '0195f000-0000-7000-8000-00000000c001';
export const BASTOS_ID = '0195f000-0000-7000-8000-00000000c002';
export const ELEGANCE_ID = '0195f000-0000-7000-8000-00000000c003';
export const AWA_ID = '0195f000-0000-7000-8000-00000000b004';
export const BRICE_PHONE = '+237655443322';
/** Instant du contexte de UC-006 : 19/11/2026 à 10 h 00, heure de Douala. */
export const NOW = new Date('2026-11-19T10:00:00+01:00');
export const DAY_MS = 86_400_000;

export const anInvitation = (
  over: {
    id?: string;
    salonId?: string;
    name?: string;
    phone?: string;
    role?: SalonRole;
    notifyBySms?: boolean;
    now?: Date;
  } = {},
): Invitation =>
  Invitation.issue({
    id: over.id ?? '0195f000-0000-7000-8000-00000000d001',
    salonId: over.salonId ?? AKWA_ID,
    invitedByUserId: MIREILLE_ID,
    name: over.name ?? 'Brice Nana',
    phone: over.phone ?? BRICE_PHONE,
    role: over.role ?? 'HAIRDRESSER',
    notifyBySms: over.notifyBySms ?? true,
    now: over.now ?? NOW,
  });
