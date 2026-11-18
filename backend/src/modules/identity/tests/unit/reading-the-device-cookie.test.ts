import { describe, expect, it } from 'vitest';
import { parseDeviceCookie } from '../../infrastructure/http/device-cookie.js';

const token = (c: string) => c.repeat(43);

describe('Reading the cookie of recognised devices', () => {
  it('reads one token per account, separated by dots', () => {
    expect(parseDeviceCookie(`${token('a')}.${token('B')}`)).toEqual([token('a'), token('B')]);
  });

  it.each([undefined, 42, '', '.', 'short', `${token('a')}x`, `${token('a')}+`])(
    'ignores what is not a well formed token: %s',
    (raw) => {
      expect(parseDeviceCookie(raw)).toEqual([]);
    },
  );

  it('keeps the well formed tokens and drops the others', () => {
    expect(parseDeviceCookie(`forged.${token('a')}..${token('b')}`)).toEqual([token('a'), token('b')]);
  });

  it('keeps at most the 5 most recent tokens', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(token).join('.');

    expect(parseDeviceCookie(seven)).toEqual(['c', 'd', 'e', 'f', 'g'].map(token));
  });
});
