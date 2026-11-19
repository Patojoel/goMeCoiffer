import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { CITIES, type City } from '../enums/city.enum.js';
import { PublicationStatus } from '../enums/publication-status.enum.js';
import { SalonType } from '../enums/salon-type.enum.js';
import { SalonRegistered } from '../events/salon-registered.js';
import { District } from '../value-objects/district.js';
import { Landmark } from '../value-objects/landmark.js';
import { SalonName } from '../value-objects/salon-name.js';

export const DEFAULT_TIMEZONE = 'Africa/Douala';

interface SalonState {
  id: string;
  organizationId: string;
  name: string;
  type: SalonType;
  city: City;
  district: string;
  landmark: string;
  /** Numéro public du salon, normalisé +237… ; non vérifié par SMS. */
  phone: string;
  /** Fuseau IANA dans lequel se calculent les créneaux du salon. */
  timezone: string;
  publicationStatus: PublicationStatus;
  createdAt: Date;
  version: number;
}

export interface SalonDetails {
  readonly name: string;
  readonly type: string;
  readonly city: string;
  readonly district: string;
  readonly landmark: string;
  readonly phone: string;
}

const oneOf = <T extends string>(allowed: readonly T[], raw: string, message: string): T => {
  const found = allowed.find((value) => value === raw);
  if (!found) throw new InvalidValueError(message);
  return found;
};

export class Salon extends AggregateRoot {
  private constructor(private readonly state: SalonState) {
    super();
  }

  /** Salon vide et non publié ; rien n'est repris d'un autre salon. */
  static register(input: { id: string; organizationId: string; details: SalonDetails; now: Date }): Salon {
    const { details } = input;
    const salon = new Salon({
      id: input.id,
      organizationId: input.organizationId,
      name: SalonName.create(details.name).value,
      type: oneOf(
        Object.values(SalonType),
        details.type,
        'Choisissez le type de votre salon : salon de coiffure, barber shop, esthétique ou mixte.',
      ),
      city: oneOf(CITIES, details.city, 'Choisissez votre ville dans la liste.'),
      district: District.create(details.district).value,
      landmark: Landmark.create(details.landmark).value,
      phone: PhoneNumber.parse(details.phone).value,
      timezone: DEFAULT_TIMEZONE,
      publicationStatus: PublicationStatus.NOT_PUBLISHED,
      createdAt: input.now,
      version: 0,
    });
    salon.record(new SalonRegistered(input.id, input.organizationId, input.now));
    return salon;
  }

  static restore(state: Readonly<SalonState>): Salon {
    return new Salon({ ...state });
  }

  get name(): string {
    return this.state.name;
  }

  snapshot(): Readonly<SalonState> {
    return { ...this.state };
  }
}
