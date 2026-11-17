import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SessionState = {
  userId: string | null;
  activeSalonId: string | null;
  /** Permissions du rôle de l'utilisateur dans le salon actif. */
  permissions: readonly string[];
  systemRoles: readonly string[];
};

const initialState: SessionState = { userId: null, activeSalonId: null, permissions: [], systemRoles: [] };

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    sessionStarted: (_, action: PayloadAction<SessionState>) => action.payload,
    /** Changement de salon : le cache de lecture est vidé par le listener du store. */
    activeSalonChanged: (
      state,
      action: PayloadAction<{ salonId: string; permissions: readonly string[] }>,
    ) => {
      state.activeSalonId = action.payload.salonId;
      state.permissions = [...action.payload.permissions];
    },
    sessionCleared: () => initialState,
  },
  selectors: {
    selectActiveSalonId: (s) => s.activeSalonId,
    selectHasPermission: (s, code: string) => s.permissions.includes(code),
    selectHasSystemRole: (s, role: string) => s.systemRoles.includes(role),
  },
});

export const { sessionStarted, activeSalonChanged, sessionCleared } = sessionSlice.actions;
export const { selectActiveSalonId, selectHasPermission, selectHasSystemRole } = sessionSlice.selectors;
