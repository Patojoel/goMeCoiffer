import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('organizations')
export class OrganizationOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') ownerUserId!: string;
  @Column('text') name!: string;
  @Column('timestamptz') createdAt!: Date;
  @Column('integer') version!: number;
}
