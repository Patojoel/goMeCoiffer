import type { AppDependencies, HttpClient } from '@gomecoiffer/client-core';
import {
  AuthHttpGateway,
  ClientSpaceHttpGateway,
  HealthHttpGateway,
  JoinSalonHttpGateway,
  PlatformHttpGateway,
  RolesHttpGateway,
  SalonsHttpGateway,
  TeamHttpGateway,
} from '@gomecoiffer/client-core/gateways';

/** Seul fichier de mobile/ autorisé à importer @gomecoiffer/client-core/gateways. */
export const createDependencies = (http: HttpClient): AppDependencies => ({
  health: new HealthHttpGateway(http),
  auth: new AuthHttpGateway(http),
  salons: new SalonsHttpGateway(http),
  team: new TeamHttpGateway(http),
  joinSalon: new JoinSalonHttpGateway(http),
  roles: new RolesHttpGateway(http),
  clientSpace: new ClientSpaceHttpGateway(http),
  platform: new PlatformHttpGateway(http),
});
