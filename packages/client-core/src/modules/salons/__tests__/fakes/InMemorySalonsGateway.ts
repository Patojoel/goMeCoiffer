import type {
  ActiveSalonSelected,
  AddSalonToOrganization,
  CreateOrganization,
  OrganizationCreated,
  SalonAdded,
  SelectActiveSalon,
  SessionSummary,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { SalonsGateway } from '../../models/gateway/SalonsGateway.js';

export class InMemorySalonsGateway implements SalonsGateway {
  public nextError: Error | null = null;
  public currentSession: SessionSummary;

  constructor(initialSession?: SessionSummary) {
    this.currentSession = initialSession ?? {
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: null,
      salons: [],
      permissions: [],
      systemRoles: [],
      nextStep: 'CREATE_ORGANIZATION',
    };
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async createOrganization(input: CreateOrganization): Promise<OrganizationCreated> {
    this.assertHealthy();
    const organizationId = '0195f000-0000-7000-8000-000000000c01';
    const salonId = '0195f000-0000-7000-8000-000000000b10';
    const nextSession: SessionSummary = {
      ...this.currentSession,
      activeSalonId: salonId,
      salons: [
        ...this.currentSession.salons,
        { id: salonId, name: input.name, role: 'OWNER', city: input.city, district: input.district },
      ],
      permissions: [
        'dashboard:view',
        'bookings:view-own',
        'bookings:view-all',
        'bookings:manage',
        'staff:view',
        'staff:invite',
        'staff:manage',
        'salon-settings:view',
        'salon-settings:edit',
        'roles:administer',
      ],
      nextStep: 'OPEN_SALON',
    };
    this.currentSession = nextSession;
    return {
      organizationId,
      salonId,
      csrfToken: 'csrf-org-created',
      session: nextSession,
    };
  }

  async addSalon(input: AddSalonToOrganization): Promise<SalonAdded> {
    this.assertHealthy();
    const duplicate = this.currentSession.salons.some(
      (s) => s.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
    if (duplicate) {
      throw new HttpError(409, 'SALON_NAME_ALREADY_USED', 'Un salon de ce nom existe déjà dans votre organisation.');
    }
    const salonId = '0195f000-0000-7000-8000-000000000b11';
    const nextSession: SessionSummary = {
      ...this.currentSession,
      activeSalonId: salonId,
      salons: [
        ...this.currentSession.salons,
        { id: salonId, name: input.name, role: 'OWNER', city: input.city, district: input.district },
      ],
      nextStep: 'OPEN_SALON',
    };
    this.currentSession = nextSession;
    return {
      organizationId: '0195f000-0000-7000-8000-000000000c01',
      salonId,
      csrfToken: 'csrf-salon-added',
      session: nextSession,
    };
  }

  async selectActiveSalon(input: SelectActiveSalon): Promise<ActiveSalonSelected> {
    this.assertHealthy();
    const found = this.currentSession.salons.find((s) => s.id === input.salonId);
    if (!found) {
      throw new HttpError(404, 'NOT_FOUND', 'Salon introuvable.');
    }
    const nextSession: SessionSummary = {
      ...this.currentSession,
      activeSalonId: found.id,
      nextStep: 'OPEN_SALON',
    };
    this.currentSession = nextSession;
    return { csrfToken: 'csrf-salon-selected', session: nextSession };
  }
}
