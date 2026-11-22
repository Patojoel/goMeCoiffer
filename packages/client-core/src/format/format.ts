const xaf = new Intl.NumberFormat('fr-CM', {
  style: 'currency',
  currency: 'XAF',
  maximumFractionDigits: 0,
});

/** Montant en FCFA entiers (jamais de décimale). */
export const formatXaf = (amount: number): string => xaf.format(amount);

/** Heure `HH:mm` d'un instant ISO dans le fuseau IANA du salon. */
export const formatTimeInZone = (isoInstant: string, timeZone = 'Africa/Douala'): string =>
  new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(isoInstant));

/** Date courte lisible en français dans le fuseau du salon (ex. `21 nov. 2026`). */
export const formatDateFr = (isoInstant: string, timeZone = 'Africa/Douala'): string =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(isoInstant));

/** Date et heure lisibles en français dans le fuseau du salon (ex. `21 nov. 2026 à 00:30`). */
export const formatDateTimeInZone = (isoInstant: string, timeZone = 'Africa/Douala'): string =>
  `${formatDateFr(isoInstant, timeZone)} à ${formatTimeInZone(isoInstant, timeZone)}`;

export type IsoDateParts = { readonly year: number; readonly month: number; readonly day: number };

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDateParts(value: string): IsoDateParts | null {
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export const toIsoDateString = ({ year, month, day }: IsoDateParts): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function formatIsoDateToDisplayFr(value: string): string {
  const parts = parseIsoDateParts(value);
  if (!parts) return value;
  const utcMidday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcMidday);
}

export function normalizeCameroonPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s.-]/g, '');
  const local = compact.startsWith('+237')
    ? compact.slice(4)
    : compact.startsWith('237')
      ? compact.slice(3)
      : compact;
  return /^[62]\d{8}$/.test(local) ? `+237${local}` : null;
}

export function formatCameroonPhone(raw: string): string {
  const normalized = normalizeCameroonPhone(raw);
  if (!normalized) return raw.trim();
  const local = normalized.slice(4);
  return `${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}
