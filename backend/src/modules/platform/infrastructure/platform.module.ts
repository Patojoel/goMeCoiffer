import { Module } from '@nestjs/common';
import { BootstrapSuperAdminHandler } from '../application/commands/bootstrap-super-admin/bootstrap-super-admin.handler.js';
import { GrantSystemRoleHandler } from '../application/commands/grant-system-role/grant-system-role.handler.js';
import { RevokeSystemRoleHandler } from '../application/commands/revoke-system-role/revoke-system-role.handler.js';
import { ListPlatformAdminsHandler } from '../application/queries/list-platform-admins/list-platform-admins.handler.js';
import { PLATFORM_ADMIN_REPOSITORY } from '../domain/repositories/write/platform-admin.repository.js';
import { ParseSystemRolePipe } from './http/pipes/parse-system-role.pipe.js';
import { PlatformRolesController } from './http/platform-roles.controller.js';
import { TypeOrmPlatformAdminRepository } from './persistence/typeorm-repositories/typeorm-platform-admin.repository.js';

/** Administration plateforme GoMeCoiffer : rôles système séparés des rôles salon (UC-012, PRD §4, D-058). */
@Module({
  controllers: [PlatformRolesController],
  providers: [
    GrantSystemRoleHandler,
    RevokeSystemRoleHandler,
    BootstrapSuperAdminHandler,
    ListPlatformAdminsHandler,
    ParseSystemRolePipe,
    { provide: PLATFORM_ADMIN_REPOSITORY, useClass: TypeOrmPlatformAdminRepository },
  ],
})
export class PlatformModule {}
