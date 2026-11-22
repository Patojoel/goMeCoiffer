import {
  appApi,
  authApi,
  clientSessionStateFrom,
  clientSpaceApi,
  createRealtimeClient,
  invalidateAllReads,
  selectExpiredSessionKind,
  selectSession,
  sessionExpired,
  sessionStarted,
  type RealtimeSource,
  type TokenStorage,
} from '@gomecoiffer/client-core';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { env, localCookieSession } from '../config/env';
import {
  createRealtimeSource,
  type CreateRealtimeSourceOptions,
} from '../realtime/createRealtimeSource';
import { useTokenStorage } from './StoreProvider';
import { useAppDispatch, useAppSelector } from './hooks';

export type SessionLifecycleProps = {
  readonly realtimeSourceFactory?: (options: CreateRealtimeSourceOptions) => RealtimeSource;
  readonly apiBaseUrl?: string;
  readonly platformOs?: string;
  readonly onStaffSessionExpired?: () => void;
};

const WEB_NOOP_TOKEN_STORAGE: TokenStorage = {
  getSessionToken: () => Promise.resolve(null),
  setSessionToken: () => Promise.resolve(),
  clearSessionToken: () => Promise.resolve(),
  getDeviceToken: () => Promise.resolve(null),
  setDeviceToken: () => Promise.resolve(),
};

function hasErrorCode(error: unknown, expectedCode: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === expectedCode
  );
}

export function SessionLifecycle({
  realtimeSourceFactory = createRealtimeSource,
  apiBaseUrl = env.apiBaseUrl,
  platformOs = Platform.OS,
  onStaffSessionExpired,
}: SessionLifecycleProps) {
  const dispatch = useAppDispatch();
  const storage = useTokenStorage();
  const session = useAppSelector(selectSession);
  const expiredKind = useAppSelector(selectExpiredSessionKind);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      if (platformOs !== 'web' && !localCookieSession) {
        if (!storage) return;
        const token = await storage.getSessionToken().catch(() => null);
        if (!token) return;
      }

      try {
        await dispatch(authApi.endpoints.getStaffSession.initiate()).unwrap();
      } catch (error) {
        if (!hasErrorCode(error, 'STAFF_SIGN_IN_REQUIRED')) {
          return;
        }
        try {
          const res = await dispatch(clientSpaceApi.endpoints.getClientSession.initiate()).unwrap();
          if (res.kind === 'CLIENT') {
            dispatch(sessionStarted(clientSessionStateFrom(res.maskedPhone)));
          }
        } catch {
          // Session expiration (401) is cleared by HttpClient; network errors keep stored tokens (RG-013-17).
        }
      }
    })();
  }, [dispatch, platformOs, storage]);

  useEffect(() => {
    if (expiredKind !== 'STAFF') return;
    if (onStaffSessionExpired) {
      onStaffSessionExpired();
      return;
    }
    router.replace('/connexion' as Href);
  }, [expiredKind, onStaffSessionExpired]);

  useEffect(() => {
    if (session.kind !== 'STAFF' || session.activeSalonId === null) return;
    if (platformOs !== 'web' && storage === null) return;

    const refreshStaffSession = () => {
      void dispatch(authApi.endpoints.getStaffSession.initiate(undefined, { forceRefetch: true }));
    };

    const source = realtimeSourceFactory({
      url: `${apiBaseUrl.replace(/\/+$/, '')}/api/salon/realtime/stream`,
      storage: storage ?? WEB_NOOP_TOKEN_STORAGE,
      onUnauthorized: () => {
        dispatch(sessionExpired());
      },
      onStreamClosed: () => {
        refreshStaffSession();
      },
    });

    const client = createRealtimeClient({
      source,
      onReconnect: () => {
        dispatch(invalidateAllReads());
        refreshStaffSession();
      },
    });

    const unsubRole = client.onRealtimeEvent('salon.role_permissions_changed', () => {
      dispatch(appApi.util.invalidateTags(['SalonRoles', 'Session']));
      refreshStaffSession();
    });
    const refreshTeamAndSession = () => {
      dispatch(appApi.util.invalidateTags(['Team', 'Invitations', 'Session']));
      refreshStaffSession();
    };
    const unsubMemberRole = client.onRealtimeEvent(
      'salon.member_role_changed',
      refreshTeamAndSession,
    );
    const unsubTeam = client.onRealtimeEvent('salon.team_changed', refreshTeamAndSession);
    const unsubInvitation = client.onRealtimeEvent(
      'salon.invitation_changed',
      refreshTeamAndSession,
    );

    client.connect();

    return () => {
      unsubRole();
      unsubMemberRole();
      unsubTeam();
      unsubInvitation();
      client.disconnect();
    };
  }, [
    session.userId,
    session.kind,
    session.activeSalonId,
    apiBaseUrl,
    storage,
    realtimeSourceFactory,
    platformOs,
    dispatch,
  ]);

  return null;
}
