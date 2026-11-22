const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:10400';

const LOCAL_ENVIRONMENTS = new Set(['local', 'test']);

export function resolveDefaultAppEnv(
  isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): 'local' | 'production' {
  return isDev || nodeEnv === 'test' ? 'local' : 'production';
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (bare === 'localhost' || bare === '127.0.0.1' || bare === '::1' || bare === '10.0.2.2') {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(bare)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(bare);
}

export function resolveApiBaseUrl(
  rawUrl: string | undefined,
  appEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim() || resolveDefaultAppEnv(),
): string {
  const isLocalEnv = LOCAL_ENVIRONMENTS.has(appEnv);
  const candidate = rawUrl?.trim() || (isLocalEnv ? DEFAULT_LOCAL_API_BASE_URL : '');

  if (!candidate) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL est requis hors environnement local.');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit être une URL valide.');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL ne doit contenir ni identifiants, ni paramètres, ni fragment.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit utiliser http:// ou https://.');
  }

  if (parsed.protocol === 'http:' && (!isLocalEnv || !isPrivateOrLoopbackHost(parsed.hostname))) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit utiliser https:// hors hôte local de développement.');
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
} as const;
