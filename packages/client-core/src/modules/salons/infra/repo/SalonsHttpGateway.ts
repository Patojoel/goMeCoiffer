import {
  ActiveSalonSelectedSchema,
  OrganizationCreatedSchema,
  SalonAddedSchema,
  type ActiveSalonSelected,
  type AddSalonToOrganization,
  type CreateOrganization,
  type OrganizationCreated,
  type SalonAdded,
  type SelectActiveSalon,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { SalonsGateway } from '../../models/gateway/SalonsGateway.js';
import { SALONS_API_ROUTES } from '../api-routes/SalonsApiRoutes.js';

export class SalonsHttpGateway implements SalonsGateway {
  constructor(private readonly http: HttpClient) {}

  createOrganization(input: CreateOrganization): Promise<OrganizationCreated> {
    return this.http.post(SALONS_API_ROUTES.createOrganization, input, OrganizationCreatedSchema);
  }

  addSalon(input: AddSalonToOrganization): Promise<SalonAdded> {
    return this.http.post(SALONS_API_ROUTES.addSalon, input, SalonAddedSchema);
  }

  selectActiveSalon(input: SelectActiveSalon): Promise<ActiveSalonSelected> {
    return this.http.post(SALONS_API_ROUTES.selectActiveSalon, input, ActiveSalonSelectedSchema);
  }
}
