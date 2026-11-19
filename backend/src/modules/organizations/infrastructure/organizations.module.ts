import { Module } from '@nestjs/common';
import { ACTOR_RIGHTS } from '../../../shared/application/ports.js';
import { CreateOrganizationHandler } from '../application/commands/create-organization/create-organization.handler.js';
import { SelectActiveSalonHandler } from '../application/commands/select-active-salon/select-active-salon.handler.js';
import { SqlActorRights } from '../application/read-repositories/sql-actor-rights.js';
import { SqlOwnerCandidates } from '../application/read-repositories/sql-owner-candidates.js';
import { OWNER_CANDIDATES } from '../domain/repositories/read/owner-candidates.read-repository.js';
import { ORGANIZATION_REPOSITORY } from '../domain/repositories/write/organization.repository.js';
import { SALON_MEMBERSHIP_REPOSITORY } from '../domain/repositories/write/salon-membership.repository.js';
import { SALON_REPOSITORY } from '../domain/repositories/write/salon.repository.js';
import { ActiveSalonController } from './http/active-salon.controller.js';
import { ActiveSalonResponder } from './http/active-salon.responder.js';
import { OrganizationsController } from './http/organizations.controller.js';
import { OwnerSessionResponder } from './http/owner-session.responder.js';
import { TypeOrmOrganizationRepository } from './persistence/typeorm-repositories/typeorm-organization.repository.js';
import { TypeOrmSalonMembershipRepository } from './persistence/typeorm-repositories/typeorm-salon-membership.repository.js';
import { TypeOrmSalonRepository } from './persistence/typeorm-repositories/typeorm-salon.repository.js';

/**
 * Organisations, salons et appartenances. Fournit au socle les droits de l'acteur (`ACTOR_RIGHTS`) : le socle ne
 * dépend d'aucun module, c'est le module qui se lie à son token, et `AppModule` l'importe.
 */
@Module({
  controllers: [OrganizationsController, ActiveSalonController],
  providers: [
    CreateOrganizationHandler,
    SelectActiveSalonHandler,
    ActiveSalonResponder,
    OwnerSessionResponder,
    { provide: ORGANIZATION_REPOSITORY, useClass: TypeOrmOrganizationRepository },
    { provide: SALON_REPOSITORY, useClass: TypeOrmSalonRepository },
    { provide: SALON_MEMBERSHIP_REPOSITORY, useClass: TypeOrmSalonMembershipRepository },
    { provide: OWNER_CANDIDATES, useClass: SqlOwnerCandidates },
    { provide: ACTOR_RIGHTS, useClass: SqlActorRights },
  ],
  exports: [ACTOR_RIGHTS],
})
export class OrganizationsModule {}
