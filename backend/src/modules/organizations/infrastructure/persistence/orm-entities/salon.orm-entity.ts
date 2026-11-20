import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('salons')
export class SalonOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') organizationId!: string;
  @Column('text') name!: string;
  @Column('text') type!: string;
  @Column('text') city!: string;
  @Column('text') district!: string;
  @Column('text') landmark!: string;
  @Column('text') phone!: string;
  @Column('text') timezone!: string;
  @Column('text') publicationStatus!: string;
  @Column('timestamptz') createdAt!: Date;
  @Column('integer') version!: number;
}
