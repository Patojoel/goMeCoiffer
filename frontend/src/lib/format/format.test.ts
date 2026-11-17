import { describe, expect, it } from 'vitest';
import { formatTimeInZone, formatXaf } from './format';

const plain = (s: string) => s.replace(/[\s  ]/g, ' ');

describe('formatXaf', () => {
  it('affiche un montant entier en FCFA sans décimale', () => {
    expect(plain(formatXaf(15000))).toBe('15 000 FCFA');
  });

  it('affiche zéro', () => {
    expect(plain(formatXaf(0))).toBe('0 FCFA');
  });
});

describe('formatTimeInZone', () => {
  const instant = '2026-03-10T23:30:00.000Z';

  it('affiche l heure dans le fuseau du salon, pas celui du navigateur', () => {
    expect(formatTimeInZone(instant, 'Africa/Douala')).toBe('00:30');
    expect(formatTimeInZone(instant, 'Europe/Paris')).toBe('00:30');
    expect(formatTimeInZone(instant, 'America/New_York')).toBe('19:30');
  });
});
