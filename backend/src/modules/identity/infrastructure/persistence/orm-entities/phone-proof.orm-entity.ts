import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';

@Entity('phone_proofs')
export class PhoneProofOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') tokenHash!: string;
  @Column('text') phone!: string;
  @Column('text') purpose!: OtpPurpose;
  @Column('timestamptz') provenAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
}
