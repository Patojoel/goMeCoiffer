import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../shared/infrastructure/config/app-config.module.js';
import { ACTOR_RIGHTS } from '../../../shared/application/ports.js';
import { AcceptInvitationHandler } from '../application/commands/accept-invitation/accept-invitation.handler.js';
import { AdjustRolePermissionsHandler } from '../application/commands/adjust-role-permissions/adjust-role-permissions.handler.js';
import { CreateOrganizationHandler } from '../application/commands/create-organization/create-organization.handler.js';
import { CancelInvitationHandler } from '../application/commands/cancel-invitation/cancel-invitation.handler.js';
import { InitializeSalonRolesHandler } from '../application/commands/initialize-salon-roles/initialize-salon-roles.handler.js';
import { InviteCollaboratorHandler } from '../application/commands/invite-collaborator/invite-collaborator.handler.js';
import { PurgeEndedInvitationsHandler } from '../application/commands/purge-ended-invitations/purge-ended-invitations.handler.js';
import { GetSalonRolesHandler } from '../application/queries/get-salon-roles/get-salon-roles.handler.js';
import { ListSalonInvitationsHandler } from '../application/queries/list-salon-invitations/list-salon-invitations.handler.js';
import { ListInvitationsForProvenPhoneHandler } from '../application/queries/list-invitations-for-proven-phone/list-invitations-for-proven-phone.handler.js';
import { SelectActiveSalonHandler } from '../application/commands/select-active-salon/select-active-salon.handler.js';
import { SqlActorRights } from '../application/read-repositories/sql-actor-rights.js';
import { SqlInvitationChecks } from '../application/read-repositories/sql-invitation-checks.js';
import { SqlOwnerCandidates } from '../application/read-repositories/sql-owner-candidates.js';
import { SqlSalonRolePermissions } from '../application/read-repositories/sql-salon-role-permissions.js';
import { WhenSalonRegistered } from '../application/subscribers/when-salon-registered.js';
import { INVITATION_NOTIFIER } from '../domain/ports/invitation-notifier.port.js';
import { INVITATION_CHECKS } from '../domain/repositories/read/invitation-checks.read-repository.js';
import { OWNER_CANDIDATES } from '../domain/repositories/read/owner-candidates.read-repository.js';
import { SALON_ROLE_PERMISSIONS } from '../domain/repositories/read/salon-role-permissions.read-repository.js';
import { INVITATION_REPOSITORY } from '../domain/repositories/write/invitation.repository.js';
import { ORGANIZATION_REPOSITORY } from '../domain/repositories/write/organization.repository.js';
import { ROLE_PERMISSIONS_REPOSITORY } from '../domain/repositories/write/role-permissions.repository.js';
import { SALON_MEMBERSHIP_REPOSITORY } from '../domain/repositories/write/salon-membership.repository.js';
import { SALON_REPOSITORY } from '../domain/repositories/write/salon.repository.js';
import { RoleGrantPolicy } from '../domain/services/role-grant-policy.js';
import { ActiveSalonController } from './http/active-salon.controller.js';
import { ActiveSalonResponder } from './http/active-salon.responder.js';
import { InvitationAcceptanceController } from './http/invitation-acceptance.controller.js';
import { InvitationAcceptanceResponder } from './http/invitation-acceptance.responder.js';
import { InvitationsController } from './http/invitations.controller.js';
import { OrganizationsController } from './http/organizations.controller.js';
import { OwnerSessionResponder } from './http/owner-session.responder.js';
import { SalonRolesController } from './http/salon-roles.controller.js';
import { TypeOrmInvitationRepository } from './persistence/typeorm-repositories/typeorm-invitation.repository.js';
import { TypeOrmOrganizationRepository } from './persistence/typeorm-repositories/typeorm-organization.repository.js';
import { TypeOrmRolePermissionsRepository } from './persistence/typeorm-repositories/typeorm-role-permissions.repository.js';
import { TypeOrmSalonMembershipRepository } from './persistence/typeorm-repositories/typeorm-salon-membership.repository.js';
import { TypeOrmSalonRepository } from './persistence/typeorm-repositories/typeorm-salon.repository.js';
import { PurgeEndedInvitationsTask } from './scheduling/purge-ended-invitations.task.js';
import { SALON_ADDITION_CONTROLLERS, SALON_ADDITION_PROVIDERS } from './salons.providers.js';
import { LoggingInvitationNotifier } from './sms/logging-invitation-notifier.js';
import { TEAM_MANAGEMENT_CONTROLLERS, TEAM_MANAGEMENT_PROVIDERS } from './team.providers.js';

/**
 * Organisations, salons et appartenances. Fournit au socle les droits de l'acteur (`ACTOR_RIGHTS`) : le socle ne
 * dépend d'aucun module, c'est le module qui se lie à son token, et `AppModule` l'importe.
 */
@Module({
  controllers: [
    OrganizationsController,
    ActiveSalonController,
    InvitationsController,
    InvitationAcceptanceController,
    SalonRolesController,
    ...SALON_ADDITION_CONTROLLERS,
    ...TEAM_MANAGEMENT_CONTROLLERS,
  ],
  providers: [
    ...SALON_ADDITION_PROVIDERS,
    ...TEAM_MANAGEMENT_PROVIDERS,
    CreateOrganizationHandler,
    SelectActiveSalonHandler,
    InviteCollaboratorHandler,
    CancelInvitationHandler,
    AcceptInvitationHandler,
    AdjustRolePermissionsHandler,
    InitializeSalonRolesHandler,
    GetSalonRolesHandler,
    ListSalonInvitationsHandler,
    ListInvitationsForProvenPhoneHandler,
    PurgeEndedInvitationsHandler,
    PurgeEndedInvitationsTask,
    WhenSalonRegistered,
    { provide: RoleGrantPolicy, useFactory: () => new RoleGrantPolicy() },
    ActiveSalonResponder,
    InvitationAcceptanceResponder,
    OwnerSessionResponder,
    { provide: ORGANIZATION_REPOSITORY, useClass: TypeOrmOrganizationRepository },
    { provide: SALON_REPOSITORY, useClass: TypeOrmSalonRepository },
    { provide: SALON_MEMBERSHIP_REPOSITORY, useClass: TypeOrmSalonMembershipRepository },
    { provide: INVITATION_REPOSITORY, useClass: TypeOrmInvitationRepository },
    { provide: ROLE_PERMISSIONS_REPOSITORY, useClass: TypeOrmRolePermissionsRepository },
    { provide: OWNER_CANDIDATES, useClass: SqlOwnerCandidates },
    { provide: INVITATION_CHECKS, useClass: SqlInvitationChecks },
    { provide: SALON_ROLE_PERMISSIONS, useClass: SqlSalonRolePermissions },
    {
      provide: INVITATION_NOTIFIER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        if (config.SMS_PROVIDER === 'fake') return new LoggingInvitationNotifier();
        throw new Error(
          `Fournisseur SMS « ${config.SMS_PROVIDER} » non encore branché : voir docs/BACKLOG.md.`,
        );
      },
    },
    { provide: ACTOR_RIGHTS, useClass: SqlActorRights },
  ],
  exports: [ACTOR_RIGHTS],
})
export class OrganizationsModule {}
