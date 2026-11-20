import { Query } from '@nestjs/cqrs';
import type { SalonRolesReadModel } from './get-salon-roles.read-model.js';

export class GetSalonRoles extends Query<SalonRolesReadModel> {
  constructor(readonly salonId: string) {
    super();
  }
}

