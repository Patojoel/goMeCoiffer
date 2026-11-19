import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sign_in_attempts')
export class SignInAttemptOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') phone!: string;
  @Column('text') networkAddress!: string;
  @Column('timestamptz') attemptedAt!: Date;
  @Column('boolean') succeeded!: boolean;
  @Column('boolean') fromKnownDevice!: boolean;
  @Column('boolean', { default: false }) passwordReset!: boolean;
}
