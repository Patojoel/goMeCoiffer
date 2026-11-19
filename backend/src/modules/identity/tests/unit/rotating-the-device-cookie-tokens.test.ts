import { describe, expect, it } from 'vitest';
import {
  deviceLookupTokens,
  MAX_DEVICE_TOKENS,
  rotateDeviceTokens,
} from '../../domain/services/device-cookie-tokens.js';

describe('Composing the device cookie tokens', () => {
  it('always looks up exactly 5 tokens, padding the missing ones, so a lookup costs the same with or without cookie', () => {
    expect(deviceLookupTokens([])).toHaveLength(MAX_DEVICE_TOKENS);
    expect(deviceLookupTokens(['a', 'b'])).toEqual(['a', 'b', 'no-device', 'no-device', 'no-device']);
  });

  it('looks up the first 5 tokens only', () => {
    expect(deviceLookupTokens(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('replaces the token that designated the device by the fresh one, in place', () => {
    expect(rotateDeviceTokens(['a', 'b', 'c'], 'b', 'fresh')).toEqual(['a', 'fresh', 'c']);
  });

  it('adds the fresh token at the end when no token designated the device', () => {
    expect(rotateDeviceTokens(['a'], null, 'fresh')).toEqual(['a', 'fresh']);
  });

  it('lets the oldest token out beyond 5', () => {
    expect(rotateDeviceTokens(['a', 'b', 'c', 'd', 'e'], null, 'fresh')).toEqual([
      'b',
      'c',
      'd',
      'e',
      'fresh',
    ]);
  });
});
