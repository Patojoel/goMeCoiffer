import type { Provider, Type } from '@nestjs/common';
import { ChangeCollaboratorRoleHandler } from '../application/commands/change-collaborator-role/change-collaborator-role.handler.js';
import { RemoveCollaboratorHandler } from '../application/commands/remove-collaborator/remove-collaborator.handler.js';
import { ListSalonTeamHandler } from '../application/queries/list-salon-team/list-salon-team.handler.js';
import { TeamManagementPolicy } from '../domain/services/team-management-policy.js';
import { TeamController } from './http/team.controller.js';

/** Contrôleurs et providers de UC-011 (gestion de l'équipe du salon), réunis ici pour éviter les conflits de câblage. */
export const TEAM_MANAGEMENT_CONTROLLERS: Type[] = [TeamController];
export const TEAM_MANAGEMENT_PROVIDERS: Provider[] = [
  ChangeCollaboratorRoleHandler,
  RemoveCollaboratorHandler,
  ListSalonTeamHandler,
  { provide: TeamManagementPolicy, useFactory: () => new TeamManagementPolicy() },
];
