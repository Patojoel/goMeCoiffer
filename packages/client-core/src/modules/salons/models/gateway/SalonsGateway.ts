import type {
  ActiveSalonSelected,
  AddSalonToOrganization,
  CreateOrganization,
  OrganizationCreated,
  SalonAdded,
  SelectActiveSalon,
} from '@gomecoiffer/contracts';

export interface SalonsGateway {
  createOrganization(input: CreateOrganization): Promise<OrganizationCreated>;
  addSalon(input: AddSalonToOrganization): Promise<SalonAdded>;
  selectActiveSalon(input: SelectActiveSalon): Promise<ActiveSalonSelected>;
}
