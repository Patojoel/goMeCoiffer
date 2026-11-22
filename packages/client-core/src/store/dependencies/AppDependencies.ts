import type { AuthGateway } from '../../modules/auth/models/gateway/AuthGateway.js';
import type { ClientSpaceGateway } from '../../modules/client-space/models/gateway/ClientSpaceGateway.js';
import type { HealthGateway } from '../../modules/health/models/gateway/HealthGateway.js';
import type { JoinSalonGateway } from '../../modules/join-salon/models/gateway/JoinSalonGateway.js';
import type { PlatformGateway } from '../../modules/platform/models/gateway/PlatformGateway.js';
import type { RolesGateway } from '../../modules/roles/models/gateway/RolesGateway.js';
import type { SalonsGateway } from '../../modules/salons/models/gateway/SalonsGateway.js';
import type { TeamGateway } from '../../modules/team/models/gateway/TeamGateway.js';

export type AppDependencies = {
  readonly health: HealthGateway;
  readonly auth: AuthGateway;
  readonly salons: SalonsGateway;
  readonly team: TeamGateway;
  readonly joinSalon: JoinSalonGateway;
  readonly roles: RolesGateway;
  readonly clientSpace: ClientSpaceGateway;
  readonly platform: PlatformGateway;
};
