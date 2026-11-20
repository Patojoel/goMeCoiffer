import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('platform_admin_roles')
export class PlatformAdminRoleOrmEntity {
  @PrimaryColumn('uuid') userId!: string;
  @PrimaryColumn('text') role!: string;
  @Column('timestamptz') grantedAt!: Date;
  @Column('uuid', { nullable: true }) grantedByUserId!: string | null;
}

