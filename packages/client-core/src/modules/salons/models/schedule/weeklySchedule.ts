export const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type WeekDayKey = (typeof WEEK_DAYS)[number];

export const WEEK_DAY_LABELS: Readonly<Record<WeekDayKey, { readonly full: string; readonly short: string }>> = {
  MON: { full: 'Lundi', short: 'Lun.' },
  TUE: { full: 'Mardi', short: 'Mar.' },
  WED: { full: 'Mercredi', short: 'Mer.' },
  THU: { full: 'Jeudi', short: 'Jeu.' },
  FRI: { full: 'Vendredi', short: 'Ven.' },
  SAT: { full: 'Samedi', short: 'Sam.' },
  SUN: { full: 'Dimanche', short: 'Dim.' },
};

export type DaySchedule = {
  readonly day: WeekDayKey;
  readonly isOpen: boolean;
  readonly openTime: string;
  readonly closeTime: string;
  readonly breakStart: string | null;
  readonly breakEnd: string | null;
};

export type WeeklySchedule = readonly DaySchedule[];

export type ScheduleValidationError = {
  readonly day: WeekDayKey;
  readonly message: string;
};

/** Créneaux de 30 minutes de 06:00 à 23:30 pour sélecteurs d'horaires lisibles. */
export const TIME_SLOTS_30MIN: readonly string[] = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeString(value: string): boolean {
  return HHMM_RE.test(value.trim());
}

export function parseMinutes(value: string): number | null {
  const match = HHMM_RE.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return WEEK_DAYS.map((day) => ({
    day,
    isOpen: day !== 'SUN',
    openTime: '08:00',
    closeTime: '18:00',
    breakStart: null,
    breakEnd: null,
  }));
}

export function validateDaySchedule(schedule: DaySchedule): string | null {
  if (!schedule.isOpen) return null;

  const openMinutes = parseMinutes(schedule.openTime);
  const closeMinutes = parseMinutes(schedule.closeTime);
  if (openMinutes === null || closeMinutes === null) {
    return 'Saisissez des heures valides au format HH:MM (ex. 08:00).';
  }
  if (closeMinutes <= openMinutes) {
    return "L'heure de fermeture doit être après l'ouverture.";
  }

  const hasBreakStart = Boolean(schedule.breakStart);
  const hasBreakEnd = Boolean(schedule.breakEnd);
  if (hasBreakStart !== hasBreakEnd) {
    return 'Renseignez le début et la fin de la pause déjeuner, ou désactivez-la.';
  }
  if (schedule.breakStart && schedule.breakEnd) {
    const breakStartMinutes = parseMinutes(schedule.breakStart);
    const breakEndMinutes = parseMinutes(schedule.breakEnd);
    if (
      breakStartMinutes === null ||
      breakEndMinutes === null ||
      breakStartMinutes <= openMinutes ||
      breakEndMinutes >= closeMinutes ||
      breakEndMinutes <= breakStartMinutes
    ) {
      return 'La pause déjeuner doit être comprise dans les heures d’ouverture.';
    }
  }
  return null;
}

export function validateWeeklySchedule(schedule: WeeklySchedule): readonly ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = [];
  for (const daySchedule of schedule) {
    const message = validateDaySchedule(daySchedule);
    if (message) errors.push({ day: daySchedule.day, message });
  }
  return errors;
}

export function updateDaySchedule(
  schedule: WeeklySchedule,
  day: WeekDayKey,
  patch: Partial<Omit<DaySchedule, 'day'>>,
): WeeklySchedule {
  return schedule.map((item) => (item.day === day ? { ...item, ...patch } : item));
}

export function applyHoursToWeekdays(
  schedule: WeeklySchedule,
  template: Omit<DaySchedule, 'day'>,
  targetDays: readonly WeekDayKey[],
): WeeklySchedule {
  const targetSet = new Set<WeekDayKey>(targetDays);
  return schedule.map((item) => (targetSet.has(item.day) ? { day: item.day, ...template } : item));
}

function signatureOf(item: DaySchedule): string {
  if (!item.isOpen) return 'CLOSED';
  const breakText = item.breakStart && item.breakEnd ? ` (pause ${item.breakStart}–${item.breakEnd})` : '';
  return `${item.openTime} – ${item.closeTime}${breakText}`;
}

export function formatWeeklyScheduleSummary(schedule: WeeklySchedule): string {
  if (schedule.length === 0) return 'Fermé toute la semaine';
  const allClosed = schedule.every((item) => !item.isOpen);
  if (allClosed) return 'Fermé toute la semaine';

  const groups: Array<{ start: WeekDayKey; end: WeekDayKey; label: string }> = [];
  for (const item of schedule) {
    const sig = signatureOf(item);
    const label = sig === 'CLOSED' ? 'Fermé' : sig;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.end = item.day;
    } else {
      groups.push({ start: item.day, end: item.day, label });
    }
  }

  return groups
    .map(({ start, end, label }) => {
      const startShort = WEEK_DAY_LABELS[start].short;
      const endShort = WEEK_DAY_LABELS[end].short;
      const dayRange = start === end ? startShort : `${startShort} – ${endShort}`;
      return `${dayRange} : ${label}`;
    })
    .join(' · ');
}
