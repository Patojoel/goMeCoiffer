import { describe, expect, it } from 'vitest';
import { sql } from '../../application/sql.js';

describe('Writing a read query with the sql template', () => {
  it('turns every interpolated value into a bound parameter, never into SQL text', () => {
    const salonId = "x' OR '1'='1";
    const q = sql`SELECT id FROM bookings WHERE salon_id = ${salonId} AND status = ${'CONFIRMED'}`;

    expect(q.text).toBe('SELECT id FROM bookings WHERE salon_id = $1 AND status = $2');
    expect(q.values).toEqual([salonId, 'CONFIRMED']);
  });

  it('numbers the parameters of nested fragments in reading order', () => {
    const filter = sql`b.staff_id = ${'staff-1'}`;
    const q = sql`SELECT 1 FROM bookings b WHERE b.salon_id = ${'salon-1'} AND ${filter} AND b.price > ${2000}`;

    expect(q.text).toBe(
      'SELECT 1 FROM bookings b WHERE b.salon_id = $1 AND b.staff_id = $2 AND b.price > $3',
    );
    expect(q.values).toEqual(['salon-1', 'staff-1', 2000]);
  });

  it('inserts a constant fragment chosen from a whitelist as SQL text', () => {
    const ORDER = { date: sql.unsafe('b.starts_at'), staff: sql.unsafe('s.display_name') } as const;
    const q = sql`SELECT 1 FROM bookings b ORDER BY ${ORDER.staff} LIMIT ${20}`;

    expect(q.text).toBe('SELECT 1 FROM bookings b ORDER BY s.display_name LIMIT $1');
    expect(q.values).toEqual([20]);
  });

  it('joins fragments with a separator while keeping their parameters', () => {
    const conditions = [sql`a = ${1}`, sql`b = ${2}`];
    const q = sql`SELECT 1 WHERE ${sql.join(conditions, ' AND ')}`;

    expect(q.text).toBe('SELECT 1 WHERE a = $1 AND b = $2');
    expect(q.values).toEqual([1, 2]);
  });
});
