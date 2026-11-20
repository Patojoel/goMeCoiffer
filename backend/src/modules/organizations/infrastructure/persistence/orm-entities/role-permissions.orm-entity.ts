import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('salon_role_permissions')
export class RolePermissionsOrmEntity {
  @PrimaryColumn('uuid') salonId!: string;
  @PrimaryColumn('text') role!: string;
  @Column('text', { array: true }) permissions!: string[];
  @Column('integer') version!: number;
  @Column('timestamptz') updatedAt!: Date;
  @Column('uuid', { nullable: true }) updatedBy!: string | null;
}

