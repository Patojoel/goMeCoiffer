import type { DataSource } from 'typeorm';
import { ADJUSTABLE_SALON_ROLES } from '../../modules/organizations/domain/enums/permission.enum.js';
import { defaultPermissionsOf } from '../../modules/organizations/domain/value-objects/role-permission-set.js';
import { DEMO_USERS } from './identity.seed.js';
import type { Seeder } from './seeder.js';

const [MIREILLE, PAUL, CLARISSE, AWA] = DEMO_USERS;

const AKWA_TEAM = [
  { id: '0195f000-0000-7000-8000-000000000a11', phone: '+237694556677', name: 'Rodrigue Etoa', role: 'SALON_ADMIN' },
  { id: '0195f000-0000-7000-8000-000000000a12', phone: '+237675403020', name: 'Hortense Mballa', role: 'FINANCE_MANAGER' },
  { id: '0195f000-0000-7000-8000-000000000a13', phone: '+237670112234', name: 'Grâce Mbarga', role: 'PRACTITIONER' },
] as const;

interface DemoSalon {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly district: string;
  readonly landmark: string;
  readonly phone: string;
}

const AKWA: DemoSalon = {
  id: '0195f000-0000-7000-8000-000000000b02',
  name: 'Go Beauty Akwa',
  city: 'Douala',
  district: 'Akwa',
  landmark: 'Rue Joffre, face à la pharmacie du Centre',
  phone: '+237699887766',
};
const BASTOS: DemoSalon = {
  id: '0195f000-0000-7000-8000-000000000b12',
  name: 'Go Beauty Bastos',
  city: 'Yaoundé',
  district: 'Bastos',
  landmark: 'Près de l’ambassade de France',
  phone: '+237699887767',
};
const ELEGANCE: DemoSalon = {
  id: '0195f000-0000-7000-8000-000000000b22',
  name: 'Élégance Bonamoussadi',
  city: 'Douala',
  district: 'Bonamoussadi',
  landmark: 'Carrefour Shell, derrière la station',
  phone: '+237655443323',
};

/**
 * Organisations de démo, avec les salons et appartenances du contexte de UC-005. Mireille : « Go Beauty Akwa » et
 * « Go Beauty Bastos » (propriétaire des deux : elle choisit son salon). Clarisse : « Élégance Bonamoussadi », où Paul
 * est Coiffeur. Awa : Coiffeur de « Go Beauty Akwa ». Paul n'a volontairement aucune organisation : il déroule UC-004
 * en local. Clés d'idempotence : le propriétaire de l'organisation, l'identifiant du salon, le couple (salon, utilisateur).
 * Le 2e salon de Mireille est inséré directement tant que « ajouter un salon à son organisation » (UC-010) n'existe pas.
 */
