import type { HealthGateway } from '@/modules/health/models/gateway/HealthGateway';

/** Conteneur des gateways injectés (`extraArgument` des thunks, `extra` des `queryFn`). */
export type AppDependencies = {
  health: HealthGateway;
};
