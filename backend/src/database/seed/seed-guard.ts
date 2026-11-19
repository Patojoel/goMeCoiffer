import type { AppConfig } from '../../shared/infrastructure/config/app-config.module.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/** Nom de la première condition qui interdit le seed (jamais une valeur de configuration), ou `null` s'il peut tourner. */
export function seedRefusal(
  config: Pick<AppConfig, 'APP_ENV' | 'NODE_ENV' | 'DB_SSL' | 'DB_HOST'>,
): string | null {
  if (!['local', 'test'].includes(config.APP_ENV)) return 'APP_ENV';
  if (config.NODE_ENV === 'production') return 'NODE_ENV';
  if (config.DB_SSL) return 'DB_SSL';
  if (!LOCAL_HOSTS.includes(config.DB_HOST)) return 'DB_HOST';
  return null;
}
