import { resolveApiBaseUrl, resolveDefaultAppEnv } from '../env';

describe('Resolving and validating API base URL', () => {
  it('allows http loopback or LAN URLs in local env and strips trailing slashes', () => {
    expect(resolveApiBaseUrl(undefined, 'local')).toBe('http://localhost:10400');
    expect(resolveApiBaseUrl('http://10.0.2.2:10400/', 'local')).toBe('http://10.0.2.2:10400');
    expect(resolveApiBaseUrl('https://preprod.gomecoiffer.cm/', 'preview')).toBe(
      'https://preprod.gomecoiffer.cm',
    );
  });

  it('requires explicit HTTPS URL outside local and test environments', () => {
    expect(() => resolveApiBaseUrl(undefined, 'production')).toThrow();
    expect(() => resolveApiBaseUrl('http://api.gomecoiffer.cm', 'production')).toThrow();
    expect(() => resolveApiBaseUrl('http://api.gomecoiffer.cm', 'preview')).toThrow();
    expect(() => resolveApiBaseUrl('http://api.gomecoiffer.cm', 'local')).toThrow();
  });

  it('rejects credentials, query strings, fragments, and non-HTTP schemes', () => {
    expect(() => resolveApiBaseUrl('https://user:pass@api.gomecoiffer.cm', 'production')).toThrow();
    expect(() => resolveApiBaseUrl('https://api.gomecoiffer.cm?x=1', 'production')).toThrow();
    expect(() => resolveApiBaseUrl('https://api.gomecoiffer.cm#frag', 'production')).toThrow();
    expect(() => resolveApiBaseUrl('ftp://api.gomecoiffer.cm', 'local')).toThrow();
  });

  it('defaults to production outside dev/test and to local in dev/test (M-5)', () => {
    expect(resolveDefaultAppEnv(false, 'production')).toBe('production');
    expect(resolveDefaultAppEnv(false, '')).toBe('production');
    expect(resolveDefaultAppEnv(true, 'production')).toBe('local');
    expect(resolveDefaultAppEnv(false, 'test')).toBe('local');

    const prevDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
    try {
      (globalThis as { __DEV__?: boolean }).__DEV__ = false;
      delete (process.env as { NODE_ENV?: string }).NODE_ENV;
      expect(resolveDefaultAppEnv()).toBe('production');
      process.env.NODE_ENV = 'production';
      process.env.EXPO_PUBLIC_APP_ENV = '   ';
      expect(() => resolveApiBaseUrl(undefined)).toThrow();
      expect(() => resolveApiBaseUrl('http://localhost:10400')).toThrow();
      expect(resolveApiBaseUrl('https://api.gomecoiffer.cm/')).toBe('https://api.gomecoiffer.cm');
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = prevDev;
      process.env.NODE_ENV = prevNodeEnv;
      if (prevAppEnv === undefined) {
        delete process.env.EXPO_PUBLIC_APP_ENV;
      } else {
        process.env.EXPO_PUBLIC_APP_ENV = prevAppEnv;
      }
    }
  });
});
