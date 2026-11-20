import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('salon_invitations')
export class InvitationOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') salonId!: string;
  @Column('text', { nullable: true }) name!: string | null;
  @Column('text', { nullable: true }) phone!: string | null;
  @Column('text') role!: string;
  @Column('uuid') invitedByUserId!: string;
  @Column('timestamptz') sentAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('text') status!: string;
  @Column('timestamptz', { nullable: true }) endedAt!: Date | null;
  @Column('uuid', { nullable: true }) acceptedByUserId!: string | null;
  @Column('boolean') notifiedBySms!: boolean;
  @Column('integer') version!: number;
}
