import type { SalonRoleContract, SalonTeamMember } from '@gomecoiffer/contracts';

export type SalonTeamMemberReadModel = Readonly<Omit<SalonTeamMember, 'role'> & { role: SalonRoleContract }>;

export interface SalonTeamReadModel {
  readonly members: readonly SalonTeamMemberReadModel[];
}
