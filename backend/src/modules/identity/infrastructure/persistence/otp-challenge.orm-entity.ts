import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { OtpPurpose } from '../../domain/otp-challenge.js';

@Entity('otp_challenges')
export class OtpChallengeOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') phone!: string;
  @Column('text') purpose!: OtpPurpose;
  @Column('text') codeHash!: string;
  @Column('text') status!: 'ACTIVE' | 'CONSUMED' | 'SUPERSEDED';
  @Column('timestamptz') sentAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('integer') attempts!: number;
  @Column('timestamptz', { nullable: true }) consumedAt!: Date | null;
  @Column('integer') version!: number;
}
