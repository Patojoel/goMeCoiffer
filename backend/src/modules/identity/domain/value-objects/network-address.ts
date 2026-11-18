const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Huit groupes de 16 bits, ou `null` si l'adresse n'est pas une IPv6 lisible. */
function expandIpv6(address: string): number[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const piece of part.split(':')) {
      if (IPV4.test(piece)) {
        const octets = piece.split('.').map(Number);
        groups.push(octets[0]! * 256 + octets[1]!, octets[2]! * 256 + octets[3]!);
      } else if (/^[0-9a-f]{1,4}$/.test(piece)) groups.push(Number.parseInt(piece, 16));
      else return null;
    }
    return groups;
  };
  const head = toGroups(halves[0]!);
  const tail = halves.length === 2 ? toGroups(halves[1]!) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  return missing < 1 ? null : [...head, ...Array<number>(missing).fill(0), ...tail];
}

/** Adresse réseau d'un essai de connexion, ramenée à ce qui désigne un abonné : adresse IPv4 ou préfixe IPv6 /64. */
export const UNPARSABLE_ADDRESS = 'unparsable';

const isIpv4 = (address: string) =>
  IPV4.test(address) && address.split('.').every((octet) => Number(octet) <= 255);

/** Retire le port : `a.b.c.d:port` et `[ipv6]:port` (une IPv6 sans crochets contient plusieurs « : » et reste intacte). */
function withoutPort(address: string): string {
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(address);
  if (bracketed) return bracketed[1]!;
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(address);
  return ipv4WithPort ? ipv4WithPort[1]! : address;
}

/**
 * Adresse réseau d'un essai de connexion, ramenée à ce qui désigne un abonné : adresse IPv4 ou préfixe IPv6 /64.
 * Une adresse illisible tombe dans un compteur commun (`unparsable`) : elle ne permet pas de multiplier les compteurs.
 */
export function normalizeNetworkAddress(raw: string): string {
  const address = withoutPort(raw.trim().split('%')[0]!.toLowerCase());
  if (!address.includes(':')) return isIpv4(address) ? address : UNPARSABLE_ADDRESS;
  const groups = expandIpv6(address);
  if (!groups) return UNPARSABLE_ADDRESS;
  const isMappedIpv4 = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (isMappedIpv4) return [groups[6]! >> 8, groups[6]! & 255, groups[7]! >> 8, groups[7]! & 255].join('.');
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(':')}::/64`;
}
