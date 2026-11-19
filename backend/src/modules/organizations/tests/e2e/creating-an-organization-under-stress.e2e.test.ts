import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUDIT_TRAIL, READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SqlOwnerCandidates } from '../../application/read-repositories/sql-owner-candidates.js';
import {
  OWNER_CANDIDATES,
  type OwnerCandidates,
} from '../../domain/repositories/read/owner-candidates.read-repository.js';
import { sessionCookieOf, StaffAccounts } from '../builders/staff-accounts.js';

const SALON = {
  name: 'Go Beauty Akwa',
  type: 'MIXED',
  city: 'Douala',
  district: 'Akwa',
  landmark: 'Rue Joffre, face à la pharmacie du Centre',
  phone: '6 99 88 77 66',
};
const CREATE = '/api/salon/organizations';

/** Fait attendre chaque demande, après sa lecture, que l'autre ait lu aussi : les deux voient « pas d'organisation ». */
class RaceGate implements OwnerCandidates {
  delegate!: OwnerCandidates;
  private arrived = 0;
  private release!: () => void;
  private readonly bothRead = new Promise<void>((resolve) => (this.release = resolve));

  async of(userId: string) {
    const candidate = await this.delegate.of(userId);
    this.arrived += 1;
    if (this.arrived >= 2) this.release();
    await Promise.race([this.bothRead, new Promise((resolve) => setTimeout(resolve, 3_000))]);
    return candidate;
  }
}

describe('Two creations of the same owner arriving at the same time', () => {
  let t: TestApp;
  let db: DataSource;

  const gate = new RaceGate();
  beforeAll(async () => {
    t = await startTestApp({ overrides: [[OWNER_CANDIDATES, gate]] });
    db = t.moduleRef.get(getDataSourceToken());
    gate.delegate = new SqlOwnerCandidates(t.moduleRef.get<SqlReader>(READ_DB));
  });
  afterAll(() => t.close());

  it('create one organization, one salon and one membership; the other request is refused with a conflict', async () => {
    const browser = t.browser();
    const { account } = await new StaffAccounts(db).signedIn(browser, 'Mireille Ndongo');

    const [a, b] = await Promise.all([browser.post(CREATE, SALON), browser.post(CREATE, SALON)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find((r) => r.status === 409)?.body.code).toBe('ORGANIZATION_ALREADY_EXISTS');
    const [{ organizations, salons, memberships }] = await db.query(
      `SELECT (SELECT count(*) FROM organizations WHERE owner_user_id = $1)::int AS organizations,
              (SELECT count(*) FROM salons s JOIN organizations o ON o.id = s.organization_id WHERE o.owner_user_id = $1)::int AS salons,
              (SELECT count(*) FROM salon_memberships WHERE user_id = $1)::int AS memberships`,
      [account.id],
    );
    expect({ organizations, salons, memberships }).toEqual({ organizations: 1, salons: 1, memberships: 1 });
  });
});

describe('A failure while recording the creation', () => {
  let t: TestApp;
  let db: DataSource;

  beforeAll(async () => {
    const failingAudit = {
      record: async (entry: { action: string }) => {
        if (entry.action === 'ORGANIZATION_FOUNDED') throw new Error('panne simulée');
      },
    };
    t = await startTestApp({ overrides: [[AUDIT_TRAIL, failingAudit]] });
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('leaves no organization, no salon, no membership and keeps the session as it was', async () => {
    const browser = t.browser();
    const { account, sid } = await new StaffAccounts(db).signedIn(browser, 'Mireille Ndongo');

    const res = await browser.post(CREATE, SALON);
    const summary = await browser.get('/api/salon/session');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(sessionCookieOf(res) ?? sid).toBe(sid);
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeSalonId).toBeNull();
    const [counts] = await db.query(
      `SELECT (SELECT count(*) FROM organizations WHERE owner_user_id = $1)::int AS organizations,
              (SELECT count(*) FROM salon_memberships WHERE user_id = $1)::int AS memberships,
              (SELECT count(*) FROM salons)::int AS salons`,
      [account.id],
    );
    expect(counts).toEqual({ organizations: 0, memberships: 0, salons: 0 });
  });
});
