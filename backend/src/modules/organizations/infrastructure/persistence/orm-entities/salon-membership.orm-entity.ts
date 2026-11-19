import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('salon_memberships')
export class SalonMembershipOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') salonId!: string;
  @Column('uuid') userId!: string;
  @Column('text') role!: string;
  @Column('text') status!: string;
  @Column('timestamptz') grantedAt!: Date;
  @Column('integer') version!: number;
}
