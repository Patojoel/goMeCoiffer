import { describe, expect, it } from 'vitest';
import { safeError } from '../../infrastructure/logging/safe-error.js';

describe('Logging a failed database write', () => {
  it('keeps what helps diagnose the failure and drops the client data the database echoed back', () => {
    const failure = Object.assign(
      new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'),
      {
        name: 'QueryFailedError',
        code: '23P01',
        constraint: 'bookings_no_overlap',
        table: 'bookings',
        query: 'INSERT INTO bookings (phone, client_name) VALUES ($1, $2)',
        parameters: ['+237677123456', 'Awa Ngono'],
        detail: 'Key (staff_id, period)=(…) conflicts; failing row contains (+237677123456, Awa Ngono)',
        driverError: { detail: 'failing row contains (+237677123456, Awa Ngono)' },
      },
    );

    const logged = JSON.stringify(safeError(failure));

    expect(logged).toContain('23P01');
    expect(logged).toContain('bookings_no_overlap');
    expect(logged).not.toContain('+237677123456');
    expect(logged).not.toContain('Awa Ngono');
  });
});
