import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-010 : unicité du nom commercial d'un salon au sein de son organisation, insensible à la casse (D-035, D-056).
 * Deux organisations distinctes peuvent porter un salon du même nom.
 */
export class OrganizationsSalonUniqueName1795310000000 implements MigrationInterface {
  name = 'OrganizationsSalonUniqueName1795310000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE UNIQUE INDEX salons_organization_lower_name_key ON salons (organization_id, LOWER(name))`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX salons_organization_lower_name_key`);
  }
}

