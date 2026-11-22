import { describe, expect, it } from 'vitest';
import {
  applyHoursToWeekdays,
  createDefaultWeeklySchedule,
  formatWeeklyScheduleSummary,
  updateDaySchedule,
  validateDaySchedule,
  validateWeeklySchedule,
} from '../models/schedule/weeklySchedule.js';

describe('Salon weekly opening schedule (domain model)', () => {
  it('provides Mon-Sat 08:00-18:00 and Sunday closed as default schedule', () => {
    const schedule = createDefaultWeeklySchedule();

    expect(schedule).toHaveLength(7);
    expect(schedule[0]).toEqual({
      day: 'MON',
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: null,
      breakEnd: null,
    });
    expect(schedule[6]?.isOpen).toBe(false);
    expect(formatWeeklyScheduleSummary(schedule)).toBe('Lun. – Sam. : 08:00 – 18:00 · Dim. : Fermé');
  });

  it('validates that opening time precedes closing time and breaks sit inside the shift', () => {
    const invalidShift = validateDaySchedule({
      day: 'MON',
      isOpen: true,
      openTime: '18:00',
      closeTime: '08:00',
      breakStart: null,
      breakEnd: null,
    });
    expect(invalidShift).toContain("L'heure de fermeture doit être après l'ouverture");

    const invalidBreak = validateDaySchedule({
      day: 'TUE',
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '14:00',
      breakEnd: '13:00',
    });
    expect(invalidBreak).toContain('La pause déjeuner doit être comprise dans les heures');

    const schedule = updateDaySchedule(createDefaultWeeklySchedule(), 'WED', {
      openTime: '19:00',
      closeTime: '17:00',
    });
    expect(validateWeeklySchedule(schedule)).toEqual([
      { day: 'WED', message: expect.stringContaining('fermeture') },
    ]);
  });

  it('ignores time range validation when a day is closed and applies weekday presets cleanly', () => {
    const closed = validateDaySchedule({
      day: 'SUN',
      isOpen: false,
      openTime: '18:00',
      closeTime: '08:00',
      breakStart: null,
      breakEnd: null,
    });
    expect(closed).toBeNull();

    const updated = applyHoursToWeekdays(
      createDefaultWeeklySchedule(),
      { isOpen: true, openTime: '09:00', closeTime: '20:00', breakStart: '12:30', breakEnd: '13:30' },
      ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    );
    expect(formatWeeklyScheduleSummary(updated)).toBe(
      'Lun. – Ven. : 09:00 – 20:00 (pause 12:30–13:30) · Sam. : 08:00 – 18:00 · Dim. : Fermé',
    );
  });

  it('formats when all days are closed cleanly', () => {
    const allClosed = applyHoursToWeekdays(
      createDefaultWeeklySchedule(),
      { isOpen: false, openTime: '08:00', closeTime: '18:00', breakStart: null, breakEnd: null },
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    );
    expect(formatWeeklyScheduleSummary(allClosed)).toBe('Fermé toute la semaine');
  });
});
