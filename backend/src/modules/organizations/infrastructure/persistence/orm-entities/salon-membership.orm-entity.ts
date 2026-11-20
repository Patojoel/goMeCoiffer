import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('salon_memberships')
export class SalonMembershipOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') salonId!: string;
  @Column('uuid') userId!: string;
  @Column('text') role!: string;
  @Column('text') status!: string;
  @Column('timestamptz') grantedAt!: Date;
  @Column('timestamptz', { nullable: true }) revokedAt!: Date | null;
  @Column('uuid', { nullable: true }) revokedByUserId!: string | null;
  @Column('timestamptz', { nullable: true }) reinstatedAt!: Date | null;
  @Column('integer') version!: number;
}
