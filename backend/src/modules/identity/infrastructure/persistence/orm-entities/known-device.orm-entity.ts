import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('known_devices')
export class KnownDeviceOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') userId!: string;
  @Column('text') tokenHash!: string;
  @Column('timestamptz') recognizedAt!: Date;
  @Column('timestamptz') lastUsedAt!: Date;
  @Column('timestamptz') expiresAt!: Date;
  @Column('integer') failedAttempts!: number;
  @Column('timestamptz', { nullable: true }) revokedAt!: Date | null;
  @Column('integer') version!: number;
}
