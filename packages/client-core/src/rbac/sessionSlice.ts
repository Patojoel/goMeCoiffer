import type { NextStep, SessionSummary } from '@gomecoiffer/contracts';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SessionKind = 'STAFF' | 'CLIENT';
export type SessionSalon = SessionSummary['salons'][number];

export type SessionState = {
  readonly userId: string | null;
  readonly kind: SessionKind | null;
  readonly expiredKind?: SessionKind | null;
  readonly activeSalonId: string | null;
  readonly permissions: readonly string[];
  readonly systemRoles: readonly string[];
  readonly maskedPhone: string | null;
  readonly userName?: string | null;
  readonly salons?: readonly SessionSalon[];
  readonly nextStep?: NextStep | null;
};

const initialState: SessionState = {
  userId: null,
  kind: null,
  expiredKind: null,
  activeSalonId: null,
  permissions: [],
  systemRoles: [],
  maskedPhone: null,
  userName: null,
  salons: [],
  nextStep: null,
};

export function sessionStateFromSummary(summary: SessionSummary): SessionState {
  return {
    userId: summary.user.id,
    userName: summary.user.name,
    kind: 'STAFF',
    expiredKind: null,
    activeSalonId: summary.activeSalonId,
    salons: [...summary.salons],
    permissions: [...summary.permissions],
    systemRoles: [...summary.systemRoles],
    maskedPhone: null,
    nextStep: summary.nextStep,
  };
}

export function clientSessionStateFrom(maskedPhone: string): SessionState {
  return {
    userId: 'client',
    userName: null,
    kind: 'CLIENT',
    expiredKind: null,
    activeSalonId: null,
    salons: [],
    permissions: [],
    systemRoles: [],
    maskedPhone,
    nextStep: null,
  };
}

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted: (_, action: PayloadAction<SessionState>) => ({
      ...action.payload,
      expiredKind: null,
    }),
    activeSalonChanged: (
      state,
      action: PayloadAction<{
        readonly salonId: string;
        readonly permissions: readonly string[];
        readonly nextStep?: NextStep;
      }>,
    ) => {
      if (state.userId === null || state.kind !== 'STAFF') return;
      state.activeSalonId = action.payload.salonId;
      state.permissions = [...action.payload.permissions];
      if (action.payload.nextStep) {
        state.nextStep = action.payload.nextStep;
      }
    },
    sessionExpired: (state) => ({
      ...initialState,
      expiredKind: state.kind ?? state.expiredKind ?? null,
    }),
    sessionCleared: () => initialState,
  },
  selectors: {
    selectSession: (s) => s,
    selectIsAuthenticated: (s) => s.userId !== null && s.kind !== null,
    selectSessionKind: (s) => s.kind,
    selectExpiredSessionKind: (s) => s.expiredKind ?? null,
    selectUserName: (s) => s.userName ?? null,
    selectSalons: (s) => s.salons ?? [],
    selectNextStep: (s) => s.nextStep ?? null,
    selectActiveSalonId: (s) => s.activeSalonId,
    selectActiveSalon: (s) => (s.salons ?? []).find((salon) => salon.id === s.activeSalonId) ?? null,
    selectHasPermission: (s, code: string) =>
      s.userId !== null && s.kind === 'STAFF' && s.permissions.includes(code),
    selectHasSystemRole: (s, role: string) =>
      s.userId !== null && s.kind === 'STAFF' && s.systemRoles.includes(role),
  },
});

export const { sessionStarted, activeSalonChanged, sessionExpired, sessionCleared } =
  sessionSlice.actions;
export const {
  selectSession,
  selectIsAuthenticated,
  selectSessionKind,
  selectExpiredSessionKind,
  selectUserName,
  selectSalons,
  selectNextStep,
  selectActiveSalonId,
  selectActiveSalon,
  selectHasPermission,
  selectHasSystemRole,
} = sessionSlice.selectors;
