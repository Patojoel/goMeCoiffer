import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') phone!: string;
  @Column('text', { nullable: true }) name!: string | null;
  @Column('text', { nullable: true }) email!: string | null;
  @Column('text', { nullable: true }) passwordHash!: string | null;
  @Column('timestamptz', { nullable: true }) phoneVerifiedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) termsAcceptedAt!: Date | null;
  @Column('timestamptz') createdAt!: Date;
  @Column('timestamptz', { default: () => 'now()' }) updatedAt!: Date;
  @Column('integer') version!: number;
}
