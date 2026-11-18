import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import type { OtpStatus } from '../../../domain/enums/otp-status.enum.js';

@Entity('otp_challenges')
export class OtpChallengeOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') phone!: string;
  @Column('text') purpose!: OtpPurpose;
  @Column('text') codeHash!: string;
  @Column('text') status!: OtpStatus;
  @Column('timestamptz') sentAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('integer') attempts!: number;
  @Column('timestamptz', { nullable: true }) consumedAt!: Date | null;
  @Column('integer') version!: number;
}
