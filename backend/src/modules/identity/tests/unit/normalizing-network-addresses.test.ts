import { describe, expect, it } from 'vitest';
import { normalizeNetworkAddress } from '../../domain/value-objects/network-address.js';

describe('Normalizing the network address of a sign-in attempt', () => {
  it.each([
    ['41.202.10.1', '41.202.10.1'],
    ['::ffff:41.202.10.1', '41.202.10.1'],
    ['::ffff:29ca:0a01', '41.202.10.1'],
    ['::FFFF:41.202.10.1', '41.202.10.1'],
  ])('keeps the whole IPv4 address, also when mapped in IPv6: %s -> %s', (raw, expected) => {
    expect(normalizeNetworkAddress(raw)).toBe(expected);
  });

  it.each([
    ['2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:db8:1:2::/64'],
    ['2001:db8:1:2::1', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:0000:0000:0000:0001', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
  ])('reduces an IPv6 address to its /64 prefix: %s -> %s', (raw, expected) => {
    expect(normalizeNetworkAddress(raw)).toBe(expected);
  });

  it('gives the same address for two IPv6 addresses of the same /64 and another one for the next /64', () => {
    expect(normalizeNetworkAddress('2001:db8:1:2::1')).toBe(normalizeNetworkAddress('2001:db8:1:2:ffff::9'));
    expect(normalizeNetworkAddress('2001:db8:1:3::1')).not.toBe(normalizeNetworkAddress('2001:db8:1:2::1'));
  });

  it.each([
    ['41.202.10.1:51234', '41.202.10.1'],
    ['[2001:db8:1:2::1]:443', '2001:db8:1:2::/64'],
    ['[::ffff:41.202.10.1]:80', '41.202.10.1'],
    ['[2001:db8:1:2::1]', '2001:db8:1:2::/64'],
  ])('drops the port before reading the address: %s -> %s', (raw, expected) => {
    expect(normalizeNetworkAddress(raw)).toBe(expected);
  });

  it.each(['unknown', '', '1:2:3:4:5:6:7:8:9', '999.1.1.1', 'not an address', '41.202.10', 'abcd'])(
    'puts an unreadable address in one common counter: %j',
    (raw) => {
      expect(normalizeNetworkAddress(raw)).toBe('unparsable');
    },
  );
});