export const organizationsSeeder: Seeder = {
  name: 'organizations',
  async run(dataSource: DataSource) {
    await dataSource.transaction(async (tx) => {
      const organization = (id: string, name: string, ownerPhone: string) =>
        tx.query(
          `INSERT INTO organizations (id, owner_user_id, name, created_at, version)
           SELECT $1, u.id, $2, now(), 1 FROM users u WHERE u.phone = $3
           ON CONFLICT (owner_user_id) DO NOTHING`,
          [id, name, ownerPhone],
        );
      const salon = (s: DemoSalon, ownerPhone: string) =>
        tx.query(
          `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
           SELECT $1, o.id, $2, 'MIXED', $3, $4, $5, $6, now(), 1
           FROM organizations o JOIN users u ON u.id = o.owner_user_id WHERE u.phone = $7
           ON CONFLICT (id) DO NOTHING`,
          [s.id, s.name, s.city, s.district, s.landmark, s.phone, ownerPhone],
        );
      const membership = (id: string, salonId: string, userPhone: string, role: string) =>
        tx.query(
          `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
           SELECT $1, s.id, u.id, $4, 'ACTIVE', now(), 1
           FROM salons s, users u WHERE s.id = $2 AND u.phone = $3
           ON CONFLICT (salon_id, user_id) DO NOTHING`,
          [id, salonId, userPhone, role],
        );

      /** Invitations de Mireille dans Akwa : deux en attente (envoyées hier) et une expirée (envoyée il y a 10 jours). */
      const invitation = (id: string, salonId: string, name: string, phone: string, role: string, sentDaysAgo: number, status: string) =>
        tx.query(
          `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, ended_at, notified_by_sms, version)
           SELECT $1, $2, $3, $4, $5, u.id, now() - make_interval(days => $6::int), now() - make_interval(days => $6::int) + interval '7 days', $7,
                  CASE WHEN $7 = 'EXPIRED' THEN now() - make_interval(days => $6::int) + interval '7 days' END, true, 1
           FROM users u WHERE u.phone = $8
           ON CONFLICT DO NOTHING`,
          [id, salonId, name, phone, role, sentDaysAgo, status, MIREILLE.phone],
        );

      await organization('0195f000-0000-7000-8000-000000000b01', AKWA.name, MIREILLE.phone);
      await salon(AKWA, MIREILLE.phone);
      await salon(BASTOS, MIREILLE.phone);
      await organization('0195f000-0000-7000-8000-000000000b21', ELEGANCE.name, CLARISSE.phone);
      await salon(ELEGANCE, CLARISSE.phone);

      await membership('0195f000-0000-7000-8000-000000000b03', AKWA.id, MIREILLE.phone, 'OWNER');
      await membership('0195f000-0000-7000-8000-000000000b13', BASTOS.id, MIREILLE.phone, 'OWNER');
      await membership('0195f000-0000-7000-8000-000000000b23', ELEGANCE.id, CLARISSE.phone, 'OWNER');
      await membership('0195f000-0000-7000-8000-000000000b24', ELEGANCE.id, PAUL.phone, 'HAIRDRESSER');
      await membership('0195f000-0000-7000-8000-000000000b04', AKWA.id, AWA.phone, 'HAIRDRESSER');

      /** UC-008 : un membre de démo par rôle dans Akwa (en plus de Mireille et Awa) et Rodrigue dans Bastos. */
      for (const member of AKWA_TEAM) {
        await tx.query(
          `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
           SELECT $1, $2, $3, u.password_hash, now(), now(), now(), now(), 1
           FROM users u WHERE u.phone = $4
           ON CONFLICT (phone) DO NOTHING`,
          [member.id, member.phone, member.name, MIREILLE.phone],
        );
      }
      await membership('0195f000-0000-7000-8000-000000000b05', AKWA.id, AKWA_TEAM[0].phone, 'SALON_ADMIN');
      await membership('0195f000-0000-7000-8000-000000000b15', BASTOS.id, AKWA_TEAM[0].phone, 'SALON_ADMIN');
      await membership('0195f000-0000-7000-8000-000000000b06', AKWA.id, AKWA_TEAM[1].phone, 'FINANCE_MANAGER');
      await membership('0195f000-0000-7000-8000-000000000b07', AKWA.id, AKWA_TEAM[2].phone, 'PRACTITIONER');

      /** UC-008 : réglages par défaut des salons de démo, plus Finances : consulter pour l'Administrateur d'Akwa. */
      for (const demoSalon of [AKWA, BASTOS, ELEGANCE]) {
        for (const role of ADJUSTABLE_SALON_ROLES) {
          const permissions =
            demoSalon.id === AKWA.id && role === 'SALON_ADMIN'
              ? [...defaultPermissionsOf(role), 'finances:view']
              : [...defaultPermissionsOf(role)];
          await tx.query(
            `INSERT INTO salon_role_permissions (salon_id, role, permissions, version, updated_at, updated_by)
             VALUES ($1, $2, $3, 1, now(), NULL)
             ON CONFLICT (salon_id, role) DO NOTHING`,
            [demoSalon.id, role, permissions],
          );
        }
      }

      await invitation('0195f000-0000-7000-8000-000000000b31', AKWA.id, 'Brice Nana', '+237655443322', 'HAIRDRESSER', 1, 'PENDING');
      // UC-007 : 6 70 00 00 02 n'a aucun compte (parcours « créer mon compte ») ; 6 55 44 33 22, ci-dessus, est celui de Clarisse (un clic).
      await invitation('0195f000-0000-7000-8000-000000000b33', AKWA.id, 'Brice Nana', '+237670000002', 'HAIRDRESSER', 1, 'PENDING');
      await invitation('0195f000-0000-7000-8000-000000000b32', AKWA.id, 'Grâce Mbarga', '+237670112233', 'PRACTITIONER', 10, 'EXPIRED');
    });
  },
};
