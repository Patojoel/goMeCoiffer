import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

export interface WorldSalon {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly district: string;
}

/** Données du contexte de UC-005 insérées directement : organisation, salons et appartenances actives. */
export class SalonWorld {
  constructor(private readonly db: DataSource) {}

  /** Organisation d'un propriétaire, avec ses salons et son appartenance « Propriétaire » sur chacun (D-041). */
  async organizationOf(
    ownerId: string,
    salons: ReadonlyArray<Pick<WorldSalon, 'name' | 'city' | 'district'>>,
  ): Promise<WorldSalon[]> {
    const organizationId = randomUUID();
    await this.db.query(
      `INSERT INTO organizations (id, owner_user_id, name, created_at, version) VALUES ($1, $2, $3, now(), 1)`,
      [organizationId, ownerId, salons[0]!.name],
    );
    const created: WorldSalon[] = [];
    for (const salon of salons) {
      const id = randomUUID();
      await this.db.query(
        `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
         VALUES ($1, $2, $3, 'MIXED', $4, $5, 'Face au marché', '+237699887766', now(), 1)`,
        [id, organizationId, salon.name, salon.city, salon.district],
      );
      await this.membership(id, ownerId, 'OWNER');
      created.push({ id, ...salon });
    }
    return created;
  }

  async membership(salonId: string, userId: string, role: string): Promise<void> {
    await this.db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES ($1, $2, $3, $4, 'ACTIVE', now(), 1)`,
      [randomUUID(), salonId, userId, role],
    );
  }

  /** Retrait de l'appartenance simulé par la suppression de la ligne, tant que UC-008 n'existe pas. */
  async removeMembership(salonId: string, userId: string): Promise<void> {
    await this.db.query(`DELETE FROM salon_memberships WHERE salon_id = $1 AND user_id = $2`, [
      salonId,
      userId,
    ]);
  }
}
